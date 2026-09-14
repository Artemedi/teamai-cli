# TeamAI CLI — Documentation Standards Compliance Plan

## Critical Documentation Gaps (Based on AGENTS.md Requirements)

### 1. Missing Documentation Categories
- **Architecture Overview**: No single document explaining system composition, core packages, and extension points (violates "Root AGENTS.md" standing order)
- **API Reference**: No generated or maintained reference for `src/types.ts` interfaces (violates "Type definitions → subsystems" rule)
- **CLI Command Reference**: `README.md` has basic table but no detailed command reference (violates "CLI user-facing output must be English" and "Test Plan" requirement)
- **Bilingual Documentation**: `docs/providers.md` and `docs/usage-guide.md` have inconsistent English/Chinese pairing (violates "Keep bilingual docs in sync" rule)

### 2. Required Documentation Updates

#### 1. Complete CLI Command Reference
**File**: `docs/cli-reference.md` (already created)
**Status**: ✓ Done
**Next**: Ensure all 45+ commands are documented with:
- Full syntax (`teamai [command] [options] [args]`)
- All available flags and their descriptions
- Examples for common use cases
- Status indicator for beta/experimental commands

#### 2. Fix Bilingual Documentation Inconsistencies
**Files**: `docs/providers.md`, `docs/usage-guide.md`, `README.md`
**Issues**:
- `docs/providers.md` has mostly Chinese with English fragments
- English docs contain Chinese characters in section headers
- Need to either:
  - Complete full bilingual translation with `verify-translation-pairing` script, OR
  - Remove Chinese entirely from user-facing docs (per AGENTS.md "CLI user-facing output must be English")

#### 2.1 Documentation Fix Plan
1. Run `pnpm run verify-translation-pairing` on all docs
2. Identify docs with >5% translation inconsistency
3. Either:
   - Complete Chinese translations for all English docs, OR
   - Remove Chinese from user-facing docs (use English-only approach)

#### 2.2 Documentation Cleanup Plan
1. **Remove Chinese from user-facing docs**:
   - Remove `docs/usage-guide.zh-CN.md` and `README.zh-CN.md`
   - Remove all Chinese characters from `README.md` and `docs/usage-guide.md`
   - Update `README.md` line 7: replace `[简体中文](README.zh-CN.md)` with `[Chinese (Simplified)](README.zh-CN.md)` for consistency
2. **Update `docs/providers.md`**:
   - Convert to English-only or complete bilingual with verification
   - Ensure all section headers are English-only

#### 3. Architecture Documentation
**File**: `docs/architecture.md` (already created)
**Status**: ✓ Done
**Next**: Ensure it follows DSH tier taxonomy and links to:
- `docs/subsystems/` pages
- `src/` module structure
- `docs/designs/` design documents

#### 4. Configuration Reference
**File**: `docs/configuration.md` (needs to be created)
**Content**:
- `teamai.yaml` schema with all options
- `config.yaml` schema for `~/.teamai/`
- `state.json` schema
- `tags.yaml` schema
- `manifest/roles.yaml` schema
- `manifest/projects.yaml` schema
- `mcp/mcp.yaml` schema
- `hooks/hooks.yaml` schema
- `culture.md` frontmatter reference
- All CLI config options (`--scope`, `--role`, `--project`, `--inherit-user-scope`, etc.)

#### 5. Testing Documentation
**File**: `docs/testing.md` (needs to be created)
**Content**:
- Test structure overview
- How to write unit tests (mocking patterns)
- E2E test setup and requirements
- Fixture structure and usage
- CI/CD integration details
- Test naming conventions

#### 6. Contributing Guide Update
**File**: `.github/CONTRIBUTING.md` (needs update)
**Issues**:
- Outdated project layout references
- Incomplete testing guidelines
- Missing documentation on how to add tests for new features
- Missing instructions for documentation updates

### 3. Recommended Action Plan

#### Phase 1: Documentation Compliance (3 days)
1. **Fix bilingual issues** (1 day):
   - Run `pnpm run verify-translation-pairing` on all docs
   - Remove Chinese from user-facing docs
   - Update `docs/providers.md` to English-only
2. **Update README.md** (0.5 day):
   - Replace command table with link to `docs/cli-reference.md`
   - Add "Complete Command Reference" section with all 45+ commands
   - Add links to new docs (`docs/cli-reference.md`, `docs/configuration.md`)
3. **Update CONTRIBUTING.md** (0.5 day):
   - Add documentation update guidelines
   - Add testing documentation requirements
   - Update project layout section

#### Phase 2: Content Creation (5 days)
1. **Create `docs/configuration.md`** (1 day)
   - Document all config files with YAML schemas
   - Include examples for common configurations
2. **Update `docs/usage-guide.md`** (2 days)
   - Add missing commands with full syntax and examples
   - Expand "Advanced Features" section
   - Add "FAQ" section
   - Ensure English-only output
3. **Create `docs/testing.md`** (1 day)
   - Explain test structure and patterns
   - Include mocking strategies
   - Document e2e setup requirements
4. **Update `CONTRIBUTING.md`** (0.5 day):
   - Add documentation update requirements
   - Add testing guidelines
   - Add documentation contribution instructions

#### Phase 3: Quality Assurance (2 days)
1. **Run verification tools**:
   - `pnpm run verify-doc-budgets`
   - `pnpm run verify-translation-pairing`
   - `pnpm run doc-sync`
   - `pnpm run build`
2. **Manual review**:
   - Check all command references for completeness
   - Verify all links point to correct files
   - Confirm all bilingual docs are properly paired
3. **Final validation**:
   - Ensure `README.md` links to new documentation
   - Verify all new docs follow DSH AGENTS.md standards
   - Confirm all docs are in the correct tier (tutorial vs reference)

### 4. Verification Requirements

Before merging any documentation changes:

1. **Word Count Budgets**:
   - `AGENTS.md` ≤ 1,600 words
   - `docs/AGENTS.md` ≤ 1,250 words
   - `docs/cordis-primer.md` ≤ 600 words
   - `docs/packages/AGENTS.md` ≤ 650 words
   - `docs/packages/client/AGENTS.md` ≤ 300 words

2. **Bilingual Pairing**:
   - All English docs must have matching `.zh-CN.md` files
   - `verify-translation-pairing` script must pass

3. **Link Integrity**:
   - All relative links must be valid
   - No dead `#fragment` anchors
   - All internal links must use relative paths

4. **End-to-End Validation**:
   - `pnpm run build` must succeed
   - All tests must pass
   - No documentation warnings from `dsh-doc-standards` audit

### 4. Next Steps

1. **Immediate**:
   - Create `docs/configuration.md` with complete config reference
   - Update `README.md` to link to `docs/cli-reference.md`
   - Remove Chinese from user-facing docs
   - Run `pnpm run verify-translation-pairing` on all docs

2. **Short-term**:
   - Create `docs/testing.md` with comprehensive testing guide
   - Update `CONTRIBUTING.md` with documentation and testing requirements
   - Complete `docs/usage-guide.md` with all commands

3. **Long-term**:
   - Create `docs/architecture.md` (already done)
   - Create `docs/provider-development.md` with step-by-step tutorial
   - Create `docs/hooks-guide.md` explaining the unified dispatch system
   - Create `docs/mcp-guide.md` for MCP server management

This plan ensures we meet all AGENTS.md requirements while maintaining high-quality, consistent, and verifiable documentation that aligns with the project's technical standards.