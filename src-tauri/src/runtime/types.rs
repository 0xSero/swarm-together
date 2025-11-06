use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Agent identifier
pub type AgentId = Uuid;

/// Message identifier
pub type MessageId = Uuid;

/// Agent role in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentRole {
    /// Coordinator agent that manages other agents
    Coordinator,
    /// Worker agent that performs tasks
    Worker,
    /// Reviewer agent that validates outputs
    Reviewer,
    /// Custom role
    Custom(String),
}

/// Agent status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentStatus {
    /// Agent is idle
    Idle,
    /// Agent is processing
    Processing,
    /// Agent is waiting for response
    Waiting,
    /// Agent has failed
    Failed { reason: String },
}

/// Agent metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetadata {
    pub id: AgentId,
    pub name: String,
    pub role: AgentRole,
    pub status: AgentStatus,
    pub connector_type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Message priority
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum MessagePriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

impl Default for MessagePriority {
    fn default() -> Self {
        MessagePriority::Normal
    }
}

/// Message between agents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: MessageId,
    pub from: AgentId,
    pub to: AgentId,
    pub content: String,
    pub priority: MessagePriority,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub metadata: HashMap<String, String>,
}

impl AgentMessage {
    pub fn new(from: AgentId, to: AgentId, content: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            from,
            to,
            content,
            priority: MessagePriority::default(),
            created_at: chrono::Utc::now(),
            metadata: HashMap::new(),
        }
    }

    pub fn with_priority(mut self, priority: MessagePriority) -> Self {
        self.priority = priority;
        self
    }
}

/// Tool permission level
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PermissionLevel {
    /// No access
    Denied,
    /// Read-only access
    ReadOnly,
    /// Read and write access
    ReadWrite,
    /// Full access
    Full,
}

/// Tool permission policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolPolicy {
    pub tool_name: String,
    pub permission: PermissionLevel,
    pub max_calls_per_hour: Option<u32>,
    pub allowed_paths: Option<Vec<String>>,
}

impl ToolPolicy {
    pub fn new(tool_name: String, permission: PermissionLevel) -> Self {
        Self {
            tool_name,
            permission,
            max_calls_per_hour: None,
            allowed_paths: None,
        }
    }

    pub fn with_rate_limit(mut self, max_calls: u32) -> Self {
        self.max_calls_per_hour = Some(max_calls);
        self
    }
}

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub role: AgentRole,
    pub connector_type: String,
    pub max_retries: u32,
    pub timeout_ms: u64,
    pub tool_policies: Vec<ToolPolicy>,
}

impl AgentConfig {
    pub fn new(name: String, role: AgentRole, connector_type: String) -> Self {
        Self {
            name,
            role,
            connector_type,
            max_retries: 3,
            timeout_ms: 300000, // 5 minutes
            tool_policies: Vec::new(),
        }
    }
}
