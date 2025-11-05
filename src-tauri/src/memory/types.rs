use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use uuid::Uuid;

/// Memory entry identifier
pub type EntryId = Uuid;

/// Memory entry in a ring buffer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: EntryId,
    pub content: String,
    pub token_count: u32,
    pub timestamp: SystemTime,
    pub metadata: std::collections::HashMap<String, String>,
}

impl MemoryEntry {
    pub fn new(content: String, token_count: u32) -> Self {
        Self {
            id: Uuid::new_v4(),
            content,
            token_count,
            timestamp: SystemTime::now(),
            metadata: std::collections::HashMap::new(),
        }
    }

    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

/// Blackboard entry with TTL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlackboardEntry {
    pub id: EntryId,
    pub key: String,
    pub value: String,
    pub embedding: Option<Vec<f32>>,
    pub created_at: SystemTime,
    pub expires_at: Option<SystemTime>,
    pub last_accessed: SystemTime,
    pub access_count: u64,
}

impl BlackboardEntry {
    pub fn new(key: String, value: String) -> Self {
        let now = SystemTime::now();
        Self {
            id: Uuid::new_v4(),
            key,
            value,
            embedding: None,
            created_at: now,
            expires_at: None,
            last_accessed: now,
            access_count: 0,
        }
    }

    pub fn with_ttl(mut self, ttl_seconds: u64) -> Self {
        self.expires_at = Some(
            SystemTime::now() + std::time::Duration::from_secs(ttl_seconds)
        );
        self
    }

    pub fn with_embedding(mut self, embedding: Vec<f32>) -> Self {
        self.embedding = Some(embedding);
        self
    }

    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            SystemTime::now() > expires_at
        } else {
            false
        }
    }

    pub fn touch(&mut self) {
        self.last_accessed = SystemTime::now();
        self.access_count += 1;
    }
}

/// Memory statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MemoryStats {
    pub total_entries: usize,
    pub total_tokens: u32,
    pub summarization_count: u64,
    pub eviction_count: u64,
    pub capacity: u32,
}

/// Blackboard statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BlackboardStats {
    pub total_entries: usize,
    pub expired_entries: usize,
    pub total_accesses: u64,
    pub eviction_count: u64,
    pub hit_count: u64,
    pub miss_count: u64,
    pub avg_recall_latency_ms: f64,
}
