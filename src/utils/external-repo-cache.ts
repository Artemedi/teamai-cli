import path from 'node:path';
import { pullRepo } from './git.js';
import { detectProvider, getProvider } from '../providers/index.js';
import { log, spinner } from './logger.js';
import { pathExists, ensureDir } from './fs.js';

/**
 * Clone-or-pull-with-TTL for an external read-only repo mirror, extracted
 * because two concrete features currently call it: cross-team `sources`
 * (source.ts) and the DSH Team Context adapter (team-context.ts). Both
 * clone-or-pull an external repo with a TTL and never write back to it.
 *
 * There is deliberately no name-set-diff helper here anymore: it had exactly
 * one real caller (team-context.ts's skill tombstone cleanup), and
 * `source.ts` computes its own separate inline tombstone diff rather than
 * using a shared helper — so there was no actual cross-consumer duplication
 * to remove. That diff now lives directly in team-context.ts. This file is
 * deliberately not a general "external repository framework" — there is no
 * plan to add a third caller, and if one shows up, extend this file then,
 * not in anticipation now.
 *
 * Not to be confused with `repo-cache.ts` (import command's LAST_SYNC cache
 * for `teamai import`), which is an unrelated, pre-existing cache keyed by
 * provider/owner/repo for a different feature.
 */

/**
 * Ensure `repoDir` holds a git clone of `repoUrl`, refreshed via the git
 * provider abstraction (so provider auth — token, credential helper, SSH
 * agent — is used the same way it is for team-repo and source-repo clones).
 *
 * - `repoDir` absent → clone. Failure → returns null (caller cannot proceed).
 * - `repoDir` present → pull only when `force` or the TTL (measured from
 *   `lastPulledAt`) has elapsed; otherwise a no-op. A pull failure does NOT
 *   fail the call — the existing clone is still usable, so this returns
 *   `{ pulled: false }` and logs a warning (matches the pre-existing
 *   `ensureSourceRepo` behavior: prefer a stale cache over no cache).
 *
 * Never deletes or resets `repoDir` itself — that stays the caller's call
 * (e.g. tombstone cleanup of deployed *content*, not of the cache clone).
 */
export async function ensureRepoCache(
  repoDir: string,
  repoUrl: string,
  lastPulledAt: string | null,
  options: { force?: boolean; ttlMs: number; label: string },
): Promise<{ pulled: boolean } | null> {
  const { force = false, ttlMs, label } = options;

  if (await pathExists(repoDir)) {
    if (!force && lastPulledAt) {
      const elapsed = Date.now() - new Date(lastPulledAt).getTime();
      if (elapsed <= ttlMs) {
        log.debug(`[${label}] Within pull TTL, skipping git pull`);
        return { pulled: false };
      }
    }

    try {
      const result = await pullRepo(repoDir);
      log.debug(`[${label}] Git pull: ${result}`);
      return { pulled: true };
    } catch (e) {
      log.warn(`[${label}] Pull failed: ${(e as Error).message}`);
      return { pulled: false };
    }
  }

  // First time: clone via the provider so its configured authentication path
  // (token, credential helper, or SSH agent) is used.
  try {
    await ensureDir(path.dirname(repoDir));
    const cloneSpin = spinner(`[${label}] Cloning...`).start();

    const providerName = detectProvider(repoUrl);
    const provider = getProvider(providerName);
    const repoInfo = provider.parseRepoInput(repoUrl);
    const cloneTarget = provider.name === 'git'
      ? repoInfo.httpsUrl
      : `${repoInfo.owner}/${repoInfo.repo}`;
    provider.cloneRepo(cloneTarget, repoDir);

    cloneSpin.succeed(`[${label}] Cloned`);
    return { pulled: true };
  } catch (e) {
    log.warn(`[${label}] Clone failed: ${(e as Error).message}`);
    return null;
  }
}
