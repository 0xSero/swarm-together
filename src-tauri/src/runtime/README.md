## Runtime Orchestrator

The runtime orchestrator provides the core infrastructure for managing multi-agent systems with message passing, scheduling, and safety guardrails.

## Architecture

### Components

1. **Agent Registry**: Tracks all active agents and their configurations
2. **Message Bus**: Routes messages between agents via priority mailboxes
3. **Mailbox System**: Per-agent message queues with priority ordering
4. **Orchestrator**: Main dispatch loop with retry logic and loop guards
5. **Tool Policy**: Permission model for agent tool usage (stubs)

### Message Flow

```
Agent A → Message Bus → Mailbox B → Agent B
         ↓
    Queue Metrics
```

## Agent Types

### Agent Roles

```rust
pub enum AgentRole {
    Coordinator,    // Manages other agents
    Worker,         // Performs tasks
    Reviewer,       // Validates outputs
    Custom(String), // User-defined
}
```

### Agent Status

```rust
pub enum AgentStatus {
    Idle,                          // Ready for work
    Processing,                    // Currently executing
    Waiting,                       // Waiting for response
    Failed { reason: String },     // Error state
}
```

## Message System

### Message Priority

```rust
pub enum MessagePriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}
```

Messages are delivered in priority order (Critical → High → Normal → Low).

### Creating Messages

```rust
let message = AgentMessage::new(from_agent, to_agent, "content".to_string())
    .with_priority(MessagePriority::High);
```

## Orchestrator

### Loop Guards

The orchestrator includes safeguards to prevent runaway execution:

```rust
pub struct LoopGuard {
    pub max_iterations: u32,           // Max dispatch loop iterations
    pub max_messages_per_agent: u32,   // Max messages processed per agent
    pub max_execution_time_ms: u64,    // Max total execution time
}
```

### Stop Reasons

```rust
pub enum StopReason {
    Completed,                              // All messages processed
    MaxIterations,                          // Iteration limit reached
    MaxMessagesPerAgent { agent_id, count },// Per-agent limit reached
    MaxExecutionTime,                       // Timeout
    AgentError { agent_id, error },        // Agent failure
    ManualStop,                             // User stop
}
```

### Retry Logic

Failed operations are retried with exponential backoff:
- Retry 1: 100ms backoff
- Retry 2: 200ms backoff
- Retry 3: 400ms backoff
- ...

## Usage

### Basic Setup

```rust
use agent_manager::runtime::*;
use std::sync::Arc;

// Create registry and message bus
let registry = Arc::new(AgentRegistry::new());
let bus = Arc::new(MessageBus::new());

// Register agents
let config = AgentConfig::new(
    "worker-1".to_string(),
    AgentRole::Worker,
    "claude_code".to_string(),
);
let agent_id = registry.register(config).await;

// Create mailbox
bus.create_mailbox(agent_id).await;

// Create orchestrator with custom guards
let orchestrator = Orchestrator::new(registry, bus)
    .with_loop_guard(LoopGuard {
        max_iterations: 100,
        max_messages_per_agent: 50,
        max_execution_time_ms: 300000,
    });

// Start orchestration
let stop_reason = orchestrator.start().await?;
```

### Multi-Agent Coordination

```rust
// Create multiple agents
let coordinator = registry.register(
    AgentConfig::new("coordinator".to_string(), AgentRole::Coordinator, "claude_code".to_string())
).await;

let worker1 = registry.register(
    AgentConfig::new("worker-1".to_string(), AgentRole::Worker, "codex_cli".to_string())
).await;

let worker2 = registry.register(
    AgentConfig::new("worker-2".to_string(), AgentRole::Worker, "ollama".to_string())
).await;

// Create mailboxes
bus.create_mailbox(coordinator).await;
bus.create_mailbox(worker1).await;
bus.create_mailbox(worker2).await;

// Coordinator sends tasks
let task1 = AgentMessage::new(coordinator, worker1, "Task 1".to_string());
let task2 = AgentMessage::new(coordinator, worker2, "Task 2".to_string());

bus.send(task1).await?;
bus.send(task2).await?;

// Start orchestration
orchestrator.start().await?;
```

### Broadcasting

```rust
// Send message to all agents except sender
let broadcast_msg = AgentMessage::new(
    sender_id,
    sender_id, // to field is overwritten
    "Broadcast message".to_string()
);

let recipients = bus.broadcast(broadcast_msg).await;
```

## Metrics

### Orchestrator Metrics

```rust
pub struct OrchestratorMetrics {
    pub total_iterations: u32,
    pub total_messages: u64,
    pub messages_per_agent: HashMap<AgentId, u32>,
    pub retry_count: u64,
    pub error_count: u64,
    pub queue_depth: usize,
}
```

### Accessing Metrics

```rust
let metrics = orchestrator.metrics().await;

println!("Processed {} messages", metrics.total_messages);
println!("Queue depth: {}", metrics.queue_depth);
println!("Retries: {}", metrics.retry_count);
```

## Tool Policy (Stubs)

Tool policies control agent permissions:

```rust
pub enum PermissionLevel {
    Denied,      // No access
    ReadOnly,    // Read-only access
    ReadWrite,   // Read and write
    Full,        // Full access
}

let policy = ToolPolicy::new("file_system".to_string(), PermissionLevel::ReadWrite)
    .with_rate_limit(100); // Max 100 calls per hour
```

## Tauri Commands

Frontend integration via Tauri commands:

```typescript
import { invoke } from '@tauri-apps/api/tauri'

// Register an agent
const { agent_id } = await invoke('register_agent', {
  request: {
    config: {
      name: 'worker-1',
      role: 'Worker',
      connector_type: 'claude_code',
      max_retries: 3,
      timeout_ms: 300000,
      tool_policies: []
    }
  }
})

// Create orchestrator
await invoke('create_orchestrator', {
  request: {
    max_iterations: 100,
    max_messages_per_agent: 50,
    max_execution_time_ms: 600000
  }
})

// Start orchestrator (async)
const { stop_reason } = await invoke('start_orchestrator')

// Get metrics
const metrics = await invoke('get_orchestrator_metrics')

// Get queue depth
const depth = await invoke('get_queue_depth')

// Stop orchestrator
await invoke('stop_orchestrator')

// List agents
const agents = await invoke('list_agents')

// Unregister agent
await invoke('unregister_agent', { agent_id })
```

## Testing

### Unit Tests

```bash
cd src-tauri
cargo test --lib runtime
```

### Integration Tests

```bash
cd src-tauri
cargo test --test orchestrator_integration_test
```

Test coverage includes:
- Agent registration and lifecycle
- Message routing and priority
- Loop guard enforcement
- Retry logic and exponential backoff
- Multi-agent coordination
- Metrics tracking

## Observability

All operations emit structured logs:

```rust
use tracing::{info, warn, error, debug};

// Logged automatically:
// - Agent registration/unregistration
// - Message send/receive
// - Orchestrator start/stop
// - Loop guard triggers
// - Retry attempts
// - Error conditions
```

### Log Levels

- `info`: Orchestrator lifecycle events
- `warn`: Loop guards triggered, retries
- `error`: Agent failures, critical errors
- `debug`: Message processing, queue operations

## Safety Features

### Loop Guards

Prevent runaway execution:
- **Max Iterations**: Total dispatch loop cycles
- **Max Messages Per Agent**: Prevent single agent monopoly
- **Max Execution Time**: Overall timeout

### Retry with Backoff

Automatic retry with exponential backoff:
- Configurable max retries per agent
- Prevents thundering herd
- Logged for observability

### Graceful Degradation

- Agents can fail without crashing the orchestrator
- Failed agents transition to `Failed` status
- Other agents continue processing

## Future Enhancements

- Tool policy enforcement (currently stubs)
- Agent-to-agent direct communication channels
- Message persistence and replay
- Dynamic agent spawning/despawning
- Resource quotas (CPU, memory, tokens)
- Distributed orchestration across multiple processes
