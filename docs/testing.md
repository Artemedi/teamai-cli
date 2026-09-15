# Testing — TeamAI CLI

**Last updated:** 2026-08-30

This guide covers the test structure, patterns, and approaches used in the TeamAI CLI codebase. All tests are written in TypeScript and run with Vitest.

## Test Structure

```
src/
└── __tests__/
    ├── *.test.ts              # Unit tests (215 files)
    ├── e2e/
    │   ├── *.test.ts          # E2E tests (7 files)
    │   └── *-live.test.ts     # Live provider tests
    ├── fixtures/
    │   └── hooks/             # Hook configuration fixtures
    └── helpers/
        └── mock-server.ts     # Mock HTTP server for tests
```

## Test Types

### 1. Unit Tests

**Location:** `src/__tests__/*.test.ts`

**Purpose:** Test individual functions, modules, and components in isolation.

**Patterns:**
- Mock external I/O (git, fetch, child_process) at module boundaries
- Use `vi.mock()` for module-level mocking
- Test data in `src/__tests__/fixtures/`
- Test naming convention: `<source-file>.test.ts`
- Coverage: `npx vitest run --coverage` with `@vitest/coverage-v8`

### 2. E2E Tests

**Location:** `src/__tests__/e2e/*.test.ts`

**Purpose:** Test the CLI end-to-end with real git operations and external services.

**Requirements:**
- `TEAMAI_TEST_TOKEN` - Test token for API access
- `TEAMAI_TEST_REPO_URL` - Test repository URL
- Real git credentials for provider tests

**Configuration:**
- `vitest.e2e.config.ts` - E2E tests, 60s timeout, 30s hook timeout, `fileParallelism: false`, retry 1

### 3. Live Provider Tests

**Location:** `src/__tests__/e2e/*-live.test.ts`

**Purpose:** Test integration with real cloud providers (GitHub, GitLab, GitCode, CNB, TGit).

**Examples:**
- `github-provider-live.test.ts`
- `gitlab-provider-live.test.ts`
- `gitcode-provider-live.test.ts`
- `cnb-provider-live.test.ts`

## Test Configuration

### `vitest.config.ts`

- Unit tests only
- 15s timeout
- v8 coverage reporting
- Includes `src/__tests__/**/*.test.ts`

### `vitest.e2e.config.ts`

- E2E tests only
- 60s timeout
- 30s hook timeout
- `fileParallelism: false`
- retry 1

## Test Coverage

**Target:** 80%+ coverage (stated in `CONTRIBUTING.md`)

**Commands:**
```bash
npx vitest run --coverage
```

## Test Guidelines

### 1. Write Tests at the Right Level

**Unit tests** should:
- Test one function or module at a time
- Use mocks for external I/O
- Be fast and deterministic
- Cover edge cases and error conditions

**E2E tests** should:
- Test the complete user workflow
- Use real git operations
- Verify the actual CLI behavior
- Be run against real providers when possible

### 2. Use Proper Mocking

**Mock at the boundary:**
- Mock `git` commands, not the business logic
- Mock `fetch` calls, not the HTTP client
- Mock file system operations, not the file system itself

**Avoid over-mocking:**
- Don't mock the module under test
- Don't mock the exact behavior you're trying to verify

### 3. Test Data

**Use fixtures:**
- Keep test data in `src/__tests__/fixtures/`
- Use realistic data that mirrors production scenarios
- Keep fixtures small and focused

### 4. Error Handling

**Test error paths:**
- Invalid input
- Missing dependencies
- Network failures
- Permission errors
- Timeout conditions

## CI/CD Integration

### GitHub Actions

The CI pipeline runs:
1. `npm run build`
2. `npx tsc --noEmit`
3. `npx vitest run`
4. `npx vitest run --config vitest.e2e.config.ts`

### Test Environment

**Environment variables:**
- `TEAMAI_TEST_TOKEN` - Test token for API access
- `TEAMAI_TEST_REPO_URL` - Test repository URL
- `CI` - CI environment flag

## Test Requirements Before PR

1. **Unit tests must pass:**
   ```bash
   npx vitest run
   ```

2. **E2E tests must pass:**
   ```bash
   npx vitest run --config vitest.e2e.config.ts
   ```

3. **Build must succeed:**
   ```bash
   npm run build
   ```

4. **Type check must pass:**
   ```bash
   npx tsc --noEmit
   ```

5. **Real CLI end-to-end validation:**
   - Run the actual CLI with the new behavior
   - Verify all Test Plan items pass
   - Document the test plan in the PR

## Test Troubleshooting

| Issue | Solution |
|-------|----------|
| `vitest` not found | Run `npm install` first |
| E2E tests fail due to missing token | Set `TEAMAI_TEST_TOKEN` and `TEAMAI_TEST_REPO_URL` |
| `fileParallelism` errors | Use `vitest.e2e.config.ts` for E2E tests |
| Mock not working | Check `vi.mock()` import paths |
| Test hangs | Increase timeout in `vitest.config.ts` or `vitest.e2e.config.ts` |

## Test Quality Checklist

Before submitting tests:

- [ ] All tests pass locally
- [ ] Coverage is maintained or improved
- [ ] No flaky tests introduced
- [ ] Mocks are at the correct boundary
- [ ] Test data is realistic
- [ ] Error paths are covered
- [ ] Test plan is documented in the PR

## Test Plan Requirements

Test results must be documented in the PR description:

```
## Test Plan

- [x] `npm run build`
- [x] `npx tsc --noEmit`
- [x] `npx vitest run`
- [x] `npx vitest run --config vitest.e2e.config.ts`
- [x] Real CLI end-to-end validation
```

## Test Quality Standards

1. **Fast:** Unit tests should run in under 1 second each
2. **Deterministic:** Tests should produce the same result every time
3. **Isolated:** Tests should not depend on external state
4. **Readable:** Test names should clearly describe the expected behavior
5. **Maintainable:** Tests should be easy to update when behavior changes

## Test Coverage Standards

- **80%+ coverage** is the target for the codebase
- **Critical paths** (sync, recall, contribute) should have higher coverage
- **Error paths** should be covered where feasible
- **E2E tests** should cover the main user workflows

## Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up test environment:
   ```bash
   export TEAMAI_TEST_TOKEN=<token>
   export TEAMAI_TEST_REPO_URL=<repo-url>
   ```

3. Run unit tests:
   ```bash
   npx vitest run
   ```

4. Run E2E tests:
   ```bash
   npx vitest run --config vitest.e2e.config.ts
   ```

## Test Documentation Requirements

When adding new features:

1. **Add unit tests** for the new functionality
2. **Add E2E tests** if the feature affects user workflows
3. **Update the test plan** in the PR description
4. **Document new test patterns** in this file if they're reusable
