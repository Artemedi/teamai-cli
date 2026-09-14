import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fse from 'fs-extra';

vi.mock('../utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    dim: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('../utils/git.js', () => ({
  pullRepo: vi.fn().mockResolvedValue('already up to date'),
}));

import { log } from '../utils/logger.js';
import {
  resolveTeamContextSnapshot,
  materializeTeamContext,
  syncTeamContext,
  getTeamContextSkillNames,
  getTeamContextRepoDir,
} from '../team-context.js';
import { getHandler } from '../resources/index.js';
import { RESOURCE_TYPES } from '../types.js';
import type { TeamaiConfig, LocalConfig } from '../types.js';

const DSH_REPO_URL = 'git@example.com:acme/dsh-team-context.git';

describe('team-context', () => {
  let tmpDir: string;
  let homeDir: string;
  let dshRepoDir: string;
  let teamConfig: TeamaiConfig;
  let localConfig: LocalConfig;

  beforeEach(async () => {
    tmpDir = await fse.mkdtemp(path.join(os.tmpdir(), 'teamai-team-context-test-'));
    homeDir = path.join(tmpDir, 'home');
    vi.stubEnv('HOME', homeDir);

    const repoPath = path.join(tmpDir, 'team-repo');
    await fse.ensureDir(path.join(repoPath, 'skills'));
    await fse.ensureDir(path.join(homeDir, '.claude', 'skills'));
    await fse.ensureDir(path.join(homeDir, '.claude', 'rules'));

    // The team-context cache dir is derived from the repo URL by team-context.ts
    // itself (sha256-hashed), so tests resolve it via the exported helper rather
    // than reimplementing the hash.
    dshRepoDir = getTeamContextRepoDir(DSH_REPO_URL);
    await fse.ensureDir(dshRepoDir);

    teamConfig = {
      team: 'test',
      description: '',
      repo: 'https://git.example.com/acme/team-repo.git',
      provider: 'tgit' as const,
      reviewers: [],
      teamContext: { repo: DSH_REPO_URL },
      sharing: { skills: {}, rules: { enforced: [] }, docs: { localDir: '' }, env: { injectShellProfile: true } },
      toolPaths: {
        claude: { skills: '.claude/skills', rules: '.claude/rules', claudemd: '.claude/CLAUDE.md' },
      },
    } as unknown as TeamaiConfig;

    localConfig = {
      repo: { localPath: repoPath, remote: 'https://git.example.com/acme/team-repo.git' },
      username: 'testuser',
      updatePolicy: 'auto' as const,
      additionalRoles: [],
      scope: 'user' as const,
    } as LocalConfig;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fse.remove(tmpDir);
  });

  /** Populate the fake upstream DSH repo with one skill and one governance file. No `rules/` — Team Context has no canonical rules entity (ADR-0006). */
  async function seedUpstream(opts: {
    schemaVersion?: number | string;
    skillContent?: string;
    governanceContent?: string;
    omitContractFile?: boolean;
    extraManifestYaml?: string;
  } = {}): Promise<void> {
    await fse.remove(dshRepoDir);
    await fse.ensureDir(dshRepoDir);

    if (!opts.omitContractFile) {
      await fse.writeFile(
        path.join(dshRepoDir, 'team-context.yaml'),
        `schemaVersion: ${opts.schemaVersion ?? 1}\n${opts.extraManifestYaml ?? ''}`,
      );
    }

    await fse.ensureDir(path.join(dshRepoDir, 'skills', 'incident-response'));
    await fse.writeFile(
      path.join(dshRepoDir, 'skills', 'incident-response', 'SKILL.md'),
      opts.skillContent ?? '---\nname: incident-response\ndescription: canonical\n---\n# Canonical skill',
    );

    await fse.ensureDir(path.join(dshRepoDir, 'governance'));
    await fse.writeFile(
      path.join(dshRepoDir, 'governance', 'policy.md'),
      opts.governanceContent ?? 'All changes require review.',
    );
  }

  describe('resolveTeamContextSnapshot', () => {
    it('throws when team-context.yaml is missing', async () => {
      await seedUpstream({ omitContractFile: true });
      await expect(resolveTeamContextSnapshot(dshRepoDir)).rejects.toThrow(/missing team-context\.yaml/);
    });

    it('throws on an unsupported schemaVersion', async () => {
      await seedUpstream({ schemaVersion: 2 });
      await expect(resolveTeamContextSnapshot(dshRepoDir)).rejects.toThrow(/unsupported schemaVersion/);
    });

    it('throws on an unknown top-level manifest field, before any local write', async () => {
      await seedUpstream({ extraManifestYaml: 'rules: true\n' });
      await expect(resolveTeamContextSnapshot(dshRepoDir)).rejects.toThrow(/unknown top-level field/);
    });

    it('throws when team-context.yaml is not a YAML mapping', async () => {
      await fse.remove(dshRepoDir);
      await fse.ensureDir(dshRepoDir);
      await fse.writeFile(path.join(dshRepoDir, 'team-context.yaml'), '- not\n- a\n- mapping\n');
      await expect(resolveTeamContextSnapshot(dshRepoDir)).rejects.toThrow(/must be a YAML mapping/);
    });

    it('resolves skills and governance files for a valid v1 repo, with no rules entity', async () => {
      await seedUpstream();
      const snapshot = await resolveTeamContextSnapshot(dshRepoDir);
      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.skills.map((s) => s.name)).toEqual(['incident-response']);
      expect(snapshot.governanceFiles.map((g) => g.name)).toEqual(['policy.md']);
      expect(snapshot).not.toHaveProperty('rules');
    });

    it('ignores a canonical rules/ directory upstream — it is not a recognized entity', async () => {
      await seedUpstream();
      await fse.ensureDir(path.join(dshRepoDir, 'rules'));
      await fse.writeFile(path.join(dshRepoDir, 'rules', 'security-baseline.md'), '# Not canonical');

      const snapshot = await resolveTeamContextSnapshot(dshRepoDir);
      expect(snapshot.skills.map((s) => s.name)).toEqual(['incident-response']);
      expect(snapshot.governanceFiles.map((g) => g.name)).toEqual(['policy.md']);
    });
  });

  describe('acceptance: canonical content follows upstream, never leaks into push, governance cannot be shadowed', () => {
    it('materializes skill + governance on first pull', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});

      expect(await fse.pathExists(path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'))).toBe(true);
      const claudeMd = await fse.readFile(path.join(homeDir, '.claude', 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).toContain('Team Context Governance');
      expect(claudeMd).toContain('All changes require review.');
    });

    it('propagates an upstream skill update on the next pull', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});

      await seedUpstream({ skillContent: '---\nname: incident-response\ndescription: canonical\n---\n# Updated canonical skill' });
      await syncTeamContext(teamConfig, localConfig, {});

      const skill = await fse.readFile(path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'), 'utf-8');
      expect(skill).toContain('Updated canonical skill');
    });

    it('removes a skill locally once upstream drops it (tombstone-on-diff)', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});
      expect(await fse.pathExists(path.join(homeDir, '.claude', 'skills', 'incident-response'))).toBe(true);

      // Upstream now publishes nothing.
      await fse.remove(dshRepoDir);
      await fse.ensureDir(dshRepoDir);
      await fse.writeFile(path.join(dshRepoDir, 'team-context.yaml'), 'schemaVersion: 1\n');

      await syncTeamContext(teamConfig, localConfig, {});

      expect(await fse.pathExists(path.join(homeDir, '.claude', 'skills', 'incident-response'))).toBe(false);
    });

    it('never surfaces canonical skills as push candidates', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});

      const skillsHandler = getHandler('skills');
      const pushableSkills = await skillsHandler.scanLocalForPush(teamConfig, localConfig);

      expect(pushableSkills.some((i) => i.name === 'incident-response')).toBe(false);
    });

    it('materialized governance can never enter a promote/push/trainable path: no ResourceType handler ever surfaces it', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});

      // Governance is deliberately NOT a ResourceType (types.ts's RESOURCE_TYPES
      // is 'skills' | 'rules' | 'docs' | 'env' | 'agents' | 'hooks' | 'mcp') — it
      // is only ever injected into CLAUDE.md, never read back as team-authored
      // or optimizer-editable content. Pin that structurally: across every
      // resource handler's own push-candidate scan, nothing derived from the
      // governance block content or its CLAUDE.md markers ever appears.
      for (const type of RESOURCE_TYPES) {
        const handler = getHandler(type);
        const candidates = await handler.scanLocalForPush(teamConfig, localConfig);
        for (const item of candidates) {
          expect(item.name).not.toContain('governance');
          expect(item.relativePath).not.toContain('CLAUDE.md');
        }
      }
    });

    it('a local project cannot silently shadow governance: the block is fully regenerated from upstream every pull', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});

      // Simulate a local attempt to override the governance section by hand-editing
      // inside its markers (the only way a human could try to "shadow" it, since
      // there is no config flag to disable the block).
      const claudeMdPath = path.join(homeDir, '.claude', 'CLAUDE.md');
      const tampered = (await fse.readFile(claudeMdPath, 'utf-8'))
        .replace('All changes require review.', 'Reviews are optional now.');
      await fse.writeFile(claudeMdPath, tampered);

      await syncTeamContext(teamConfig, localConfig, {});

      const finalContent = await fse.readFile(claudeMdPath, 'utf-8');
      expect(finalContent).toContain('All changes require review.');
      expect(finalContent).not.toContain('Reviews are optional now.');
    });

    it('clears stale governance content once upstream publishes none, rather than leaving it stale', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});

      await seedUpstream({ governanceContent: '' });
      await fse.remove(path.join(dshRepoDir, 'governance', 'policy.md'));
      await syncTeamContext(teamConfig, localConfig, {});

      const claudeMd = await fse.readFile(path.join(homeDir, '.claude', 'CLAUDE.md'), 'utf-8');
      expect(claudeMd).not.toContain('All changes require review.');
      expect(claudeMd).toContain('publishes no governance content');
    });

    it('an invalid upstream schemaVersion fails loud and leaves previously materialized state untouched', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});
      const before = await fse.readFile(path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'), 'utf-8');

      await seedUpstream({ schemaVersion: 99, skillContent: '---\nname: incident-response\n---\n# This must never land' });
      await syncTeamContext(teamConfig, localConfig, {});

      const after = await fse.readFile(path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'), 'utf-8');
      expect(after).toBe(before);
      expect(after).not.toContain('This must never land');
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('unsupported schemaVersion'));
    });

    it('an upstream manifest with an unknown top-level field fails loud and leaves previously materialized state untouched', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, {});
      const before = await fse.readFile(path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'), 'utf-8');

      await seedUpstream({
        extraManifestYaml: 'rules: true\n',
        skillContent: '---\nname: incident-response\n---\n# This must never land',
      });
      await syncTeamContext(teamConfig, localConfig, {});

      const after = await fse.readFile(path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'), 'utf-8');
      expect(after).toBe(before);
      expect(after).not.toContain('This must never land');
      expect(log.error).toHaveBeenCalledWith(expect.stringContaining('unknown top-level field'));
    });
  });

  describe('graceful degradation when Team Context is unavailable', () => {
    it('an unresolvable repo URL on first pull is skipped without throwing, and does not break the rest of the sync', async () => {
      await fse.remove(dshRepoDir); // no prior clone on disk
      const unresolvable = { ...teamConfig, teamContext: { repo: 'not-a-real-host::acme/dsh-team-context' } };

      await expect(syncTeamContext(unresolvable as unknown as TeamaiConfig, localConfig, {})).resolves.toBeUndefined();
      expect(await fse.pathExists(path.join(homeDir, '.claude', 'skills', 'incident-response'))).toBe(false);
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Could not access the DSH Team Context repo'));
    });
  });

  describe('skills: local override wins, observably', () => {
    it('does not deploy the canonical skill when a local team skill has the same name', async () => {
      await seedUpstream();
      // The team repo declares its own skill under this name...
      await fse.ensureDir(path.join(localConfig.repo.localPath, 'skills', 'incident-response'));
      await fse.writeFile(
        path.join(localConfig.repo.localPath, 'skills', 'incident-response', 'SKILL.md'),
        '# Local team version',
      );
      // ...already deployed to the tool dir, as if pullForScope's own team-skill
      // sync had already run this pull cycle (team-context.ts never deploys team
      // skills itself — it only decides whether to leave this alone or overwrite it).
      await fse.ensureDir(path.join(homeDir, '.claude', 'skills', 'incident-response'));
      await fse.writeFile(
        path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'),
        '# Local team version',
      );

      await syncTeamContext(teamConfig, localConfig, {});

      const deployed = await fse.readFile(
        path.join(homeDir, '.claude', 'skills', 'incident-response', 'SKILL.md'),
        'utf-8',
      );
      expect(deployed).toBe('# Local team version');
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('overrides the canonical Team Context skill'));

      const names = await getTeamContextSkillNames(teamConfig);
      expect(names.has('incident-response')).toBe(false);
    });
  });

  describe('materializeTeamContext dry-run', () => {
    it('does not write anything to disk under --dry-run', async () => {
      await seedUpstream();
      await syncTeamContext(teamConfig, localConfig, { dryRun: true });

      expect(await fse.pathExists(path.join(homeDir, '.claude', 'skills', 'incident-response'))).toBe(false);
    });
  });

  describe('no teamContext configured', () => {
    it('is a silent no-op', async () => {
      const noTeamContext = { ...teamConfig, teamContext: undefined };
      await expect(syncTeamContext(noTeamContext, localConfig, {})).resolves.toBeUndefined();
    });
  });

  describe('materializeTeamContext (unit)', () => {
    it('returns a skills + governance manifest, with no rules field', async () => {
      await seedUpstream();
      const snapshot = await resolveTeamContextSnapshot(dshRepoDir);
      const result = await materializeTeamContext(snapshot, teamConfig, localConfig, null);

      expect(result.deployedSkills).toEqual(['incident-response']);
      expect(result.governanceInjected).toBe(true);
      expect(result.skippedSkillsLocalOverride).toEqual([]);
      expect(result.removedSkills).toEqual([]);
      expect(result).not.toHaveProperty('deployedRules');
      expect(result).not.toHaveProperty('removedRules');
    });
  });
});
