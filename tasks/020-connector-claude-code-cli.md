# 020 Connector — Claude Code CLI (Headless)

## Goal
- Adapter for Claude Code CLI headless mode; stream stdout/stderr; map events to internal messages.

## Deliverables
- Spawn/stream wrapper; error handling; timeouts; cancellation.
- Configurable CLI path and flags; environment pass-through controls.
- Usage reconciliation hooks (Anthropic usage API stubs).

## Dependencies
- `010 Test Harness — Baseline`.

## Tests (must exist before feature)
- Unit: parser for CLI output to message events.
- Integration: spawn stub CLI binary; simulate streams; cancellation and retry paths.

## Observability
- Connector health metrics; spawn and exit codes; stream throughput.

## Acceptance
- Can start a dummy session with stubbed output; messages appear in timeline; tests green.