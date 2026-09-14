# Git Provider Documentation

TeamAI CLI supports multiple Git hosting platforms through a provider abstraction layer. This document describes the available providers, their authentication methods, and how to add new providers.

## Available Providers

| Provider | Host | Authentication | Recommended Use |
|----------|------|----------------|-----------------|
| `github` | github.com | `gh` CLI or `GITHUB_TOKEN` environment variable | Open source projects, external users |
| `tgit` | git.woa.com | `gf` CLI (auto-download) + `~/.netrc` | Tencent internal teams |
| `cnb` | cnb.cool | `cnb login` or `CNB_TOKEN` environment variable | CNB (Cloud Native Build) users |
| `gitlab` | gitlab.com or self-hosted instances | `GITLAB_TOKEN` environment variable | GitLab / Enterprise self-hosted |
| `gitcode` | gitcode.com | `GITCODE_TOKEN` environment variable or init interactive paste | GitCode (CSDN) users |
| `git` | Any Git host | System Git Credential Helper or SSH Key | Self-hosted Gitea and other platforms |

## Provider Auto-Detection

`teamai init <input>` (or alias `teamai init --repo <input>`) automatically selects the provider based on the input format:

```
yourorg/yourrepo                        → github (default)
https://github.com/org/repo(.git)         → github
git@github.com:org/repo.git             → github
https://git.woa.com/team/repo(.git)     → tgit
git@git.woa.com:team/repo.git           → tgit
https://cnb.cool/org/repo(.git)         → cnb
git@cnb.cool:org/repo.git               → cnb
https://gitlab.com/org/repo(.git)       → gitlab
git@gitlab.com:org/repo.git             → gitlab
https://gitcode.com/org/repo(.git)      → gitcode
git@gitcode.com:org/repo.git            → gitcode
https://git.example.com/group/repo.git  → git
git@git.example.com:group/repo.git      → git
```

The provider selection is written to the team repository's `teamai.yaml` in the `provider` field, and is used for all subsequent `push` / `pull` operations.

## Generic Git Provider (Self-Hosted/ Private Repositories)

Any complete HTTPS or SSH URL not in the known host list will automatically use the `git` provider:

```bash
teamai init https://code.example.com/Enterprise/my-project.git --scope user
# Or use SSH
teamai init git@code.example.com:Enterprise/my-project.git --scope user
```

The generic provider does not read or save platform tokens—it lets the system `git` handle authentication:

- HTTPS: Pre-configure Git Credential Helper; do not embed username, password, or Token in the URL.
- SSH: Pre-configure SSH Keys and ensure `ssh-agent` has access to the private key.

Clone, pull, and push work normally. Platform operations (auto-create, auto-create PR/MR) are not supported across different services, so a manual PR will be prompted after `teamai push` completes.

## GitHub Provider

### Authentication

Two authentication methods are supported—**`gh` CLI is recommended**.

**Method 1: `gh` CLI (Recommended)**

```bash
# macOS
brew install gh

# Debian/Ubuntu
sudo apt install gh

# Other platforms: https://cli.github.com/
```

After installation, run `gh auth login`, or simply let `teamai init` trigger interactive login:

```bash
teamai init yourorg/yourrepo
# When not logged in, automatically triggers: gh auth login --web
```

**Method 2: `GITHUB_TOKEN` environment variable**

For environments without `gh` CLI access (CI, containers, restricted Linux), use a [personal access token](https://github.com/settings/tokens):

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxx
teamai init yourorg/yourrepo
```

Token requires `repo` scope. `GH_TOKEN` is also recognized as an alias.

### Supported Operations

| Operation | Implementation |
|-----------|----------------|
| clone | `git clone https://oauth2:$TOKEN@github.com/...` |
| createRepo | `POST /user/repos` or `POST /orgs/:org/repos` |
| create PR | `gh pr create` or `POST /repos/:owner/:repo/pulls` |
| specify reviewer | `gh pr create -r` or `POST .../requested_reviewers` |

### Default Branch

GitHub repositories default to `main`. TeamAI currently hardcodes the `push` target branch as `master` (legacy behavior). If your GitHub repository uses `main`, you can change the default branch in **Settings → Branches** or wait for a future version with configurable target branch.

## TGit Provider (Tencent WorkGit)

### Authentication

`teamai init` automatically downloads the WorkGit CLI `gf` to `~/.teamai/gf/`, then runs `gf auth login` (supports iOA SSO / browser device code / manual token). After login, the token is stored in `~/.netrc`—all subsequent git operations include it.

### Nested Namespace Support

TGit supports `group/subgroup/repo` multi-level paths (GitHub does not), with dedicated path handling logic:

```
https://git.woa.com/Group/Subgroup/repo
git@git.woa.com:Group/Subgroup/repo.git
```

### Default Email Domain

TGit configures git commit email to `<username>@tencent.com`. GitHub Provider has no default domain (uses user's global git configuration).

## CNB Provider (cnb.cool)

CNB ([Cloud Native Build](https://cnb.cool)) provides a thin wrapper around the official CLI `@cnbcool/cnb-cli`, following the same pattern as TGit: delegating authentication, repository creation, and PR creation to the platform's own CLI. The CLI is auto-installed via `npm i -g @cnbcool/cnb-cli` when missing.

### Authentication

Two methods, same as GitHub Provider's handling of `GITHUB_TOKEN`:

**Method 1: `cnb login` (Interactive, dev machines recommended)**

```bash
cnb login   # OAuth2 device flow, then `cnb git-credential` provides git credentials
teamai init https://cnb.cool/yourorg/yourrepo
```

**Method 2: `CNB_TOKEN` environment variable (Headless/CI)**

```bash
export CNB_TOKEN=xxxxxxxx
teamai init https://cnb.cool/yourorg/yourrepo
```

With `CNB_TOKEN` set, `cnb login` is not needed. Username is parsed from `cnb users get-user-info`, or can be overridden via `CNB_USERNAME`.

### Supported Operations

| Operation | Implementation |
|-----------|----------------|
| clone | `git clone https://cnb:$CNB_TOKEN@cnb.cool/...` or `cnb git-credential` |
| createRepo | `cnb repositories create-repo` |
| create PR | `cnb pulls post-pull` |
| username | `cnb users get-user-info` (or `CNB_USERNAME`) |

### Nested Namespace Support

Similar to TGit, CNB supports `org/subgroup/repo` nested paths.

### Default Email Domain

CNB Provider has no default email domain (same as GitHub).

### Host Scope and Self-Hosting

Currently only the public community platform **cnb.cool** is supported (the only host verified in production). It is only selected when the URL explicitly specifies `cnb.cool` — it does not serve as a default fallback.

Internal/enterprise self-hosted instances (like internal mirrors) can override the git host via `TEAMAI_CNB_HOST`, but such deployments must also configure `cnb` CLI with `CNB_API_ENDPOINT` (and `CNB_WEB_ENDPOINT`) pointing to the corresponding API—TeamAI does not manage these endpoints, and they are not yet tested, so they are not supported configurations.

## GitLab Provider (Including Self-Hosted)

GitLab Provider works via GitLab **REST API v4**—no external CLI required, only a Personal Access Token. This is the recommended approach for new providers: GitLab (including enterprise self-hosted instances) has standardized REST APIs with predictable behavior.

### Authentication

Configure via GitLab environment variables:

```bash
export GITLAB_URL=https://gitlab.example.com   # Self-hosted instance base URL; defaults to https://gitlab.com
export GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxx      # Personal Access Token, requires api scope
```

Token variable supports three names (by priority): `GITLAB_TOKEN` > `GITLAB_PRIVATE_TOKEN` > `GITLAB_PAT`. Empty/whitespace values are treated as unset and the next alias is tried.

`GITLAB_URL` **must include a scheme** (`https://` or `http://`). Writing `gitlab.example.com` causes a hard error during GitLab operations instead of silently falling back to gitlab.com. Internal HTTP instances, non-standard ports, and path-mounted deployments (e.g., `https://example.com/gitlab`) are fully preserved, including clone URLs.

### Self-Hosted Instance Detection

- **Public gitlab.com**: URL host matches directly, auto-selects gitlab provider.
- **Self-hosted instances**: After setting `GITLAB_URL`, when the URL host matches `GITLAB_URL` host, it auto-detects as gitlab; `TEAMAI_GITLAB_HOST` can also directly specify the host without a complete URL:

```bash
export GITLAB_URL=https://git.example.com
teamai init git.example.com/yourgroup/yourrepo     # → gitlab
```

- Also possible to explicitly set `provider: gitlab` in the team repository's `teamai.yaml` for forced switching.

### Relationship with Generic `git` Provider

Unknown hosts default to the generic `git` Provider—it only handles transport (clone/pull/push via system Git credentials), and `createRepo` and create MR operations will directly report "not supported." GitLab Provider's value is in detecting self-hosted instances: with platform capabilities enabled (repo creation, MR creation, MR data fetching, listing group repositories), operations that the generic provider cannot perform become available. Detection priority: `known hosts` → `self-hosted GitLab` → `git` generic fallback.

### Nested Namespace Support

GitLab supports `group/subgroup/repo` multi-level paths, preserving the full group path in path parsing:

```
https://git.example.com/Group/Subgroup/repo
git@git.example.com:Group/Subgroup/repo.git
```

Browser URLs with `/-/` route separators and post-separator content (`/-/tree/main`, `/-/merge_requests/42`, `/-/blob/...`) are automatically stripped, returning the base project itself.

### Supported Operations

| Operation | Implementation |
|-----------|----------------|
| clone | `git clone <base-url>/...` with token via `oauth2:` basic auth through `-c http.extraHeader` injection (not embedded in URL, so not retained in cloned repo's `.git/config`) |
| createRepo | `POST /api/v4/projects` (user namespace, or precise group-path parsing; fails hard if group not found, no fallback to personal namespace) |
| create MR | `POST /api/v4/projects/:id/merge_requests` |
| specify reviewer | Parse username → user id, submit `reviewer_ids` |
| fetch MR data | `GET /api/v4/projects/:id/merge_requests/:iid` + commits + changes; MR URL host must match configured instance (`GITLAB_URL` / `TEAMAI_GITLAB_HOST`, default gitlab.com), otherwise request is refused to prevent token leakage to unconfigured hosts |
| list group repos | `GET /api/v4/groups/:path/projects` (paginated, `include_subgroups=true` includes sub-groups) |

### Default Email Domain

GitLab Provider has no default email domain (same as GitHub), using user's git global configuration.

## GitCode Provider (gitcode.com)

GitCode (gitcode.com, CSDN subsidiary) uses Gitee-style **REST API v5** (`https://api.gitcode.com/api/v5`), requiring no external CLI, just a Personal Access Token. While structurally similar to GitLab Provider, the API has distinct dialects (separate API domain, `Authorization: Bearer` auth, PR uses `head`/`base`/`title`/`body`, whoami uses `login`).

### Authentication

Token is resolved by priority:

1. `GITCODE_TOKEN` (primary)
2. `GC_TOKEN` (alias, for gitcode-cli users with existing env vars)
3. `~/.netrc` entry `machine gitcode.com` condition

```bash
export GITCODE_TOKEN=xxxxxxxxxxxx
```

Generate PAT in GitCode → Settings / Access Tokens.

**Interactive login**: On first `teamai init` without a configured token, paste the PAT once; upon verification, it's written to `~/.netrc` (permissions `0600`) for reuse by subsequent commands and `git push`. CI/headless environments should configure `GITCODE_TOKEN` directly to avoid interactive prompts.

### Namespace

GitCode has single-level namespaces (user or organization), repository addresses are `owner/repo`, without nested sub-groups.

### Supported Operations

| Operation | Implementation |
|-----------|---------------|
| clone | HTTPS with `oauth2:<token>@` (team repo, credentials persist for future push) or `http.extraHeader` (shallow clone); also supports SSH public key |
| createRepo | Personal `POST /user/repos`; Organization `POST /orgs/:org/repos` |
| createPullRequest | `POST /repos/:owner/:repo/pulls` (`head`/`base`/`title`/`body`) |
| fetchMergeRequest | `GET /repos/:owner/:repo/pulls/:n` + commits + files; PR URL host must be gitcode.com, otherwise request is refused to prevent token leakage to unconfigured hosts |
| listOrgRepos | `GET /orgs/:org/repos` (paginated) |

> Note: Only public cloud `gitcode.com` is supported; self-hosted GitCode Enterprise editions are not.

### Default Email Domain

GitCode has no default email domain, using user's git global configuration.

## Manual Provider Specification

Beyond automatic URL detection, you can explicitly set `provider: github`, `provider: tgit`, `provider: cnb`, `provider: gitlab`, `provider: gitcode`, or `provider: git` in the team repository's `teamai.yaml`:

```yaml
team: my-team
scope: user
description: TeamAI shared resources
repo: https://github.com/yourorg/yourrepo.git
provider: github
reviewers:
  - alice
  - bob
```

## Adding a New Provider

A provider implements a TypeScript interface (see [`src/providers/types.ts`](../src/providers/types.ts)). To add a new provider with platform API capabilities (GitLab / Bitbucket / Gitea):

1. Create `src/providers/<name>/` directory
2. Implement `GitProvider` interface: `parseRepoInput` / `authenticate` / `cloneRepo` / `createRepo` / `createPullRequest` / `getDefaultEmailDomain`
3. Register in [`src/providers/registry.ts`](../src/providers/registry.ts) `HOST_MAP` and `PROVIDERS`
4. Write unit tests, referencing [`src/__tests__/github-provider.test.ts`](../src/__tests__/github-provider.test.ts)

Pull requests for new providers are welcome!