# 021 Connector — Codex CLI (GPT-5)

## Goal
- Wrap the Codex CLI (assume `codex` binary) with model override support for GPT-5 and GPT-5-Codex; support interactive and headless modes.

## Deliverables
- Spawn/stream adapter; `/model` command support; configuration overrides.
- Usage capture via OpenAI usage object when available; estimators fallback.

## Dependencies
- `010 Test Harness — Baseline`.

## Tests (must exist before feature)
- Unit: output parsers; error parsing.
- Integration: stub CLI; long-running stream; graceful shutdown; model switch.

## Observability
- Connector health; usage counters; error taxonomy.

## Acceptance
- Session sends prompt and receives streamed responses via stub; tests green.