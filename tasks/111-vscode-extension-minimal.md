# 111 VS Code Extension — Minimal Attach

## Goal
- Extension to attach to local session, stream output, send slash commands, open files or PRs.

## Deliverables
- Command palette entries; webview or terminal bridge; settings for local token/port.

## Dependencies
- `110 API Gateway — Local HTTP/WebSocket`

## Tests (must exist before feature)
- Integration (headless): mock server; command round-trip; streaming renders.
- UX checks for error states.

## Observability
- Extension logs; latency counters; reconnection stats.

## Acceptance
- Basic attach, send, and stream works; tests green.