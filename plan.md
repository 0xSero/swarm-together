# Multi-Agent Coding System — Long-Term Plan

## Vision
A Warp-quality desktop system to orchestrate coding agents (Claude Code CLI, Codex CLI with GPT-5, and local models via Ollama). Sessions are terminal-centric (up to 4 panes plus tabs), deeply observable, and test-first. The runtime is in-house for control, reliability, and extensibility.

## Guiding Principles
- In-house orchestration with explicit agent roles, tool policy, and message routing.
- CLI-first connectors (Claude Code, Codex CLI), plus local models (Ollama).
- Session-first UX: blocks, history, attachments, progress timeline, token HUD.
- Safety by default: sandboxed operations, secrets isolation, reversible actions.
- Observability loop: logs, metrics, traces → insights → improvements.
- TDD: tests precede features; stable, reproducible agent scenarios.

## Core Capabilities
- Sessions with up to 4 simultaneous panes in a grid, plus tab groups.
- Agents: one or more per session; inter-agent communications and shared memory (blackboard).
- Token tracking: per-message → per-pane → per-agent → per-session → per-worktree.
- Git worktrees to isolate concurrent agents or branches on a single repository.
- Slash commands: session, agents, models, tokens, memory, worktrees, history.
- Export/import: sessions, usage, and artifacts for later analysis.
- Local API for VS Code and other tools to attach, stream, and command.

## Architecture (High-Level)
- Shell: Tauri (Rust backend; React/Vite UI).
- UI: React + Tailwind + shadcn/ui with a dark Neumorphism-leaning theme.
- Backend services (Rust with optional TypeScript SDK):
  - `agent-core` (types, roles, tools, policies)
  - `runtime` (orchestrator, scheduler, message bus)
  - `memory` (ring buffers, blackboard, embeddings, summarization)
  - `session-service` (lifecycle, panes/tabs, history blocks, progress)
  - `token-service` (usage aggregation and reconciliation)
  - `worktree-service` (git worktree operations, safeguards)
  - `model-connectors` (Claude Code CLI, Codex CLI GPT-5, Ollama)
  - `api-gateway` (local HTTP/WebSocket)
  - `storage` (SQLite with migrations; secrets in OS keychain)
  - `telemetry-service` (logs, traces, metrics, crash recovery)
- Data: SQLite (sessions, panes, messages, artifacts, usage, worktrees, memory).

## Agent Runtime (In-House)
- Message routing between agents and tools with mailboxes and retries.
- Policy guards: cost, loop limits, tool permissions, safe file operations.
- Inter-agent data sharing via a session blackboard with TTL/LRU rules.
- Memory: per-agent ring buffers with token caps and auto-summaries; semantic recall via local embeddings.

## Connectors
- Claude Code CLI: headless mode adapter; stream IO; usage reconciliation via Anthropic usage APIs where possible.
- Codex CLI (GPT-5/GPT-5-Codex): CLI wrapper; TUI/streaming; usage via OpenAI usage object when available; fallback estimators.
- Local models (Ollama): chat plus embeddings (default `nomic-embed-text`; optional `bge-small` or `e5-small`).

## Token Tracking
- Live HUD with input/output tokens, cost estimates, rate-limit posture.
- Reconciliation jobs with provider usage endpoints when available.
- Export to CSV/JSON for per-provider and per-session analyses.

## Git Worktrees
- Basic workflow: add, list, remove, lock; manual prune by default.
- Convention: `worktrees/<session>/<branch>` directories.
- Safety checks: clean state enforcement; diffs before removal.

## VS Code Integration (Local API)
- Endpoints: sessions (create/attach/list), stream events, send commands, open files or PRs, fetch usage.
- Minimal authentication: local token; localhost binding; no external exposure by default.
- VS Code extension: attach, stream, send commands; compact explorer view.

## Brand Kit (Dark Neumorphism)
- Colors:
  - Background `#0B0F14`; Surface `#11161C`; Elevated `#151B23`
  - Primary `#5B9BFF`; Secondary `#8B7CFF`; Accent `#3CE2B3`
  - Success `#33D69F`; Warning `#FFB020`; Danger `#FF6B6B`
  - Text High `#E6EDF3`; Muted `#98A6B3`; Border `#27303B`
- Typography:
  - Inter (UI), JetBrains Mono (terminal)
- Icons:
  - Lucide, 2px stroke; radii 10–14px; soft neumorphic shadows.

## Observability Loop
- Collect: structured logs, traces, token metrics, rate-limit events, tool calls.
- Visualize: debug panel (event stream, memory, token meter, connector health).
- Act: gates in CI; regression budgets; automated summaries of hot spots.
- Improve: prioritize reliability issues, cost spikes, slow paths.

## Security and Privacy
- Secrets in OS keychain; redaction in logs; least-privilege shell/git operations.
- Content filters (configurable) to prevent accidental leakage.

## Testing Strategy (TDD)
- Unit: logic, parsers, memory, policies, token estimators.
- Integration: CLI adapters with local stubs; worktrees in temporary repositories; storage migrations.
- E2E: desktop UI with Playwright; multi-agent flows; slash commands; token HUD; worktree operations; VS Code attach.
- Deterministic agent scenarios: recorded transcripts and golden files.

## Research Notes (November 2025)
- Codex CLI (GPT-5/GPT-5-Codex): interactive TUI, `/model` switching, configuration flags, usage accounting via usage objects.
- Claude Code: CLI/headless workflows, plugins/skills, usage/cost APIs, caching guidance, streaming IO integration.
- Crush: OSS TUI agent with `.crushignore` and tool-permission model—reference for CLI ergonomics and policy prompts.
- Embeddings (Ollama): start with `nomic-embed-text`; optional `bge-small` or `e5-small` for speed; keep pluggable interfaces.

## Open Decisions (Now Locked)
- Tauri shell; in-house runtime; CLI-first connectors; basic worktree operations; granular token tracking; local model priority; dark neumorphic brand.