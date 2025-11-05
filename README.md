# Agent Manager - Multi-Agent Coding System

A desktop application for orchestrating coding agents with session management, token tracking, and git worktrees.

## Project Structure

```
agent-manager/
├── src/                      # React frontend
│   ├── components/          # React components
│   ├── hooks/              # Custom hooks and state management
│   ├── styles/             # Global styles and Tailwind
│   ├── main.tsx            # React entry point
│   └── App.tsx             # Root component
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Application entry point
│   │   ├── db.rs           # Database layer
│   │   ├── config.rs       # Configuration management
│   │   ├── keychain.rs     # OS keychain integration
│   │   └── error.rs        # Error types
│   ├── Cargo.toml
│   └── build.rs
├── public/                  # Static assets
├── tasks/                   # Phase-by-phase implementation tasks
├── plan.md                  # Long-term vision and architecture
├── scope.md                 # Phases and task index
├── package.json             # Node.js dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite bundler config
├── tailwind.config.ts       # Tailwind CSS config
└── tauri.conf.json          # Tauri app configuration
```

## Development Setup

### Prerequisites
- Node.js 18+
- Rust 1.60+
- Tauri CLI: `npm install -g @tauri-apps/cli`

### Installation

```bash
npm install
```

### Running Development Server

```bash
npm run dev
```

This starts the Tauri dev environment with hot-reload for the React frontend.

### Building for Production

```bash
npm run build && npm run tauri build
```

## Testing

### Frontend Tests
```bash
npm test
```

### Running with UI
```bash
npm run test:ui
```

### Backend Tests (Rust)
```bash
cd src-tauri && cargo test
```

## Architecture Overview

### Frontend (React + TypeScript)
- **Framework**: React 18.3 with Vite bundler
- **Styling**: Tailwind CSS with custom dark neumorphism theme
- **State Management**: Zustand for lightweight store
- **Components**: Built with shadcn/ui patterns

### Backend (Rust)
- **Framework**: Tauri 1.5 for desktop shell
- **Database**: SQLite with sqlx for type-safe queries
- **Async Runtime**: Tokio for concurrent operations
- **Secrets**: OS keychain integration (macOS/Windows/Linux)
- **Logging**: Structured logging with tracing

### Database Schema
- `sessions`: Core session records with timestamps
- `panes`: Grid layout panes per session

## Configuration

### Strict Mode Settings
- TypeScript: `strict: true` with all strict options enabled
- Rust: `clippy` lints set to warn for all, pedantic, and nursery
- ESLint: Configured for React + TypeScript best practices

## Git Worktrees

Sessions can be isolated using git worktrees at `worktrees/<session>/<branch>`.

## API Integration

### Tauri IPC Commands
- `cmd_list_sessions`: Returns array of session names
- `cmd_create_session(name)`: Creates a new session

## Observability

### Startup Logging
- Database initialization timing logged at info level
- Configuration loading logged with details
- Error boundaries for graceful failure handling

### Token Tracking (Phase 5)
- Per-message token usage
- Per-pane, per-agent aggregation
- Live HUD display

## Security

- Secrets stored in OS keychain (not in SQLite)
- Content filters (configurable) for log redaction
- Least-privilege file and shell operations
- Session isolation via git worktrees

## Phase Roadmap

See `scope.md` for the complete phase breakdown (0-12).

- **Phase 0**: ✓ Foundations (this task)
- **Phase 1**: Test Harness
- **Phase 2**: Connectors (Claude Code, Codex CLI, Ollama)
- ... and more

## Development Checklist

- [ ] Install dependencies: `npm install`
- [ ] Run frontend tests: `npm test`
- [ ] Run backend tests: `cd src-tauri && cargo test`
- [ ] Start dev server: `npm run dev`
- [ ] Verify app starts and blank session list appears
- [ ] Check logs show clean initialization

## References

- [Tauri Documentation](https://tauri.app/en/docs/getting-started/beginning-here)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
