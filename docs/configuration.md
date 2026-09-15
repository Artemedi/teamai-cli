# Configuration Reference — TeamAI CLI

**Last updated:** 2026-08-30

This reference documents all configuration files and their schemas used by TeamAI CLI. All configuration files are written in YAML format and must follow the specified schemas to ensure proper parsing and validation.

## Configuration Files

### 1. `teamai.yaml` (Team Repo Root)

The main configuration file for the team repository. This file defines the team's package declarations, sharing preferences, and other global settings.

#### Schema

```yaml
teamai:
  version: 1
  packages:
    npm:
      - name: <string>
        version: <string> | "*"  # Default: "*" (wildcard)
        global: <boolean> = false
        registry: <string> = "https://registry.npmjs.org/"
    claude:
      marketplaces:
        - name: <string>
          repo: <string>  # e.g., "anthropics/claude-plugins-official"
      plugins:
        - name: <string>@<string>  # e.g., "code-review@claude-plugins-official"
  sharing:
    coAuthor:
      enabled: <boolean> = true  # Control commit attribution trail
    recall:
      enabled: <boolean> = false  # Enable/disable knowledge recall
    contributeHint:
      enabled: <boolean> = true  # Show friction-based contribution hints
  # Additional team-wide settings can be added here
```

#### Key Configuration Options

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `packages.npm` | List of npm packages to install | `["typescript", "eslint"]` | No |
| `packages.claude.marketplaces` | List of Claude plugin marketplaces | `["claude-plugins-official"]` | No |
| `packages.claude.plugins` | List of Claude plugins to install | `["code-review@claude-plugins-official"]` | No |
| `sharing.coAuthor.enabled` | Enable/disable commit attribution trail | `true` | No |
| `sharing.recall.enabled` | Enable/disable automatic knowledge recall | `false` | No |
| `sharing.contributeHint.enabled` | Show friction-based contribution hints | `true` | No |

### 2. `config.yaml` (User/Home Directory)

Local configuration file stored in `~/.teamai/config.yaml`. This file contains user-specific settings and overrides.

#### Schema

```yaml
# Global settings for TeamAI CLI
# All fields are optional; missing fields use defaults

# Project scope: where resources are installed
scope: "project" | "user"  # Default: "project"

# Role selection (primary role for this workspace)
primaryRole: "string"  # Optional

# Project-specific configuration (if in project scope)
project:
  resources:
    skills: ["string"]  # Comma-separated list of skill namespaces
    rules: ["string"]
    docs: ["string"]
    env: ["string"]
  inheritUserScope: <boolean> = true  # Sync user resources and knowledge

# User-specific settings
user:
  excludedSkills: ["string"]  # Skills to exclude from local sync
  env:
    - key: <string>
      value: <string>
      description: <string>
  # Additional user settings can be added here

# Environment variables override
# These are read from system env vars first, then this file
env:
  - key: <string>
    value: <string>
    description: <string>
```

### 3. `state.json` (Team Repo Clone)

Automatically generated state file stored in `~/.teamai/state.json`. Contains runtime state that is not persisted in YAML files.

#### Schema (simplified)

```json
{
  "lastSync": "ISO 8601 timestamp",
  "lastPush": "ISO 8601 timestamp",
  "resourceCache": {
    "skills": { "sha": "hash", "version": "semver" },
    "rules": { "sha": "hash", "version": "semver" },
    "docs": { "sha": "hash", "version": "semver" }
  },
  "pendingPush": [
    {
      "resourceType": "skill" | "rule" | "doc" | "env" | "agent" | "hook" | "mcp",
      "path": "relative/path/to/resource",
      "action": "add" | "modify" | "remove",
      "timestamp": "ISO 8601 timestamp",
      "status": "pending" | "applied" | "failed"
    }
  ],
  "sessionMetrics": {
    "totalSessions": 0,
    "totalTokensUsed": 0,
    "frictionEvents": 0
  },
  "team": {
    "members": ["string"],
    "roles": ["string"]
  }
}
```

### 4. `tags.yaml` (Resource Tagging)

Tagging configuration file for resource tagging system.

#### Schema

```yaml
tags:
  - name: <string>
    description: <string>
    color: <string>  # Optional hex color code
  - name: <string>
    description: <string>
    color: <string>
```

### 5. `tags.yaml` (Resource Tagging)

Tagging configuration file for resource tagging system.

#### Schema

```yaml
tags:
  - name: <string>
    description: <string>
    color: <string>  # Optional hex color code
  - name: <string>
    description: <string>
    color: <string>
```

### 6. `manifest/roles.yaml` (Role Definitions)

Role definitions for team members.

#### Schema

```yaml
version: 1
projects:
  - id: <string>  # e.g., "hai-inference"
    name: <string>  # e.g., "HAI Inference"
    resources:
      knowledge: ["string"]  # Skill namespaces
      skills: ["string"]
      learnings: ["string"]
  roles:
    - id: <string>  # e.g., "hai_dev"
      name: <string>  # e.g., "HAI Developer"
      namespaces:
        - "common"
        - "hai"
        - "infra"
      description: <string>  # e.g., "Full-stack developer for HAI systems"
```

### 7. `manifest/projects.yaml` (Project Dispatch)

Project-to-namespace mapping for multi-project teams.

#### Schema

```yaml
version: 1
projects:
  - id: <string>  # e.g., "hai-inference"
    name: <string>  # e.g., "HAI Inference"
    resources:
      knowledge: ["string"]  # Skill namespaces
      skills: ["string"]
      learnings: ["string"]
    active: <boolean> = true  # Whether this project is currently active
```

### 8. `mcp/mcp.yaml` (MCP Server Configuration)

MCP server declarations for team-wide MCP servers.

#### Schema

```yaml
servers:
  - name: <string>  # e.g., "gpu-analysis"
    description: <string>
    transport: "stdio" | "http" | "sse"
    url: <string>
    headers:
      <key>: <string>
    timeout: <integer>  # milliseconds
    requires:
      - <string>  # e.g., "npx"
    tools:
      - <string>  # e.g., "claude"
  # Additional server definitions
```

### 9. `hooks/hooks.yaml` (Team Hooks)

Team-defined custom hooks.

#### Schema

```yaml
hooks:
  - id: <string>  # Unique identifier
    description: <string>
    event: "PreToolUse" | "PostToolUse" | "SessionStart" | "SessionEnd" | "UserPromptSubmit" | "CodeEditorChange" | "Other"
    matcher: "Bash" | "Regex" | "Wildcard"  # Pattern matching method
    command: <string>  # Command to execute
    tools: ["<string>", "<string>"]  # Tools that this hook applies to
    enabled: <boolean> = true
```

### 9. `culture.md` (Team Culture)

Team culture guidance file stored in team repo root.

#### Frontmatter Schema

```yaml
---
company:
  name: <string>  # e.g., "Acme Corp"
  mission: <string>
  vision: <string>
  values:
    - <string>  # e.g., "Innovation"
    - <string>
team:
  name: <string>  # e.g., "Platform Team"
  mission: <string>
  goals:
    - <string>
    - <string>
---
```

The body content after frontmatter becomes the team culture guidance text.

---

## Configuration Best Practices

1. **Use `teamai.yaml` for team-wide declarations** - This file is shared across all team members and should be version-controlled.
2. **Use `config.yaml` for user-specific settings** - This file is local to each user's home directory.
3. **Use `state.json` for runtime state** - This file is auto-generated and should not be manually edited.
4. **Use environment variables for secrets** - Use `${VAR}` placeholders in `mcp.yaml` and `env/env.yaml`, then set actual values via environment variables.
5. **Validate configuration before use**:
   - Run `teamai doctor` to check configuration
   - Use `teamai init --check` to validate configuration before initializing
6. **Version control**:
   - Commit `teamai.yaml` and `config.yaml` to the team repository
   - Do not commit `state.json` (it's auto-generated)
   - Keep `config.yaml` in `.gitignore` if containing sensitive values

### 9. Configuration Validation

The following commands validate configuration:

- `teamai doctor` - Checks configuration issues and runtime environment
- `teamai init --check` - Validates configuration before initialization
- `teamai pull` - Validates configuration during sync

### 10. Configuration Examples

#### Basic `teamai.yaml` Example

```yaml
teamai:
  version: 1
  packages:
    npm:
      - name: typescript
        version: "*"
      - name: eslint
        version: latest
        global: true
    claude:
      marketplaces:
        - name: claude-plugins-official
          repo: anthropics/claude-plugins-official
      plugins:
        - name: code-review@claude-plugins-official
```

#### Basic `config.yaml` Example

```yaml
scope: project
primaryRole: hai_dev
inheritUserScope: true
user:
  excludedSkills:
    - using-superpowers
  env:
    - key: API_ENDPOINT
      value: https://api.example.com
      description: "Team API endpoint"
    - key: GITHUB_TOKEN
      value: ghp_abcdef1234567890abcdef1234567890
      description: "GitHub token for team operations"
```

### 10. Configuration Validation

All configuration files are validated against their schemas using `ajv` (JSON Schema Validator). Invalid configurations will cause commands to fail with clear error messages.

- `teamai doctor` - Checks configuration validity
- `teamai init --check` - Validates configuration before initialization
- `teamai pull` - Validates configuration during sync

### 11. Configuration Validation Errors

Common validation errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid YAML format` | Malformed YAML syntax | Use a YAML validator or `pnpm run validate-config` |
| `Unknown option` | Invalid configuration key | Check schema for correct option names |
| `Invalid value type` | Wrong data type (e.g., string instead of boolean) | Fix type mismatch in YAML |
| `Missing required field` | Required field missing | Add the required field to configuration |
| `Invalid transport` | Invalid transport type in MCP config | Use "stdio", "http", or "sse" only |

---

## Configuration Workflow

1. **Admin creates/updates `teamai.yaml`** in team repo
2. **Team members run `teamai pull`** to sync changes
3. **Users run `teamai init`** with appropriate scope
4. **Users can override settings** in `~/.teamai/config.yaml`
5. **Configuration changes trigger sync** via `teamai pull`

All configuration changes should be reviewed via `teamai push` to create a Merge Request for team review.

## Configuration Validation

All configuration files are validated using JSON Schema. Invalid configurations will result in clear error messages from the CLI. The validation process includes:

- Syntax validation (YAML format)
- Schema validation (using AJV)
- Type checking
- Value range validation
- Cross-field validation

### 12. Configuration Validation Commands

- `teamai doctor` - Diagnose configuration issues
- `teamai init --check` - Validate configuration before init
- `teamai pull` - Validates configuration during sync

### 13. Configuration Security

- Secrets should be stored in environment variables, not in config files
- Use `${VAR}` placeholders in `mcp.yaml` and `env/env.yaml`
- `env/env.yaml` stores plaintext values - add to `.gitignore`
- `0600` permissions are enforced for all config files containing sensitive data
- Secrets are resolved at runtime and written to disk as plaintext (project-scope configs are committed to git)

## Configuration Examples

### Example 1: Basic Team Configuration

```yaml
# teamai.yaml
teamai:
  version: 1
  packages:
    npm:
      - name: typescript
        version: "*"
      - name: eslint
        version: latest
    claude:
      marketplaces:
        - name: claude-plugins-official
          repo: anthropics/claude-plugins-official
      plugins:
        - name: code-review@claude-plugins-official
  sharing:
    coAuthor:
      enabled: true
    recall:
      enabled: true
    contributeHint:
      enabled: true
```

### Example 2: User Configuration with Excluded Skills

```yaml
# ~/.teamai/config.yaml
scope: user
user:
  excludedSkills:
    - using-superpowers
  env:
    - key: API_ENDPOINT
      value: https://api.example.com
      description: "Team API endpoint"
    - key: GITHUB_TOKEN
      value: ghp_abcdef1234567890abcdef1234567890
      description: "GitHub token for team operations"
```

### 14. Configuration Troubleshooting

| Symptom | Likely Cause | Solution |
|---------|---------|----------|
| `teamai init` fails with "Invalid config" | Invalid YAML syntax | Run `pnpm run validate-config` |
| `teamai pull` fails with "401 Unauthorized" | Invalid token in `${VAR}` | Check `${GPU_ANALYSIS_TOKEN}` or `${GITHUB_TOKEN}` |
| `teamai pull` fails with "403 Forbidden" | Missing permissions in config | Verify token has correct permissions |
| `teamai push` fails with "Branch exists" | Previous push not merged | Merge the PR or use `--force` flag |
| `teamai packages install` fails with "Package not found" | Invalid package name | Use `--npm` flag for npm packages, ensure correct registry |

## Configuration Troubleshooting Guide

1. **Check configuration validity**:
   ```bash
   teamai doctor
   teamai init --check
   ```

2. **Verify token resolution**:
   ```bash
   echo $GPU_ANALYSIS_TOKEN
   cat ~/.teamai/env | grep GPU_ANALYSIS_TOKEN
   ```

3. **Check file permissions**:
   ```bash
   ls -la ~/.teamai/config.yaml
   ls -la ~/.teamai/state.json
   ```

4. **Debug configuration loading**:
   ```bash
   teamai doctor --verbose
   ```

5. **Common fixes**:
   - Fix YAML syntax errors
   - Correct data types (string vs boolean vs number)
   - Add missing required fields
   - Remove commented-out sections that cause parsing issues
   - Ensure all required fields are present

This reference ensures all team members can properly configure and use TeamAI CLI while maintaining consistency and security standards.