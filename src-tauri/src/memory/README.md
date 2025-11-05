## Memory Management System

The memory system provides per-agent ring buffers with automatic summarization and a shared blackboard with semantic recall capabilities.

## Architecture

### Components

1. **Ring Buffer**: Per-agent token-capped circular buffer with automatic eviction
2. **Blackboard**: Shared key-value store with TTL and LRU eviction
3. **Memory Manager**: Coordinates ring buffers and blackboard operations
4. **Embeddings**: Semantic recall via Ollama embeddings

### Memory Flow

```
Agent A → Ring Buffer A (token-capped)
                ↓
         Summarization (when near cap)
                ↓
         Shared Blackboard ← → Semantic Recall
                ↑
Agent B → Ring Buffer B (token-capped)
```

## Ring Buffers

Per-agent memory with token-based capacity limits.

### Features

- **Token-based capacity**: Configurable max tokens per buffer
- **Automatic eviction**: FIFO eviction when over capacity
- **Summarization**: Automatic summarization when usage reaches threshold (default 80%)
- **Isolation**: Each agent has its own independent buffer

### Usage

```rust
use agent_manager::memory::RingBuffer;

// Create buffer with 1000 token capacity
let buffer = RingBuffer::new(1000);

// Add entry
let entry = MemoryEntry::new("Some content".to_string(), 50);
buffer.push(entry).await;

// Check if summarization needed
if buffer.should_summarize().await {
    // Trigger summarization
    buffer.summarize("Summary of all entries".to_string(), 100).await;
}

// Get statistics
let stats = buffer.stats().await;
println!("Usage: {}/{} tokens", stats.total_tokens, buffer.capacity());
```

### Configuration

```rust
let buffer = RingBuffer::new(1000)
    .with_threshold(0.75); // Summarize at 75% capacity
```

## Blackboard

Shared memory accessible by all agents.

### Features

- **TTL Support**: Entries can expire after a set time
- **LRU Eviction**: Least recently used entries evicted when at capacity
- **Semantic Recall**: Find similar entries using embeddings
- **Access Tracking**: Hit/miss statistics and access counts

### Usage

```rust
use agent_manager::memory::Blackboard;

// Create blackboard with max 100 entries
let bb = Blackboard::new(100);

// Put entry with TTL
let entry = BlackboardEntry::new("status".to_string(), "processing".to_string())
    .with_ttl(3600); // Expires in 1 hour

bb.put(entry).await;

// Get entry
if let Some(entry) = bb.get("status").await {
    println!("Status: {}", entry.value);
}

// Semantic recall (with embeddings)
let query_embedding = vec![0.1, 0.2, 0.3, ...];
let similar = bb.recall(&query_embedding, 5).await;
```

### TTL Behavior

- Entries with `expires_at` are automatically filtered on access
- Expired entries don't count toward capacity
- Cleanup happens lazily on operations

### LRU Eviction

When at capacity:
1. Expired entries removed first
2. If still at capacity, evict least recently used entry
3. Access via `get()` updates `last_accessed` timestamp

## Memory Manager

Coordinates per-agent buffers and shared blackboard.

### Features

- **Agent Buffer Management**: Create/remove per-agent buffers
- **Blackboard Integration**: Add/get from shared memory
- **Embedding Integration**: Generate embeddings via Ollama
- **Automatic Summarization**: Triggered when buffers near capacity
- **Statistics**: Per-agent and blackboard metrics

### Usage

```rust
use agent_manager::memory::MemoryManager;
use agent_manager::connectors::ollama::OllamaConnector;
use std::sync::Arc;

// Create manager
let manager = MemoryManager::new(100); // Blackboard capacity

// Optional: Add embeddings support
let ollama = Arc::new(OllamaConnector::new(ollama_config));
let manager = manager.with_embeddings(ollama);

// Create agent buffer
let agent_id = uuid::Uuid::new_v4();
manager.create_agent_buffer(agent_id, 1000).await; // 1000 token capacity

// Add to agent's buffer
let entry = MemoryEntry::new("Task completed".to_string(), 20);
manager.add_to_agent(agent_id, entry).await?;

// Add to blackboard (with embedding)
manager.add_to_blackboard(
    "result".to_string(),
    "Task A completed successfully".to_string(),
    true // Generate embedding
).await?;

// Semantic recall
let results = manager.recall("completed tasks", 5).await?;
```

## Semantic Recall

Find semantically similar entries using embeddings.

### Requirements

- Ollama connector configured
- Embedding model available (default: nomic-embed-text)

### How It Works

1. **Indexing**: Entries added to blackboard can have embeddings generated
2. **Query**: Query text is converted to embedding
3. **Search**: Cosine similarity computed against all indexed entries
4. **Ranking**: Top-k most similar entries returned

### Example

```rust
// Add entries with embeddings
manager.add_to_blackboard(
    "doc1".to_string(),
    "Information about machine learning".to_string(),
    true
).await?;

manager.add_to_blackboard(
    "doc2".to_string(),
    "Information about deep learning".to_string(),
    true
).await?;

// Semantic search
let results = manager.recall("neural networks", 2).await?;
// Returns: doc2, doc1 (in order of similarity)
```

### Similarity Metric

Uses cosine similarity:
```
similarity = (A · B) / (||A|| * ||B||)
```

Where:
- A, B are embedding vectors
- · is dot product
- ||·|| is vector magnitude
- Result in range [-1, 1], typically [0, 1] for embeddings

## Summarization

Automatic compression of agent memory when nearing capacity.

### Trigger Conditions

- Buffer usage reaches threshold (default: 80% of capacity)
- Checked after every `add_to_agent()` call

### Summarization Process

1. Retrieve all entries from buffer
2. Concatenate content
3. Generate summary (stub: first/last parts; production: LLM call)
4. Replace buffer with summary entry
5. Update statistics

### Configuration

```rust
let buffer = RingBuffer::new(1000)
    .with_threshold(0.75); // Trigger at 75% capacity
```

## Statistics

### Memory Stats (Per-Agent)

```rust
pub struct MemoryStats {
    pub total_entries: usize,
    pub total_tokens: u32,
    pub summarization_count: u64,
    pub eviction_count: u64,
    pub capacity: u32,
}
```

### Blackboard Stats

```rust
pub struct BlackboardStats {
    pub total_entries: usize,
    pub expired_entries: usize,
    pub total_accesses: u64,
    pub eviction_count: u64,
    pub hit_count: u64,
    pub miss_count: u64,
    pub avg_recall_latency_ms: f64,
}
```

## Testing

### Unit Tests

```bash
cd src-tauri
cargo test --lib memory
```

Test coverage:
- Ring buffer capacity enforcement
- Eviction order (FIFO)
- Summarization triggers
- Blackboard TTL
- LRU eviction
- Cosine similarity
- Access tracking

### Integration Tests

```bash
cd src-tauri
cargo test --test memory_integration_test
```

Test scenarios:
- Two agents sharing via blackboard
- Memory trimming when near cap
- Agent isolation
- TTL expiration
- LRU eviction with multiple agents
- Statistics tracking

## Examples

### Multi-Agent Coordination

```rust
let manager = Arc::new(MemoryManager::new(100));

let agent1 = uuid::Uuid::new_v4();
let agent2 = uuid::Uuid::new_v4();

// Agent 1 creates buffer
manager.create_agent_buffer(agent1, 1000).await;

// Agent 1 writes local memory
manager.add_to_agent(
    agent1,
    MemoryEntry::new("Processing task A".to_string(), 30)
).await?;

// Agent 1 shares result to blackboard
manager.add_to_blackboard(
    "task_a_result".to_string(),
    "Task A completed with 95% accuracy".to_string(),
    true // Generate embedding
).await?;

// Agent 2 creates buffer
manager.create_agent_buffer(agent2, 1000).await;

// Agent 2 recalls relevant info from blackboard
let relevant = manager.recall("task completion", 3).await?;

// Agent 2 uses info and writes to own buffer
for entry in relevant {
    manager.add_to_agent(
        agent2,
        MemoryEntry::new(
            format!("Learned from: {}", entry.value),
            20
        )
    ).await?;
}
```

## Observability

All operations emit structured logs:

```rust
use tracing::{info, debug, warn};

// Logged automatically:
// - Buffer creation/removal
// - Summarization triggers
// - Eviction events
// - Blackboard access (hit/miss)
// - Embedding generation
// - Recall latency
```

### Log Levels

- `info`: Summarization events, major operations
- `debug`: Evictions, blackboard access
- `warn`: Capacity issues, failed operations

## Performance Considerations

### Memory Usage

- Ring buffers: O(n) where n is number of entries
- Blackboard: O(m) where m is number of keys
- Embeddings: O(d) per entry where d is embedding dimension

### Recall Latency

- Linear scan: O(m * d) for m entries with dimension d
- For large blackboards (>1000 entries), consider:
  - Approximate nearest neighbor search (ANN)
  - Vector databases (Qdrant, Weaviate)
  - Batch recall operations

### Token Counting

Current implementation uses rough approximation (1 token ≈ 4 characters).

For production:
- Integrate with tokenizer (tiktoken, sentencepiece)
- Per-model token counting
- Accurate token budgets

## Future Enhancements

- LLM-based summarization (currently stub)
- Persistent storage (SQLite, file system)
- Vector database integration for large-scale recall
- Memory hierarchy (L1/L2 caches)
- Cross-session memory
- Memory snapshots and replay
- Hierarchical summarization
- Adaptive thresholds based on usage patterns
