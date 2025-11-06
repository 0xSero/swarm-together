use super::types::{ConnectorHealth, ConnectorMessage, ConnectorMetrics};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, Mutex};
use tokio::time::timeout;

/// Errors specific to Ollama connector
#[derive(Debug, thiserror::Error)]
pub enum OllamaError {
    #[error("Failed to connect to Ollama: {0}")]
    ConnectionError(String),
    #[error("HTTP request failed: {0}")]
    RequestError(String),
    #[error("Timeout waiting for response")]
    Timeout,
    #[error("Failed to parse response: {0}")]
    ParseError(String),
    #[error("Model not available: {0}")]
    ModelNotAvailable(String),
    #[error("Max retries exceeded")]
    MaxRetriesExceeded,
}

pub type Result<T> = std::result::Result<T, OllamaError>;

/// Configuration for Ollama connector
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaConfig {
    /// Host address (default: http://localhost)
    pub host: String,
    /// Port (default: 11434)
    pub port: u16,
    /// Timeout in milliseconds
    pub timeout_ms: u64,
    /// Maximum retries on failure
    pub max_retries: u32,
    /// Chat model to use (default: llama2)
    pub chat_model: String,
    /// Embedding model to use (default: nomic-embed-text)
    pub embedding_model: String,
}

impl Default for OllamaConfig {
    fn default() -> Self {
        Self {
            host: "http://localhost".to_string(),
            port: 11434,
            timeout_ms: 300000, // 5 minutes
            max_retries: 3,
            chat_model: "llama2".to_string(),
            embedding_model: "nomic-embed-text".to_string(),
        }
    }
}

/// Chat completion request
#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    prompt: String,
    stream: bool,
}

/// Chat completion response
#[derive(Debug, Deserialize)]
struct ChatResponse {
    model: String,
    response: String,
    #[serde(default)]
    done: bool,
    #[serde(default)]
    total_duration: Option<u64>,
    #[serde(default)]
    prompt_eval_count: Option<u64>,
    #[serde(default)]
    eval_count: Option<u64>,
}

/// Embedding request
#[derive(Debug, Serialize)]
struct EmbeddingRequest {
    model: String,
    prompt: String,
}

/// Embedding response
#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>,
}

/// Model list response
#[derive(Debug, Deserialize)]
struct ModelListResponse {
    models: Vec<ModelInfo>,
}

#[derive(Debug, Deserialize)]
struct ModelInfo {
    name: String,
    size: u64,
}

/// Ollama connector for chat and embeddings
pub struct OllamaConnector {
    config: OllamaConfig,
    metrics: Arc<Mutex<ConnectorMetrics>>,
    health: Arc<Mutex<ConnectorHealth>>,
}

impl OllamaConnector {
    /// Create a new Ollama connector with the given configuration
    pub fn new(config: OllamaConfig) -> Self {
        Self {
            config,
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

    /// Base URL for the Ollama API
    fn base_url(&self) -> String {
        format!("{}:{}", self.config.host, self.config.port)
    }

    /// Check if Ollama server is available
    pub async fn check_health(&self) -> Result<bool> {
        let url = format!("{}/api/tags", self.base_url());

        match self.make_request::<(), ModelListResponse>(&url, None, "GET").await {
            Ok(_) => {
                self.update_health(ConnectorHealth::Healthy).await;
                Ok(true)
            }
            Err(e) => {
                self.update_health(ConnectorHealth::Unhealthy {
                    reason: format!("Health check failed: {}", e),
                }).await;
                Ok(false)
            }
        }
    }

    /// List available models
    pub async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/api/tags", self.base_url());
        let response = self.make_request::<(), ModelListResponse>(&url, None, "GET").await?;
        Ok(response.models.into_iter().map(|m| m.name).collect())
    }

    /// Execute a chat completion
    pub async fn chat(&self, prompt: &str) -> Result<mpsc::Receiver<ConnectorMessage>> {
        let (tx, rx) = mpsc::channel(100);

        let prompt = prompt.to_string();
        let config = self.config.clone();
        let metrics = self.metrics.clone();
        let health = self.health.clone();

        tokio::spawn(async move {
            let start = Instant::now();

            match Self::execute_chat(&config, &prompt, tx.clone()).await {
                Ok((input_tokens, output_tokens)) => {
                    let mut m = metrics.lock().await;
                    m.spawn_count += 1;
                    m.success_count += 1;
                    m.total_input_tokens += input_tokens;
                    m.total_output_tokens += output_tokens;

                    let elapsed = start.elapsed().as_millis() as f64;
                    let n = m.spawn_count as f64;
                    m.avg_response_time_ms = (m.avg_response_time_ms * (n - 1.0) + elapsed) / n;

                    *health.lock().await = ConnectorHealth::Healthy;
                }
                Err(e) => {
                    let mut m = metrics.lock().await;
                    m.spawn_count += 1;
                    m.error_count += 1;

                    *health.lock().await = ConnectorHealth::Degraded {
                        reason: format!("Chat failed: {}", e),
                    };

                    let _ = tx.send(ConnectorMessage::Error {
                        message: format!("Chat error: {}", e),
                    }).await;
                }
            }

            let _ = tx.send(ConnectorMessage::Done).await;
        });

        Ok(rx)
    }

    /// Internal chat execution with retry logic
    async fn execute_chat(
        config: &OllamaConfig,
        prompt: &str,
        tx: mpsc::Sender<ConnectorMessage>,
    ) -> Result<(u64, u64)> {
        let url = format!("{}:{}/api/generate", config.host, config.port);

        let request = ChatRequest {
            model: config.chat_model.clone(),
            prompt: prompt.to_string(),
            stream: false,
        };

        let client = reqwest::Client::new();
        let response = timeout(
            Duration::from_millis(config.timeout_ms),
            client.post(&url).json(&request).send()
        )
        .await
        .map_err(|_| OllamaError::Timeout)?
        .map_err(|e| OllamaError::RequestError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(OllamaError::RequestError(
                format!("HTTP {}", response.status())
            ));
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| OllamaError::ParseError(e.to_string()))?;

        // Send content
        let _ = tx.send(ConnectorMessage::Content {
            content: chat_response.response,
        }).await;

        // Send usage if available
        let input_tokens = chat_response.prompt_eval_count.unwrap_or(0);
        let output_tokens = chat_response.eval_count.unwrap_or(0);

        if input_tokens > 0 || output_tokens > 0 {
            let _ = tx.send(ConnectorMessage::Usage {
                input_tokens,
                output_tokens,
            }).await;
        }

        Ok((input_tokens, output_tokens))
    }

    /// Generate embeddings for text
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let url = format!("{}/api/embeddings", self.base_url());

        let request = EmbeddingRequest {
            model: self.config.embedding_model.clone(),
            prompt: text.to_string(),
        };

        let start = Instant::now();
        let response = self.make_request::<EmbeddingRequest, EmbeddingResponse>(
            &url,
            Some(request),
            "POST"
        ).await?;

        // Update metrics
        let elapsed = start.elapsed().as_millis() as f64;
        let mut metrics = self.metrics.lock().await;
        metrics.spawn_count += 1;
        metrics.success_count += 1;

        let n = metrics.spawn_count as f64;
        metrics.avg_response_time_ms = (metrics.avg_response_time_ms * (n - 1.0) + elapsed) / n;

        Ok(response.embedding)
    }

    /// Generic HTTP request helper with retries
    async fn make_request<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: Option<Req>,
        method: &str,
    ) -> Result<Res> {
        let mut retries = 0;
        let max_retries = self.config.max_retries;

        loop {
            match self.try_request(url, body.as_ref(), method).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    retries += 1;
                    if retries >= max_retries {
                        self.update_health(ConnectorHealth::Unhealthy {
                            reason: format!("Max retries exceeded: {}", e),
                        }).await;
                        return Err(OllamaError::MaxRetriesExceeded);
                    }

                    // Exponential backoff
                    let backoff = Duration::from_millis(100 * 2_u64.pow(retries - 1));
                    tokio::time::sleep(backoff).await;
                }
            }
        }
    }

    /// Single request attempt
    async fn try_request<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        url: &str,
        body: Option<&Req>,
        method: &str,
    ) -> Result<Res> {
        let client = reqwest::Client::new();

        let request = match method {
            "GET" => client.get(url),
            "POST" => {
                let mut req = client.post(url);
                if let Some(b) = body {
                    req = req.json(b);
                }
                req
            }
            _ => return Err(OllamaError::RequestError("Unsupported method".to_string())),
        };

        let response = timeout(
            Duration::from_millis(self.config.timeout_ms),
            request.send()
        )
        .await
        .map_err(|_| OllamaError::Timeout)?
        .map_err(|e| OllamaError::ConnectionError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(OllamaError::RequestError(
                format!("HTTP {}", response.status())
            ));
        }

        response
            .json()
            .await
            .map_err(|e| OllamaError::ParseError(e.to_string()))
    }

    /// Update health status
    async fn update_health(&self, health: ConnectorHealth) {
        *self.health.lock().await = health;
    }

    /// Validate embedding vector
    pub fn validate_embedding(embedding: &[f32]) -> bool {
        !embedding.is_empty() && embedding.iter().all(|v| v.is_finite())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = OllamaConfig::default();
        assert_eq!(config.host, "http://localhost");
        assert_eq!(config.port, 11434);
        assert_eq!(config.chat_model, "llama2");
        assert_eq!(config.embedding_model, "nomic-embed-text");
    }

    #[test]
    fn test_base_url() {
        let config = OllamaConfig::default();
        let connector = OllamaConnector::new(config);
        assert_eq!(connector.base_url(), "http://localhost:11434");
    }

    #[test]
    fn test_validate_embedding() {
        // Valid embedding
        let valid = vec![0.1, 0.2, 0.3, 0.4];
        assert!(OllamaConnector::validate_embedding(&valid));

        // Empty embedding
        let empty: Vec<f32> = vec![];
        assert!(!OllamaConnector::validate_embedding(&empty));

        // Invalid embedding with NaN
        let invalid = vec![0.1, f32::NAN, 0.3];
        assert!(!OllamaConnector::validate_embedding(&invalid));

        // Invalid embedding with infinity
        let invalid = vec![0.1, f32::INFINITY, 0.3];
        assert!(!OllamaConnector::validate_embedding(&invalid));
    }

    #[tokio::test]
    async fn test_connector_creation() {
        let config = OllamaConfig::default();
        let connector = OllamaConnector::new(config);

        assert_eq!(connector.health().await, ConnectorHealth::Healthy);

        let metrics = connector.metrics().await;
        assert_eq!(metrics.spawn_count, 0);
        assert_eq!(metrics.success_count, 0);
    }

    #[tokio::test]
    async fn test_health_update() {
        let config = OllamaConfig::default();
        let connector = OllamaConnector::new(config);

        connector.update_health(ConnectorHealth::Degraded {
            reason: "Test".to_string(),
        }).await;

        let health = connector.health().await;
        assert!(matches!(health, ConnectorHealth::Degraded { .. }));
    }
}
