# Architecture — TeamAI CLI

Ordered map of composition, core packages, loop, seams, and extension points. Read before changing `src/`.

## Composition

```
src/
├── index.ts              CLI entry (commander), all subcommands wired
├── init.ts               Project/user scope init, agent tool setup
├── push.ts               Scan local resources → create MR
├── pull.ts               Sync team repo → inject into AI tools
├── status.ts             List resources, sync state
├── recall.ts             Knowledge-base search (graph traversal)
├── contribute.ts         Session knowledge contribution
├── members.ts            Team member management
├── roles-cmd.ts          Role/namespace management
├── tags.ts               Tag-based skill/rule filtering
├── source.ts             Cross-team source repos
├── env-commands.ts       Team env vars
├── hooks-cmd.ts          Hook inject/list/remove
├── mcp-cmd.ts            MCP server management
├── packages/             Team npm packages + Claude plugins
├── doctor.ts             Diagnostics
├── dashboard*.ts         Web dashboard (session analytics)
├── digest.ts             Weekly team digest
├── stats.ts              Usage statistics
├── update.ts             Self-update
├── uninstall.ts          Remove all teamai resources
├── sync/                 Sync engine (pull/push core)
├── resources/            Resource formatting & installation
│   ├── agents.ts
│   ├── rules.ts
│   ├── skills.ts
│   ├── hooks.ts
│   ├── mcp.ts
│   └── env.ts
├── providers/            Git provider adapters
│   ├── git/   (generic)
│   ├── github/
│   ├── gitlab/
│   ├── gitcode/
│   ├── cnb/
│   └── tgit/
├── wiki-engine/          Code knowledge graph
│   ├── code-knowledge/   AST extraction, multi-language
│   ├── core/             Graph index, wiki protocol
│   └── adapters/         Templates, formatters
├── maintenance/          Knowledge base health
│   ├── confidence.ts
│   ├── hot-cold.ts
│   ├── prune.ts
│   └── promote.ts
└── utils/                Shared helpers (logger, fs, git, cache, etc.)
```

## Core loop (pull → push → recall)

1. **`teamai pull`** — Clone/fetch team repo, filter by role + project + tags, write resources into AI tool dirs and `.teamai/`.
2. **`teamai push`** — Scan local resources, diff against team repo, open MR (isolated worktree).
3. **`teamai recall`** — Traverse the knowledge graph (learnings + wiki), score relevance, return matches with `matched`/`missing` terms.

Session hooks (`hook-dispatch`) drive pull on SessionStart and contribute on Stop.

## Seams & extension points

| Seam | Extension | How |
|------|-----------|-----|
| **Git provider** | New Git host | Add `providers/<name>/` implementing `GitProvider` interface |
| **AI tool** | New agent | Add resource adapters in `resources/` + settings injection in `init.ts` |
| **Wiki engine** | New language extractor | Add extractor in `wiki-engine/code-knowledge/extractors/` |
| **Recall** | New relevance signal | Extend `src/recall.ts` scoring + votes schema |
| **Hooks** | New event | Add handler in `src/hook-handlers.ts`, register in settings |
| **MCP** | New server type | Extend `resources/mcp.ts` transport handling |
| **Env** | New var source | Extend `src/resources/env.ts` resolution chain |

## Data model

- **Team repo**: `skills/`, `rules/`, `docs/`, `learnings/`, `manifest/`, `mcp/`, `hooks/`, `env/`
- **Local partition**: `~/.teamai/projects/<slug>/` (config, state, team-repo clone)
- **Self mode**: knowledge committed to `main` under `.teamai/`; reports on `teamai-reports` orphan branch

## Verification

- `npm run build` — TypeScript compile + tsup bundle
- `npx vitest run` — unit tests
- `npx vitest run --config vitest.e2e.config.ts` — E2E against real Git providers
- E2E test plan must pass end-to-end with real CLI before PR merge