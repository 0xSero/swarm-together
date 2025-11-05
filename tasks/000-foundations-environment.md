# 000 Foundations — Environment & Project Skeleton

## Goal
- Establish Tauri app shell (Rust + React/Vite), base packages, SQLite, keychain access, and initial folder structure.

## Deliverables
- Tauri app scaffolding builds locally.
- React app with routing, state (Zustand or Redux), Tailwind and shadcn/ui setup.
- SQLite provider and migration baseline; secrets via OS keychain wired.

## Dependencies
- None.

## Implementation Notes
- Configure strict TypeScript settings and Rust clippy/lints.
- Define base database schema tables (sessions, panes) as placeholders.

## Tests (must exist before feature)
- Unit: config loaders, schema boot, keychain mocks.
- Integration: app starts, database file created, migrations run.

## Observability
- Startup logs, database initialization timing, error boundaries.

## Acceptance
- App starts, blank session list appears; tests green; logs show clean initialization.