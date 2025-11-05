# 010 Test Harness — Baseline

## Goal
- Establish test frameworks for Rust (unit/integration) and React (Vitest or Jest), plus Playwright E2E harness for the desktop shell.

## Deliverables
- Unit test runner configurations; coverage reporting; example tests.
- Playwright E2E configuration to launch the desktop shell and run a smoke test.

## Dependencies
- `000 Foundations — Environment & Project Skeleton`.

## Tests (must exist before feature)
- Example unit tests for Rust and TypeScript packages.
- Playwright smoke test validating application startup and basic rendering.
- CI configuration executing all test tiers.

## Observability
- Test logs captured as artifacts; screenshots/videos for E2E failures.

## Acceptance
- CI pipeline green on baseline suite; artifacts stored for E2E failures.