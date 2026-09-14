# Design: DSH Team Context integration (v1, read-only)

> Status: v1 implemented. DSH Team Context → TeamAI, one direction only.
>
> Superseded v0 assumption: an earlier draft of this design assumed the DSH
> Team Context repo would also publish a canonical `rules/` directory. The
> published provider contract (`dsh-team-context`, ADR-0006) deliberately does
> not include one — see decision 3 below. TeamAI's own pre-existing,
> team-authored `rules/` capability is unrelated and unaffected.

## Problem

DSH Team Context is a separate, canonical source of truth for org-wide shared
skills and governance — distinct from a team's own teamai team repo (which
stays authoritative for its own skills/rules/learnings). TeamAI must consume
it without becoming a second owner of that content: no automatic promotion
into it, no write path, no silent local override of governance.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Direction | DSH Team Context → TeamAI only | No review/promotion workflow exists yet on the DSH side; a write path would need one |
| 2 | Config location | Team-level `teamai.yaml: teamContext: { repo }`, not a typed `sources` entry | See "Config shape" below |
| 3 | Canonical entities | `skills/` and `governance/` only. **No canonical `rules/`** | The provider contract (dsh-team-context ADR-0006) does not publish a `rules/` entity: an invariant belongs in `governance/`, a procedure belongs in `skills/`. A runtime-specific rule/policy surface, if a consumer needs one, is that consumer's own projection of `governance/` content — not something DSH Team Context publishes as a distinct thing |
| 4 | Allow-list | None. Everything under `skills/`, `governance/` is canonical | Unlike peer `sources` (`publicSkills` opt-in), a canonical repo is trusted by default |
| 5 | Contract | `team-context.yaml` (`schemaVersion: 1`) at the DSH repo root | Version/shape validation, not a publication filter; unknown version OR unknown top-level field fails loud before any local write |
| 6 | Skills collision | Local team skill wins; canonical copy skipped, **observably** (logged + reflected in the adapter's own manifest) | Team-authored content must not be silently shadowed by canonical content |
| 7 | Governance | Always fully regenerated into its own CLAUDE.md block; no config flag anywhere disables or shadows it | This is the availability-vs-authority split (dsh-team-context ADR-0007): Team Context unavailable degrades gracefully and never blocks boot; Team Context configured-and-resolved makes governance authoritative and non-shadowable. Neither half weakens the other |
| 8 | Learnings | Deferred entirely (not part of v1) | Curated cross-team learnings need their own resolution semantics; scope was cut to ship skills/governance first |
| 9 | Shared primitives | `ensureRepoCache` (clone/pull-with-TTL) lives in `utils/external-repo-cache.ts`, called by both `source.ts` and `team-context.ts`. `diffNameSets` lives there too and is called by `team-context.ts`; `source.ts` keeps its own inline tombstone diff, not migrated | Extracted because a concrete second consumer (`team-context.ts`) exists and calls each one today — see "Why shared helpers are feature-driven" below |
| 10 | Atomicity | Resolve the full snapshot (skills + governance + schema check) in memory before any local write | An invalid/incompatible upstream must never leave partial or tombstoned local state |

### Config shape: `teamContext:` vs a typed `sources` entry

Considered folding this into the existing `sources: [{ name, repo, kind }]`
array instead of a separate top-level `teamContext` field. Kept the separate
field:

- **Cardinality mismatch.** `sources` is an array because multiple peer teams
  are legitimately expected; the DSH contract publishes one canonical plane
  per team. A `TeamContextConfigSchema.optional()` singular field matches
  that exactly; an array would need an ad hoc "at most one `kind:
  'team-context'` entry" rule that doesn't exist for `sources` today.
- **Trust-boundary / collision-policy mismatch.** `sources` are opt-in
  (`publicSkills` allow-list) and local-wins-silently. Team Context is
  trusted-by-default with no allow-list, and governance specifically can
  never be locally overridden. Merging both into one array means every
  generic consumer of `sources` (a future `teamai source list`, bulk
  pull-progress UI, etc.) would need to branch on `kind` to know which
  collision policy applies — one missed branch away from a canonical,
  non-overridable governance entry being handled with peer-source rules
  (silently shadowable, listed as removable via `teamai source remove`).
  A structurally separate field cannot be iterated by code that assumes
  peer-source semantics; a discriminated-union member can.
- **Reuse was already captured at the right layer.** The actual duplication
  risk — clone/pull/TTL bookkeeping, skill-resource helpers — is shared via
  `utils/external-repo-cache.ts` and `resources/skills.ts` (decision 9), not
  via a shared config shape. There is no remaining code-reuse argument for a
  shared config type once that plumbing is shared.
- **Backward compatible.** `sources`'s existing flat shape and every
  call site that treats `SourceConfig[]` as homogeneous stays exactly as it
  is; nothing needs a `kind` guard retrofitted onto it.

**Re-confirmed after removing canonical `rules/` and auditing every shared
helper for real callers (see below):** none of the four arguments above
depend on how many entity types Team Context materializes. Cardinality
(one canonical plane vs. an array of peer teams), the trust/collision-policy
mismatch, and `sources`' call-site backward compatibility are properties of
the *config shape*, not of whether the entity is skills+governance or
skills+rules+governance. Shrinking the feature didn't change the config
decision; it only shrank `team-context.ts` itself (~350 lines, no rules
branch). The decision stands for the same code-level reasons, not because
it shipped first.

### Why shared external-repo helpers are feature-driven, not a pre-extracted framework

An early version of this integration was proposed upstream as a standalone
refactor PR that extracted `ensureRepoCache` / `diffNameSets` /
`getLocalTeamSkillNames` / `removeSkillFromToolPaths` out of `source.ts`
*before* any second caller of them existed in the codebase — `diffNameSets`
in particular had zero production callers at that point. That's premature
abstraction: it optimizes for a hypothetical future integration instead of a
real one, and nobody can tell from the code alone whether the shared shape
actually fits a second use case until one exists.

Our own conclusion, not an upstream requirement: a helper only stays shared
if a concrete, currently-merged consumer calls it in production code today.
Re-checked against the current tree:

| helper | production callers | keep shared? |
|---|---|---|
| `ensureRepoCache` | `source.ts` (`ensureSourceRepo`), `team-context.ts` (`syncTeamContext`) | yes — two real callers |
| `getLocalTeamSkillNames` | `source.ts` (`pullSource`), `team-context.ts` (`materializeTeamContext`) | yes — two real callers |
| `removeSkillFromToolPaths` | `source.ts` (2 call sites), `team-context.ts` (`materializeTeamContext`) | yes — two real callers |
| `diffNameSets` | `team-context.ts` (`materializeTeamContext`'s skill tombstone diff) | yes — one real, current caller; `source.ts` still computes its own tombstone diff inline and was deliberately not migrated to it (out of scope, working code, not touched) |

All four are kept because Team Context is now that concrete second consumer,
not because they were inherited from a prior refactor. If a helper had zero
current callers, it would be deleted, not kept "for later" — see
`utils/external-repo-cache.ts`'s module comment, which says explicitly there
is no plan for a third caller and a real one should be extended for when it
exists, not anticipated now.

## Architecture

```
DSH Team Context repo (git)              teamai.yaml (consumer team)
  team-context.yaml                        teamContext:
    schemaVersion: 1                          repo: <git-url>
  skills/<name>/SKILL.md
  governance/*.md
          │                                        │
          │              teamai pull                │
          ▼                                         ▼
~/.teamai/team-context/<hash>/repo/  ← git clone (read-only, never pushed to)
~/.teamai/team-context/<hash>/installed.json ← manifest (skills/governanceFiles deployed)
          │
          ▼
resolveTeamContextSnapshot() → validates schemaVersion + top-level shape,
resolves the WHOLE snapshot → materializeTeamContext() → per-entity collision
policy → tool dirs + CLAUDE.md governance block
```

`team-context.ts` runs as its own step in `pull()`, immediately after the
existing cross-team `pullSources()` step — same contention-filtered scope,
same best-effort semantics, no new hook event. `scanLocalForPush` (skills.ts)
excludes canonical skill names via `getTeamContextSkillNames()`, so canonical
content can never be swept into a team PR. There is no equivalent hook in
`rules.ts` because there is no canonical rules entity to exclude.

## Deferred

- Curated cross-team learnings (index-only ingestion).
- Namespace/role-aware filtering of Team Context content (v1 deploys
  everything the repo publishes).
- Admin-enforced protection of the `teamContext` field itself — today it is
  an ordinary team-config field; a team member can still remove or repoint it
  through the normal `teamai push` flow.
- Any propose/promote path back into DSH Team Context.
- A native runtime rule/policy projection of `governance/` content beyond the
  existing CLAUDE.md block (e.g. a dedicated `.cursor/rules`-shaped output) —
  not requested by any real consumer yet; would need its own decision if one
  emerges, per dsh-team-context ADR-0006.
