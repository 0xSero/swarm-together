use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: String,
    pub data: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct WebSocketConnection {
    pub id: String,
    pub session_id: Option<String>,
    pub connected_at: std::time::SystemTime,
}

pub struct WebSocketManager {
    connections: Arc<RwLock<Vec<WebSocketConnection>>>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn add_connection(&self, connection: WebSocketConnection) {
        let mut connections = self.connections.write().await;
        connections.push(connection);
    }

    pub async fn remove_connection(&self, connection_id: &str) {
        let mut connections = self.connections.write().await;
        connections.retain(|c| c.id != connection_id);
    }

    pub async fn get_connection_count(&self) -> usize {
        let connections = self.connections.read().await;
        connections.len()
    }

    pub async fn broadcast_to_session(&self, session_id: &str, message: WebSocketMessage) -> Result<usize, String> {
        let connections = self.connections.read().await;
        let matching: Vec<_> = connections
            .iter()
            .filter(|c| c.session_id.as_deref() == Some(session_id))
            .collect();

        let count = matching.len();

        // In a real implementation, this would send the message via the WebSocket
        // For now, we just track the count
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_connection_management() {
        let manager = WebSocketManager::new();

        let conn1 = WebSocketConnection {
            id: "conn1".to_string(),
            session_id: Some("session1".to_string()),
            connected_at: std::time::SystemTime::now(),
        };

        manager.add_connection(conn1).await;

        assert_eq!(manager.get_connection_count().await, 1);

        manager.remove_connection("conn1").await;
        assert_eq!(manager.get_connection_count().await, 0);
    }

    #[tokio::test]
    async fn test_broadcast_to_session() {
        let manager = WebSocketManager::new();

        let conn1 = WebSocketConnection {
            id: "conn1".to_string(),
            session_id: Some("session1".to_string()),
            connected_at: std::time::SystemTime::now(),
        };

        let conn2 = WebSocketConnection {
            id: "conn2".to_string(),
            session_id: Some("session1".to_string()),
            connected_at: std::time::SystemTime::now(),
        };

        manager.add_connection(conn1).await;
        manager.add_connection(conn2).await;

        let message = WebSocketMessage {
            message_type: "event".to_string(),
            data: serde_json::json!({"test": "data"}),
        };

        let count = manager.broadcast_to_session("session1", message).await.unwrap();
        assert_eq!(count, 2);
    }
}
