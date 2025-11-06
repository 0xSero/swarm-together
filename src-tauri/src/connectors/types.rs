use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Message types from AI connector streams
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ConnectorMessage {
    /// Text content streamed from the model
    Content { content: String },
    /// Tool call or function invocation
    ToolCall { name: String, args: String },
    /// Error from the connector
    Error { message: String },
    /// Usage/token information
    Usage { input_tokens: u64, output_tokens: u64 },
    /// Stream completed
    Done,
}

/// Configuration for connector spawning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorConfig {
    /// Path to the CLI binary
    pub cli_path: String,
    /// Additional command-line flags
    pub flags: Vec<String>,
    /// Environment variables to pass through
    pub env: HashMap<String, String>,
    /// Timeout in milliseconds (None = no timeout)
    pub timeout_ms: Option<u64>,
    /// Maximum retries on failure
    pub max_retries: u32,
}

impl Default for ConnectorConfig {
    fn default() -> Self {
        Self {
            cli_path: String::from("claude"),
            flags: Vec::new(),
            env: HashMap::new(),
            timeout_ms: Some(300000), // 5 minutes default
            max_retries: 3,
        }
    }
}

/// Health status of a connector
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectorHealth {
    Healthy,
    Degraded { reason: String },
    Unhealthy { reason: String },
}

/// Metrics for connector operations
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConnectorMetrics {
    pub spawn_count: u64,
    pub success_count: u64,
    pub error_count: u64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub avg_response_time_ms: f64,
}
