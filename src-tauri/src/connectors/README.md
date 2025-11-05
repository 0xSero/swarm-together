# Connectors

This module provides adapters for various AI CLI tools to integrate them into the Agent Manager system.

## Architecture

Each connector provides:
- **Spawn/Stream Wrapper**: Manages CLI process lifecycle and streams output
- **Error Handling**: Comprehensive error handling with retries and exponential backoff
- **Timeouts**: Configurable timeouts to prevent hanging operations
- **Cancellation**: Support for cancelling long-running operations
- **Health Monitoring**: Health status tracking (Healthy, Degraded, Unhealthy)
- **Metrics**: Performance and usage tracking

## Available Connectors

### Claude Code CLI (Headless)

Adapter for Claude Code CLI running in headless mode.

**Features:**
- Stream stdout/stderr from the CLI process
- Parse JSON-formatted messages and plain text output
- Track token usage from CLI output
- Automatic retry with exponential backoff
- Configurable timeouts and environment variables
- Health status monitoring

**Configuration:**

```rust
use agent_manager::connectors::{ConnectorConfig, claude_code::ClaudeCodeConnector};
use std::collections::HashMap;

let config = ConnectorConfig {
    cli_path: "/path/to/claude".to_string(),
    flags: vec!["--headless".to_string()],
    env: HashMap::new(),
    timeout_ms: Some(300000), // 5 minutes
    max_retries: 3,
};

let connector = ClaudeCodeConnector::new(config);
```

**Usage:**

```rust
// Execute a prompt and receive messages
let mut rx = connector.execute("Write a hello world function").await?;

while let Some(msg) = rx.recv().await {
    match msg {
        ConnectorMessage::Content { content } => {
            println!("Content: {}", content);
        }
        ConnectorMessage::Usage { input_tokens, output_tokens } => {
            println!("Tokens: {} in, {} out", input_tokens, output_tokens);
        }
        ConnectorMessage::Error { message } => {
            eprintln!("Error: {}", message);
        }
        ConnectorMessage::Done => break,
        _ => {}
    }
}
```

**Message Types:**

- `Content { content }`: Text content from the model
- `ToolCall { name, args }`: Tool invocation (reserved for future use)
- `Error { message }`: Error from the connector
- `Usage { input_tokens, output_tokens }`: Token usage information
- `Done`: Stream completed

**Health & Metrics:**

```rust
// Check connector health
let health = connector.health().await;

// Get metrics
let metrics = connector.metrics().await;
println!("Success rate: {}/{}",
    metrics.success_count,
    metrics.spawn_count
);
println!("Avg response time: {}ms", metrics.avg_response_time_ms);
```

## Testing

### Unit Tests

Run unit tests for output parsing and message handling:

```bash
cd src-tauri
cargo test --lib connectors
```

### Integration Tests

Integration tests spawn stub CLI scripts to test the full lifecycle:

```bash
cd src-tauri
cargo test --test claude_code_connector_test
```

Test coverage includes:
- Spawn and stream lifecycle
- Timeout handling
- Retry logic with exponential backoff
- Graceful cancellation
- Usage tracking
- Health status updates

## Observability

All connectors emit structured logs and metrics:

- **Spawn events**: Process start and configuration
- **Stream throughput**: Bytes/messages processed
- **Exit codes**: Process termination status
- **Error taxonomy**: Categorized error types
- **Health transitions**: Changes in connector health status
- **Performance metrics**: Response times, token counts

## Error Handling

Connectors use typed errors with automatic retries:

```rust
pub enum ClaudeCodeError {
    SpawnError(String),      // Failed to start process
    ProcessTerminated(String), // Process exited unexpectedly
    Timeout,                 // Operation timed out
    ParseError(String),      // Failed to parse output
    IoError(std::io::Error), // I/O operation failed
    MaxRetriesExceeded,      // All retries exhausted
}
```

Retry behavior:
- Exponential backoff: 100ms, 200ms, 400ms, ...
- Configurable max retries (default: 3)
- Health status updated on failures

## Future Connectors

- **Codex CLI (GPT-5)**: Planned in task 021
- **Ollama Chat + Embeddings**: Planned in task 022

## Tauri Commands

Frontend can interact with connectors via Tauri commands:

```typescript
import { invoke } from '@tauri-apps/api/tauri'

// Initialize connector
await invoke('init_connector', {
  request: {
    connector_type: 'claude_code',
    config: {
      cli_path: '/usr/local/bin/claude',
      flags: ['--headless'],
      env: {},
      timeout_ms: 300000,
      max_retries: 3
    }
  }
})

// Get health status
const health = await invoke('get_connector_health', {
  connector_type: 'claude_code'
})

// Get metrics
const metrics = await invoke('get_connector_metrics', {
  connector_type: 'claude_code'
})
```
