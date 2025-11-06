use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub host: String,
    pub port: u16,
    pub enable_cors: bool,
    pub require_auth: bool,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            enable_cors: false,
            require_auth: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreateRequest {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionResponse {
    pub id: String,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandRequest {
    pub command: String,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResponse {
    pub success: bool,
    pub message: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageResponse {
    pub total_tokens: u64,
    pub total_cost_usd: f64,
    pub by_provider: HashMap<String, ProviderUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderUsage {
    pub tokens: u64,
    pub cost_usd: f64,
    pub requests: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamEvent {
    pub event_type: String,
    pub session_id: String,
    pub data: serde_json::Value,
    pub timestamp: String,
}

pub struct ApiGateway {
    config: ApiConfig,
    sessions: Arc<RwLock<HashMap<String, SessionResponse>>>,
    connections: Arc<RwLock<u32>>,
    request_count: Arc<RwLock<u64>>,
}

impl ApiGateway {
    pub fn new(config: ApiConfig) -> Self {
        Self {
            config,
            sessions: Arc::new(RwLock::new(HashMap::new())),
            connections: Arc::new(RwLock::new(0)),
            request_count: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn create_session(&self, request: SessionCreateRequest) -> Result<SessionResponse, String> {
        let mut count = self.request_count.write().await;
        *count += 1;

        let session_id = uuid::Uuid::new_v4().to_string();
        let session = SessionResponse {
            id: session_id.clone(),
            name: request.name,
            status: "active".to_string(),
        };

        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session.clone());

        Ok(session)
    }

    pub async fn get_session(&self, session_id: &str) -> Result<SessionResponse, String> {
        let mut count = self.request_count.write().await;
        *count += 1;

        let sessions = self.sessions.read().await;
        sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", session_id))
    }

    pub async fn list_sessions(&self) -> Result<Vec<SessionResponse>, String> {
        let mut count = self.request_count.write().await;
        *count += 1;

        let sessions = self.sessions.read().await;
        Ok(sessions.values().cloned().collect())
    }

    pub async fn execute_command(&self, request: CommandRequest) -> Result<CommandResponse, String> {
        let mut count = self.request_count.write().await;
        *count += 1;

        // Simple command execution stub
        Ok(CommandResponse {
            success: true,
            message: Some(format!("Executed command: {}", request.command)),
            error: None,
        })
    }

    pub async fn get_usage(&self) -> Result<UsageResponse, String> {
        let mut count = self.request_count.write().await;
        *count += 1;

        // Stub usage data
        let mut by_provider = HashMap::new();
        by_provider.insert(
            "claude-code".to_string(),
            ProviderUsage {
                tokens: 1000,
                cost_usd: 0.05,
                requests: 10,
            },
        );

        Ok(UsageResponse {
            total_tokens: 1000,
            total_cost_usd: 0.05,
            by_provider,
        })
    }

    pub async fn increment_connections(&self) {
        let mut connections = self.connections.write().await;
        *connections += 1;
    }

    pub async fn decrement_connections(&self) {
        let mut connections = self.connections.write().await;
        *connections = connections.saturating_sub(1);
    }

    pub async fn get_metrics(&self) -> ApiMetrics {
        let connections = *self.connections.read().await;
        let request_count = *self.request_count.read().await;
        let session_count = self.sessions.read().await.len();

        ApiMetrics {
            active_connections: connections,
            total_requests: request_count,
            active_sessions: session_count,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiMetrics {
    pub active_connections: u32,
    pub total_requests: u64,
    pub active_sessions: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_session() {
        let gateway = ApiGateway::new(ApiConfig::default());

        let request = SessionCreateRequest {
            name: "Test Session".to_string(),
        };

        let result = gateway.create_session(request).await;
        assert!(result.is_ok());

        let session = result.unwrap();
        assert_eq!(session.name, "Test Session");
        assert_eq!(session.status, "active");
    }

    #[tokio::test]
    async fn test_get_session() {
        let gateway = ApiGateway::new(ApiConfig::default());

        let request = SessionCreateRequest {
            name: "Test Session".to_string(),
        };

        let created = gateway.create_session(request).await.unwrap();
        let retrieved = gateway.get_session(&created.id).await.unwrap();

        assert_eq!(created.id, retrieved.id);
        assert_eq!(created.name, retrieved.name);
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let gateway = ApiGateway::new(ApiConfig::default());

        gateway
            .create_session(SessionCreateRequest {
                name: "Session 1".to_string(),
            })
            .await
            .unwrap();

        gateway
            .create_session(SessionCreateRequest {
                name: "Session 2".to_string(),
            })
            .await
            .unwrap();

        let sessions = gateway.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[tokio::test]
    async fn test_execute_command() {
        let gateway = ApiGateway::new(ApiConfig::default());

        let request = CommandRequest {
            command: "/help".to_string(),
            session_id: None,
        };

        let result = gateway.execute_command(request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.success);
    }

    #[tokio::test]
    async fn test_metrics() {
        let gateway = ApiGateway::new(ApiConfig::default());

        gateway.increment_connections().await;
        gateway.increment_connections().await;

        gateway
            .create_session(SessionCreateRequest {
                name: "Test".to_string(),
            })
            .await
            .unwrap();

        let metrics = gateway.get_metrics().await;
        assert_eq!(metrics.active_connections, 2);
        assert_eq!(metrics.active_sessions, 1);
        assert!(metrics.total_requests > 0);
    }
}
