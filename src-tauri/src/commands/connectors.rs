use crate::connectors::claude_code::ClaudeCodeConnector;
use crate::connectors::codex_cli::{CodexCliConnector, GptModel};
use crate::connectors::ollama::{OllamaConfig, OllamaConnector};
use crate::connectors::types::{ConnectorConfig, ConnectorHealth, ConnectorMetrics};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Shared connector state
pub struct ConnectorState {
    pub claude_code: Arc<Mutex<Option<ClaudeCodeConnector>>>,
    pub codex_cli: Arc<Mutex<Option<CodexCliConnector>>>,
    pub ollama: Arc<Mutex<Option<OllamaConnector>>>,
}

impl ConnectorState {
    pub fn new() -> Self {
        Self {
            claude_code: Arc::new(Mutex::new(None)),
            codex_cli: Arc::new(Mutex::new(None)),
            ollama: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InitConnectorRequest {
    pub connector_type: String,
    pub config: ConnectorConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InitOllamaRequest {
    pub config: OllamaConfig,
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
        "codex_cli" => {
            let connector = CodexCliConnector::new(request.config);
            *state.codex_cli.lock().await = Some(connector);
            Ok("Codex CLI connector initialized".to_string())
        }
        _ => Err(format!("Unknown connector type: {}", request.connector_type)),
    }
}

/// Initialize Ollama connector (uses different config)
#[tauri::command]
pub async fn init_ollama(
    request: InitOllamaRequest,
    state: State<'_, ConnectorState>,
) -> Result<String, String> {
    let connector = OllamaConnector::new(request.config);
    *state.ollama.lock().await = Some(connector);
    Ok("Ollama connector initialized".to_string())
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
        "codex_cli" => {
            let guard = state.codex_cli.lock().await;
            if let Some(connector) = guard.as_ref() {
                Ok(connector.health().await)
            } else {
                Err("Connector not initialized".to_string())
            }
        }
        "ollama" => {
            let guard = state.ollama.lock().await;
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
        "codex_cli" => {
            let guard = state.codex_cli.lock().await;
            if let Some(connector) = guard.as_ref() {
                Ok(connector.metrics().await)
            } else {
                Err("Connector not initialized".to_string())
            }
        }
        "ollama" => {
            let guard = state.ollama.lock().await;
            if let Some(connector) = guard.as_ref() {
                Ok(connector.metrics().await)
            } else {
                Err("Connector not initialized".to_string())
            }
        }
        _ => Err(format!("Unknown connector type: {}", connector_type)),
    }
}

/// Check Ollama health (runs actual health check)
#[tauri::command]
pub async fn check_ollama_health(
    state: State<'_, ConnectorState>,
) -> Result<bool, String> {
    let guard = state.ollama.lock().await;
    if let Some(connector) = guard.as_ref() {
        connector.check_health().await
            .map_err(|e| format!("Health check failed: {}", e))
    } else {
        Err("Ollama connector not initialized".to_string())
    }
}

/// List available Ollama models
#[tauri::command]
pub async fn list_ollama_models(
    state: State<'_, ConnectorState>,
) -> Result<Vec<String>, String> {
    let guard = state.ollama.lock().await;
    if let Some(connector) = guard.as_ref() {
        connector.list_models().await
            .map_err(|e| format!("Failed to list models: {}", e))
    } else {
        Err("Ollama connector not initialized".to_string())
    }
}

/// Switch model for Codex CLI connector
#[tauri::command]
pub async fn switch_codex_model(
    model: String,
    state: State<'_, ConnectorState>,
) -> Result<String, String> {
    let guard = state.codex_cli.lock().await;
    if let Some(connector) = guard.as_ref() {
        let gpt_model = match model.as_str() {
            "gpt-5" => GptModel::Gpt5,
            "gpt-5-codex" => GptModel::Gpt5Codex,
            "gpt-4" => GptModel::Gpt4,
            _ => return Err(format!("Unknown model: {}", model)),
        };
        connector.switch_model(gpt_model).await
            .map_err(|e| format!("Failed to switch model: {}", e))?;
        Ok(format!("Switched to model: {}", model))
    } else {
        Err("Codex CLI connector not initialized".to_string())
    }
}
