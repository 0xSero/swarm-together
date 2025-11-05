# 040 Runtime — Core Orchestrator

## Goal
- Implement the in-house orchestrator: message bus, agent registry, scheduling, retries, safeguards.

## Deliverables
- Agent registry; mailboxes; dispatch loop; retry/backoff; loop guards.
- Tool permission model and policy stubs.

## Dependencies
- `020 Connector — Claude Code CLI (Headless)`
- `021 Connector — Codex CLI (GPT-5)`
- `022 Connector — Ollama Chat + Embeddings`

## Tests (must exist before feature)
- Unit: queueing, retries, loop guard behavior.
- Integration: orchestrated flow across two stub agents.

## Observability
- Queue depth; retry counters; loop stoppage reasons.

## Acceptance
- Orchestrator runs two agents exchanging messages; no runaway loops; tests green.