use crate::connectors::claude_code::ClaudeCodeConnector;
use crate::connectors::types::{ConnectorConfig, ConnectorHealth, ConnectorMetrics};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Shared connector state
pub struct ConnectorState {
    pub claude_code: Arc<Mutex<Option<ClaudeCodeConnector>>>,
}

impl ConnectorState {
    pub fn new() -> Self {
        Self {
            claude_code: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InitConnectorRequest {
    pub connector_type: String,
    pub config: ConnectorConfig,
}

/// Initialize a connector
#[tauri::command]
pub async fn init_connector(
    request: InitConnectorRequest,
    state: State<'_, ConnectorState>,
) -> Result<String, String> {
    match request.connector_type.as_str() {
        "claude_code" => {
            let connector = ClaudeCodeConnector::new(request.config);
            *state.claude_code.lock().await = Some(connector);
            Ok("Claude Code connector initialized".to_string())
        }
        _ => Err(format!("Unknown connector type: {}", request.connector_type)),
    }
}

/// Get connector health
#[tauri::command]
pub async fn get_connector_health(
    connector_type: String,
    state: State<'_, ConnectorState>,
) -> Result<ConnectorHealth, String> {
    match connector_type.as_str() {
        "claude_code" => {
            let guard = state.claude_code.lock().await;
            if let Some(connector) = guard.as_ref() {
                Ok(connector.health().await)
            } else {
                Err("Connector not initialized".to_string())
            }
        }
        _ => Err(format!("Unknown connector type: {}", connector_type)),
    }
}

/// Get connector metrics
#[tauri::command]
pub async fn get_connector_metrics(
    connector_type: String,
    state: State<'_, ConnectorState>,
) -> Result<ConnectorMetrics, String> {
    match connector_type.as_str() {
        "claude_code" => {
            let guard = state.claude_code.lock().await;
            if let Some(connector) = guard.as_ref() {
                Ok(connector.metrics().await)
            } else {
                Err("Connector not initialized".to_string())
            }
        }
        _ => Err(format!("Unknown connector type: {}", connector_type)),
    }
}
