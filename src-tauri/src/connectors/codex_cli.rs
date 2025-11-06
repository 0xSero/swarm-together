use super::types::{ConnectorConfig, ConnectorHealth, ConnectorMessage, ConnectorMetrics};
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{mpsc, Mutex};
use tokio::time::timeout;

/// Errors specific to Codex CLI connector
#[derive(Debug, thiserror::Error)]
pub enum CodexCliError {
    #[error("Failed to spawn CLI process: {0}")]
    SpawnError(String),
    #[error("Process terminated unexpectedly: {0}")]
    ProcessTerminated(String),
    #[error("Timeout waiting for response")]
    Timeout,
    #[error("Failed to parse output: {0}")]
    ParseError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Max retries exceeded")]
    MaxRetriesExceeded,
    #[error("Model switch failed: {0}")]
    ModelSwitchError(String),
}

pub type Result<T> = std::result::Result<T, CodexCliError>;

/// Supported GPT models
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GptModel {
    #[serde(rename = "gpt-5")]
    Gpt5,
    #[serde(rename = "gpt-5-codex")]
    Gpt5Codex,
    #[serde(rename = "gpt-4")]
    Gpt4,
}

impl GptModel {
    pub fn as_str(&self) -> &str {
        match self {
            GptModel::Gpt5 => "gpt-5",
            GptModel::Gpt5Codex => "gpt-5-codex",
            GptModel::Gpt4 => "gpt-4",
        }
    }
}

/// Codex CLI connector for GPT-5 and GPT-5-Codex
pub struct CodexCliConnector {
    config: ConnectorConfig,
    current_model: Arc<Mutex<GptModel>>,
    metrics: Arc<Mutex<ConnectorMetrics>>,
    health: Arc<Mutex<ConnectorHealth>>,
}

impl CodexCliConnector {
    /// Create a new Codex CLI connector with default model (GPT-5)
    pub fn new(config: ConnectorConfig) -> Self {
        Self::new_with_model(config, GptModel::Gpt5)
    }

    /// Create a new Codex CLI connector with a specific model
    pub fn new_with_model(config: ConnectorConfig, model: GptModel) -> Self {
        Self {
            config,
            current_model: Arc::new(Mutex::new(model)),
            metrics: Arc::new(Mutex::new(ConnectorMetrics::default())),
            health: Arc::new(Mutex::new(ConnectorHealth::Healthy)),
        }
    }

    /// Get current health status
    pub async fn health(&self) -> ConnectorHealth {
        self.health.lock().await.clone()
    }

    /// Get current metrics
    pub async fn metrics(&self) -> ConnectorMetrics {
        self.metrics.lock().await.clone()
    }

    /// Get current model
    pub async fn current_model(&self) -> GptModel {
        self.current_model.lock().await.clone()
    }

    /// Switch to a different model
    pub async fn switch_model(&self, model: GptModel) -> Result<()> {
        *self.current_model.lock().await = model;
        Ok(())
    }

    /// Execute a prompt and stream responses
    pub async fn execute(
        &self,
        prompt: &str,
    ) -> Result<mpsc::Receiver<ConnectorMessage>> {
        let (tx, rx) = mpsc::channel(100);

        let mut retries = 0;
        let max_retries = self.config.max_retries;

        loop {
            match self.try_execute(prompt, tx.clone()).await {
                Ok(_) => {
                    self.update_metrics(true).await;
                    self.update_health(ConnectorHealth::Healthy).await;
                    break Ok(rx);
                }
                Err(e) => {
                    retries += 1;
                    self.update_metrics(false).await;

                    if retries >= max_retries {
                        self.update_health(ConnectorHealth::Unhealthy {
                            reason: format!("Max retries exceeded: {}", e),
                        }).await;
                        return Err(CodexCliError::MaxRetriesExceeded);
                    }

                    // Exponential backoff
                    let backoff = Duration::from_millis(100 * 2_u64.pow(retries - 1));
                    tokio::time::sleep(backoff).await;
                }
            }
        }
    }

    /// Single execution attempt
    async fn try_execute(
        &self,
        prompt: &str,
        tx: mpsc::Sender<ConnectorMessage>,
    ) -> Result<()> {
        let start = Instant::now();

        // Spawn the CLI process
        let mut child = self.spawn_process().await?;

        // Get stdin to send commands
        let mut stdin = child.stdin.take().ok_or_else(|| {
            CodexCliError::SpawnError("Failed to capture stdin".to_string())
        })?;

        // Send model switch command if needed
        let model = self.current_model.lock().await.clone();
        let model_cmd = format!("/model {}\n", model.as_str());
        stdin.write_all(model_cmd.as_bytes()).await?;

        // Send the actual prompt
        stdin.write_all(prompt.as_bytes()).await?;
        stdin.write_all(b"\n").await?;
        stdin.flush().await?;
        drop(stdin); // Close stdin to signal end of input

        // Stream stdout and stderr
        let stdout = child.stdout.take().ok_or_else(|| {
            CodexCliError::SpawnError("Failed to capture stdout".to_string())
        })?;

        let stderr = child.stderr.take().ok_or_else(|| {
            CodexCliError::SpawnError("Failed to capture stderr".to_string())
        })?;

        // Spawn tasks to read stdout and stderr
        let tx_stdout = tx.clone();
        let stdout_task = tokio::spawn(async move {
            Self::stream_output(stdout, tx_stdout).await
        });

        let tx_stderr = tx.clone();
        let stderr_task = tokio::spawn(async move {
            Self::stream_errors(stderr, tx_stderr).await
        });

        // Wait for process to complete with optional timeout
        let wait_future = child.wait();
        let result = if let Some(timeout_ms) = self.config.timeout_ms {
            timeout(Duration::from_millis(timeout_ms), wait_future)
                .await
                .map_err(|_| CodexCliError::Timeout)?
        } else {
            wait_future.await
        };

        // Wait for streaming tasks to complete
        let _ = tokio::join!(stdout_task, stderr_task);

        // Send done message
        let _ = tx.send(ConnectorMessage::Done).await;

        // Check exit status
        match result {
            Ok(status) if status.success() => {
                let elapsed = start.elapsed();
                self.update_response_time(elapsed.as_millis() as f64).await;
                Ok(())
            }
            Ok(status) => Err(CodexCliError::ProcessTerminated(
                format!("Exit code: {:?}", status.code())
            )),
            Err(e) => Err(CodexCliError::IoError(e)),
        }
    }

    /// Spawn the CLI process with configured settings
    async fn spawn_process(&self) -> Result<Child> {
        let mut cmd = Command::new(&self.config.cli_path);

        // Add flags (could include --interactive or --headless)
        for flag in &self.config.flags {
            cmd.arg(flag);
        }

        // Set environment variables
        for (key, value) in &self.config.env {
            cmd.env(key, value);
        }

        // Configure stdio
        cmd.stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped());

        // Spawn
        cmd.spawn()
            .map_err(|e| CodexCliError::SpawnError(e.to_string()))
    }

    /// Stream and parse stdout
    async fn stream_output<R: tokio::io::AsyncRead + Unpin>(
        reader: R,
        tx: mpsc::Sender<ConnectorMessage>,
    ) {
        let mut lines = BufReader::new(reader).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(msg) = Self::parse_output_line(&line) {
                let _ = tx.send(msg).await;
            }
        }
    }

    /// Stream and parse stderr
    async fn stream_errors<R: tokio::io::AsyncRead + Unpin>(
        reader: R,
        tx: mpsc::Sender<ConnectorMessage>,
    ) {
        let mut lines = BufReader::new(reader).lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = tx.send(ConnectorMessage::Error {
                message: line,
            }).await;
        }
    }

    /// Parse a single output line into a ConnectorMessage
    fn parse_output_line(line: &str) -> Option<ConnectorMessage> {
        // Try to parse as JSON first (for structured output)
        if let Ok(msg) = serde_json::from_str::<ConnectorMessage>(line) {
            return Some(msg);
        }

        // Check for usage object from OpenAI format
        if line.contains("\"usage\"") || line.contains("completion_tokens") {
            if let Some(usage) = Self::parse_openai_usage(line) {
                return Some(usage);
            }
        }

        // Check for simple token patterns
        if line.contains("tokens") {
            if let Some(usage) = Self::parse_usage(line) {
                return Some(usage);
            }
        }

        // Default: treat as content
        if !line.trim().is_empty() && !line.starts_with('/') {
            Some(ConnectorMessage::Content {
                content: line.to_string(),
            })
        } else {
            None
        }
    }

    /// Parse OpenAI usage object format
    fn parse_openai_usage(line: &str) -> Option<ConnectorMessage> {
        // Try to parse as JSON with usage object
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
            if let Some(usage) = json.get("usage") {
                let prompt_tokens = usage.get("prompt_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);
                let completion_tokens = usage.get("completion_tokens")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0);

                if prompt_tokens > 0 || completion_tokens > 0 {
                    return Some(ConnectorMessage::Usage {
                        input_tokens: prompt_tokens,
                        output_tokens: completion_tokens,
                    });
                }
            }
        }
        None
    }

    /// Parse simple usage patterns from output line
    fn parse_usage(line: &str) -> Option<ConnectorMessage> {
        let mut input_tokens = 0u64;
        let mut output_tokens = 0u64;

        let parts: Vec<&str> = line.split(&[',', ' ', ':']).collect();

        for i in 0..parts.len() {
            if parts[i].contains("input") || parts[i].contains("prompt") {
                if let Some(next) = parts.get(i + 1) {
                    if let Ok(num) = next.parse::<u64>() {
                        input_tokens = num;
                    }
                }
            } else if parts[i].contains("output") || parts[i].contains("completion") {
                if let Some(next) = parts.get(i + 1) {
                    if let Ok(num) = next.parse::<u64>() {
                        output_tokens = num;
                    }
                }
            }
        }

        if input_tokens > 0 || output_tokens > 0 {
            Some(ConnectorMessage::Usage {
                input_tokens,
                output_tokens,
            })
        } else {
            None
        }
    }

    /// Update metrics after execution
    async fn update_metrics(&self, success: bool) {
        let mut metrics = self.metrics.lock().await;
        metrics.spawn_count += 1;
        if success {
            metrics.success_count += 1;
        } else {
            metrics.error_count += 1;
        }
    }

    /// Update response time metric
    async fn update_response_time(&self, elapsed_ms: f64) {
        let mut metrics = self.metrics.lock().await;
        let n = metrics.spawn_count as f64;
        metrics.avg_response_time_ms =
            (metrics.avg_response_time_ms * (n - 1.0) + elapsed_ms) / n;
    }

    /// Update health status
    async fn update_health(&self, health: ConnectorHealth) {
        *self.health.lock().await = health;
    }

    /// Update token usage in metrics
    pub async fn record_usage(&self, input_tokens: u64, output_tokens: u64) {
        let mut metrics = self.metrics.lock().await;
        metrics.total_input_tokens += input_tokens;
        metrics.total_output_tokens += output_tokens;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_serialization() {
        assert_eq!(GptModel::Gpt5.as_str(), "gpt-5");
        assert_eq!(GptModel::Gpt5Codex.as_str(), "gpt-5-codex");
        assert_eq!(GptModel::Gpt4.as_str(), "gpt-4");
    }

    #[test]
    fn test_parse_openai_usage() {
        let line = r#"{"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}"#;
        let msg = CodexCliConnector::parse_openai_usage(line);

        assert!(msg.is_some());
        if let Some(ConnectorMessage::Usage { input_tokens, output_tokens }) = msg {
            assert_eq!(input_tokens, 100);
            assert_eq!(output_tokens, 50);
        } else {
            panic!("Expected Usage message");
        }
    }

    #[test]
    fn test_parse_usage() {
        let line = "prompt: 100 tokens, completion: 50 tokens";
        let msg = CodexCliConnector::parse_usage(line);

        assert!(msg.is_some());
        if let Some(ConnectorMessage::Usage { input_tokens, output_tokens }) = msg {
            assert_eq!(input_tokens, 100);
            assert_eq!(output_tokens, 50);
        } else {
            panic!("Expected Usage message");
        }
    }

    #[test]
    fn test_parse_json_message() {
        let line = r#"{"type":"content","content":"Hello from GPT-5"}"#;
        let msg = CodexCliConnector::parse_output_line(line);

        assert!(msg.is_some());
        if let Some(ConnectorMessage::Content { content }) = msg {
            assert_eq!(content, "Hello from GPT-5");
        } else {
            panic!("Expected Content message");
        }
    }

    #[tokio::test]
    async fn test_connector_creation() {
        let config = ConnectorConfig::default();
        let connector = CodexCliConnector::new(config);

        assert_eq!(connector.health().await, ConnectorHealth::Healthy);
        assert_eq!(connector.current_model().await, GptModel::Gpt5);
    }

    #[tokio::test]
    async fn test_model_switch() {
        let config = ConnectorConfig::default();
        let connector = CodexCliConnector::new(config);

        assert_eq!(connector.current_model().await, GptModel::Gpt5);

        connector.switch_model(GptModel::Gpt5Codex).await.unwrap();
        assert_eq!(connector.current_model().await, GptModel::Gpt5Codex);
    }

    #[tokio::test]
    async fn test_record_usage() {
        let config = ConnectorConfig::default();
        let connector = CodexCliConnector::new(config);

        connector.record_usage(200, 100).await;

        let metrics = connector.metrics().await;
        assert_eq!(metrics.total_input_tokens, 200);
        assert_eq!(metrics.total_output_tokens, 100);
    }
}
