use super::types::{AgentConfig, AgentId, AgentMetadata, AgentRole, AgentStatus};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Agent registry manages all active agents
pub struct AgentRegistry {
    agents: Arc<RwLock<HashMap<AgentId, AgentMetadata>>>,
    configs: Arc<RwLock<HashMap<AgentId, AgentConfig>>>,
}

impl AgentRegistry {
    /// Create a new agent registry
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            configs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new agent
    pub async fn register(&self, config: AgentConfig) -> AgentId {
        let agent_id = uuid::Uuid::new_v4();

        let metadata = AgentMetadata {
            id: agent_id,
            name: config.name.clone(),
            role: config.role.clone(),
            status: AgentStatus::Idle,
            connector_type: config.connector_type.clone(),
            created_at: chrono::Utc::now(),
        };

        self.agents.write().await.insert(agent_id, metadata);
        self.configs.write().await.insert(agent_id, config);

        agent_id
    }

    /// Unregister an agent
    pub async fn unregister(&self, agent_id: AgentId) -> bool {
        let mut agents = self.agents.write().await;
        let mut configs = self.configs.write().await;

        let removed_agent = agents.remove(&agent_id).is_some();
        configs.remove(&agent_id);

        removed_agent
    }

    /// Get agent metadata
    pub async fn get_metadata(&self, agent_id: AgentId) -> Option<AgentMetadata> {
        self.agents.read().await.get(&agent_id).cloned()
    }

    /// Get agent configuration
    pub async fn get_config(&self, agent_id: AgentId) -> Option<AgentConfig> {
        self.configs.read().await.get(&agent_id).cloned()
    }

    /// Update agent status
    pub async fn update_status(&self, agent_id: AgentId, status: AgentStatus) -> bool {
        let mut agents = self.agents.write().await;
        if let Some(metadata) = agents.get_mut(&agent_id) {
            metadata.status = status;
            true
        } else {
            false
        }
    }

    /// List all agents
    pub async fn list_agents(&self) -> Vec<AgentMetadata> {
        self.agents.read().await.values().cloned().collect()
    }

    /// List agents by role
    pub async fn list_by_role(&self, role: AgentRole) -> Vec<AgentMetadata> {
        self.agents
            .read()
            .await
            .values()
            .filter(|m| m.role == role)
            .cloned()
            .collect()
    }

    /// Count active agents
    pub async fn count(&self) -> usize {
        self.agents.read().await.len()
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_register_agent() {
        let registry = AgentRegistry::new();
        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );

        let agent_id = registry.register(config).await;

        assert_eq!(registry.count().await, 1);

        let metadata = registry.get_metadata(agent_id).await.unwrap();
        assert_eq!(metadata.name, "test-agent");
        assert_eq!(metadata.role, AgentRole::Worker);
        assert_eq!(metadata.status, AgentStatus::Idle);
    }

    #[tokio::test]
    async fn test_unregister_agent() {
        let registry = AgentRegistry::new();
        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );

        let agent_id = registry.register(config).await;
        assert_eq!(registry.count().await, 1);

        let removed = registry.unregister(agent_id).await;
        assert!(removed);
        assert_eq!(registry.count().await, 0);
    }

    #[tokio::test]
    async fn test_update_status() {
        let registry = AgentRegistry::new();
        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );

        let agent_id = registry.register(config).await;

        let updated = registry
            .update_status(agent_id, AgentStatus::Processing)
            .await;
        assert!(updated);

        let metadata = registry.get_metadata(agent_id).await.unwrap();
        assert_eq!(metadata.status, AgentStatus::Processing);
    }

    #[tokio::test]
    async fn test_list_by_role() {
        let registry = AgentRegistry::new();

        let config1 = AgentConfig::new(
            "worker1".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );
        let config2 = AgentConfig::new(
            "coordinator".to_string(),
            AgentRole::Coordinator,
            "codex_cli".to_string(),
        );
        let config3 = AgentConfig::new(
            "worker2".to_string(),
            AgentRole::Worker,
            "ollama".to_string(),
        );

        registry.register(config1).await;
        registry.register(config2).await;
        registry.register(config3).await;

        let workers = registry.list_by_role(AgentRole::Worker).await;
        assert_eq!(workers.len(), 2);

        let coordinators = registry.list_by_role(AgentRole::Coordinator).await;
        assert_eq!(coordinators.len(), 1);
    }
}
