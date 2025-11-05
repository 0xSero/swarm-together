use super::blackboard::Blackboard;
use super::ring_buffer::RingBuffer;
use super::types::{BlackboardEntry, BlackboardStats, MemoryEntry, MemoryStats};
use crate::connectors::ollama::OllamaConnector;
use crate::runtime::types::AgentId;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Memory manager coordinates ring buffers and blackboard
pub struct MemoryManager {
    /// Per-agent ring buffers
    agent_buffers: Arc<RwLock<HashMap<AgentId, Arc<RingBuffer>>>>,
    /// Shared blackboard
    blackboard: Arc<Blackboard>,
    /// Ollama connector for embeddings
    embeddings_connector: Option<Arc<OllamaConnector>>,
}

impl MemoryManager {
    /// Create a new memory manager
    pub fn new(blackboard_capacity: usize) -> Self {
        Self {
            agent_buffers: Arc::new(RwLock::new(HashMap::new())),
            blackboard: Arc::new(Blackboard::new(blackboard_capacity)),
            embeddings_connector: None,
        }
    }

    /// Set embeddings connector
    pub fn with_embeddings(mut self, connector: Arc<OllamaConnector>) -> Self {
        self.embeddings_connector = Some(connector);
        self
    }

    /// Create a ring buffer for an agent
    pub async fn create_agent_buffer(&self, agent_id: AgentId, capacity_tokens: u32) -> Arc<RingBuffer> {
        let buffer = Arc::new(RingBuffer::new(capacity_tokens));
        self.agent_buffers.write().await.insert(agent_id, buffer.clone());
        buffer
    }

    /// Get an agent's ring buffer
    pub async fn get_agent_buffer(&self, agent_id: AgentId) -> Option<Arc<RingBuffer>> {
        self.agent_buffers.read().await.get(&agent_id).cloned()
    }

    /// Remove an agent's ring buffer
    pub async fn remove_agent_buffer(&self, agent_id: AgentId) -> bool {
        self.agent_buffers.write().await.remove(&agent_id).is_some()
    }

    /// Add memory to an agent's ring buffer
    pub async fn add_to_agent(&self, agent_id: AgentId, entry: MemoryEntry) -> Result<(), String> {
        let buffer = self
            .get_agent_buffer(agent_id)
            .await
            .ok_or_else(|| format!("No buffer for agent: {}", agent_id))?;

        buffer.push(entry).await;

        // Check if summarization is needed
        if buffer.should_summarize().await {
            self.trigger_summarization(agent_id, buffer).await?;
        }

        Ok(())
    }

    /// Trigger summarization for an agent's buffer
    async fn trigger_summarization(&self, agent_id: AgentId, buffer: Arc<RingBuffer>) -> Result<(), String> {
        tracing::info!("Triggering summarization for agent: {}", agent_id);

        let entries = buffer.get_all().await;
        if entries.is_empty() {
            return Ok(());
        }

        // Concatenate all content
        let full_content: String = entries
            .iter()
            .map(|e| e.content.as_str())
            .collect::<Vec<&str>>()
            .join("\n");

        // Simple summarization: take first and last parts (stub)
        // In production, this would call an LLM to generate a summary
        let summary = if full_content.len() > 200 {
            format!(
                "{}...{}",
                &full_content[..100],
                &full_content[full_content.len() - 100..]
            )
        } else {
            full_content
        };

        // Estimate token count (rough approximation: 1 token ≈ 4 characters)
        let summary_tokens = (summary.len() / 4) as u32;

        buffer.summarize(summary, summary_tokens).await;

        Ok(())
    }

    /// Add to blackboard with optional embedding
    pub async fn add_to_blackboard(&self, key: String, value: String, generate_embedding: bool) -> Result<(), String> {
        let embedding = if generate_embedding && self.embeddings_connector.is_some() {
            let connector = self.embeddings_connector.as_ref().unwrap();
            Some(
                connector
                    .embed(&value)
                    .await
                    .map_err(|e| format!("Failed to generate embedding: {}", e))?,
            )
        } else {
            None
        };

        let mut entry = BlackboardEntry::new(key, value);
        if let Some(emb) = embedding {
            entry = entry.with_embedding(emb);
        }

        self.blackboard.put(entry).await;
        Ok(())
    }

    /// Get from blackboard
    pub async fn get_from_blackboard(&self, key: &str) -> Option<BlackboardEntry> {
        self.blackboard.get(key).await
    }

    /// Semantic recall from blackboard
    pub async fn recall(&self, query: &str, top_k: usize) -> Result<Vec<BlackboardEntry>, String> {
        if self.embeddings_connector.is_none() {
            return Err("No embeddings connector configured".to_string());
        }

        let connector = self.embeddings_connector.as_ref().unwrap();
        let query_embedding = connector
            .embed(query)
            .await
            .map_err(|e| format!("Failed to generate query embedding: {}", e))?;

        Ok(self.blackboard.recall(&query_embedding, top_k).await)
    }

    /// Get agent buffer stats
    pub async fn get_agent_stats(&self, agent_id: AgentId) -> Option<MemoryStats> {
        let buffer = self.get_agent_buffer(agent_id).await?;
        Some(buffer.stats().await)
    }

    /// Get blackboard stats
    pub async fn get_blackboard_stats(&self) -> BlackboardStats {
        self.blackboard.stats().await
    }

    /// List all agent IDs with buffers
    pub async fn list_agents(&self) -> Vec<AgentId> {
        self.agent_buffers.read().await.keys().copied().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_memory_manager_agent_buffer() {
        let manager = MemoryManager::new(100);
        let agent_id = uuid::Uuid::new_v4();

        // Create buffer
        manager.create_agent_buffer(agent_id, 100).await;

        // Add entry
        let entry = MemoryEntry::new("test".to_string(), 10);
        manager.add_to_agent(agent_id, entry).await.unwrap();

        // Check stats
        let stats = manager.get_agent_stats(agent_id).await.unwrap();
        assert_eq!(stats.total_tokens, 10);
    }

    #[tokio::test]
    async fn test_memory_manager_blackboard() {
        let manager = MemoryManager::new(100);

        // Add without embedding
        manager
            .add_to_blackboard("key1".to_string(), "value1".to_string(), false)
            .await
            .unwrap();

        // Get
        let entry = manager.get_from_blackboard("key1").await.unwrap();
        assert_eq!(entry.value, "value1");
    }

    #[tokio::test]
    async fn test_memory_manager_multiple_agents() {
        let manager = MemoryManager::new(100);

        let agent1 = uuid::Uuid::new_v4();
        let agent2 = uuid::Uuid::new_v4();

        manager.create_agent_buffer(agent1, 100).await;
        manager.create_agent_buffer(agent2, 100).await;

        // Add to agent1
        manager
            .add_to_agent(agent1, MemoryEntry::new("agent1 memory".to_string(), 10))
            .await
            .unwrap();

        // Add to agent2
        manager
            .add_to_agent(agent2, MemoryEntry::new("agent2 memory".to_string(), 15))
            .await
            .unwrap();

        // Check isolation
        let stats1 = manager.get_agent_stats(agent1).await.unwrap();
        let stats2 = manager.get_agent_stats(agent2).await.unwrap();

        assert_eq!(stats1.total_tokens, 10);
        assert_eq!(stats2.total_tokens, 15);
    }

    #[tokio::test]
    async fn test_memory_manager_remove_agent() {
        let manager = MemoryManager::new(100);
        let agent_id = uuid::Uuid::new_v4();

        manager.create_agent_buffer(agent_id, 100).await;
        assert!(manager.get_agent_buffer(agent_id).await.is_some());

        manager.remove_agent_buffer(agent_id).await;
        assert!(manager.get_agent_buffer(agent_id).await.is_none());
    }

    #[tokio::test]
    async fn test_memory_manager_summarization_trigger() {
        let manager = MemoryManager::new(100);
        let agent_id = uuid::Uuid::new_v4();

        // Create buffer with small capacity
        let buffer = manager.create_agent_buffer(agent_id, 50).await;

        // Fill buffer to trigger summarization
        for i in 0..10 {
            let entry = MemoryEntry::new(format!("entry {} with some content", i), 8);
            manager.add_to_agent(agent_id, entry).await.unwrap();
        }

        // Check that summarization occurred
        let stats = buffer.stats().await;
        assert!(stats.summarization_count > 0);
    }
}
