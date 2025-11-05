# 022 Connector — Ollama Chat + Embeddings

## Goal
- Local model adapter including embeddings (default `nomic-embed-text`); health checks; model availability monitoring.

## Deliverables
- Chat completions; embeddings endpoint; model list and health.
- Configurable host and port; timeouts; exponential backoff.

## Dependencies
- `010 Test Harness — Baseline`.

## Tests (must exist before feature)
- Unit: embedding vector validator; health checker.
- Integration: stub HTTP server; error injection; retry policies.

## Observability
- Latency histograms; failure rates; model status telemetry.

## Acceptance
- Embeddings and chat calls succeed with stubs; tests green.