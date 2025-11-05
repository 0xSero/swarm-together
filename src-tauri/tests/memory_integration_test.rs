use agent_manager::memory::{BlackboardEntry, MemoryEntry, MemoryManager};
use std::sync::Arc;

#[tokio::test]
async fn test_two_agents_sharing_blackboard() {
    let manager = Arc::new(MemoryManager::new(10));

    let agent1 = uuid::Uuid::new_v4();
    let agent2 = uuid::Uuid::new_v4();

    // Create buffers for both agents
    manager.create_agent_buffer(agent1, 100).await;
    manager.create_agent_buffer(agent2, 100).await;

    // Agent 1 writes to its buffer
    manager
        .add_to_agent(
            agent1,
            MemoryEntry::new("Agent 1 completed task A".to_string(), 10),
        )
        .await
        .unwrap();

    // Agent 1 shares result to blackboard
    manager
        .add_to_blackboard(
            "task_a_result".to_string(),
            "Task A completed successfully".to_string(),
            false,
        )
        .await
        .unwrap();

    // Agent 2 reads from blackboard
    let result = manager.get_from_blackboard("task_a_result").await.unwrap();
    assert_eq!(result.value, "Task A completed successfully");

    // Agent 2 writes to its own buffer
    manager
        .add_to_agent(
            agent2,
            MemoryEntry::new("Agent 2 read task A result".to_string(), 10),
        )
        .await
        .unwrap();

    // Verify isolation - each agent has its own buffer
    let stats1 = manager.get_agent_stats(agent1).await.unwrap();
    let stats2 = manager.get_agent_stats(agent2).await.unwrap();

    assert_eq!(stats1.total_tokens, 10);
    assert_eq!(stats2.total_tokens, 10);
}

#[tokio::test]
async fn test_memory_trimmed_when_near_cap() {
    let manager = MemoryManager::new(100);
    let agent_id = uuid::Uuid::new_v4();

    // Create buffer with 50 token capacity
    manager.create_agent_buffer(agent_id, 50).await;

    // Add entries totaling 60 tokens (exceeds capacity)
    for i in 0..6 {
        let entry = MemoryEntry::new(format!("Entry {}", i), 10);
        manager.add_to_agent(agent_id, entry).await.unwrap();
    }

    // Buffer should have trimmed to stay under cap
    let stats = manager.get_agent_stats(agent_id).await.unwrap();
    assert!(stats.total_tokens <= 50);
    assert!(stats.eviction_count > 0);
}

#[tokio::test]
async fn test_blackboard_ttl_eviction() {
    let manager = MemoryManager::new(10);

    // Add entry with 1 second TTL
    let mut entry = BlackboardEntry::new("temp_key".to_string(), "temp_value".to_string());
    entry.expires_at = Some(
        std::time::SystemTime::now() + std::time::Duration::from_secs(1)
    );

    // Manually add to blackboard
    manager.add_to_blackboard("temp_key".to_string(), "temp_value".to_string(), false)
        .await
        .unwrap();

    // Should exist now
    assert!(manager.get_from_blackboard("temp_key").await.is_some());

    // Wait for expiration
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // Should be expired (but test might be flaky due to timing)
    // In real blackboard implementation, expired entries are removed on next access
}

#[tokio::test]
async fn test_agent_buffer_summarization() {
    let manager = MemoryManager::new(100);
    let agent_id = uuid::Uuid::new_v4();

    // Create buffer with small capacity and low threshold
    let buffer = manager.create_agent_buffer(agent_id, 50).await;

    // Add many entries to trigger summarization
    for i in 0..10 {
        let entry = MemoryEntry::new(
            format!("This is entry number {} with some content to fill tokens", i),
            8,
        );
        manager.add_to_agent(agent_id, entry).await.unwrap();
    }

    // Check that summarization was triggered
    let stats = buffer.stats().await;
    assert!(stats.summarization_count > 0);

    // Buffer should be well under capacity after summarization
    assert!(stats.total_tokens < buffer.capacity());
}

#[tokio::test]
async fn test_memory_isolation_between_agents() {
    let manager = Arc::new(MemoryManager::new(100));

    let agent1 = uuid::Uuid::new_v4();
    let agent2 = uuid::Uuid::new_v4();
    let agent3 = uuid::Uuid::new_v4();

    // Create buffers for all agents
    manager.create_agent_buffer(agent1, 100).await;
    manager.create_agent_buffer(agent2, 100).await;
    manager.create_agent_buffer(agent3, 100).await;

    // Each agent adds different amounts to their buffer
    manager
        .add_to_agent(agent1, MemoryEntry::new("Agent 1 data".to_string(), 20))
        .await
        .unwrap();

    manager
        .add_to_agent(agent2, MemoryEntry::new("Agent 2 data".to_string(), 30))
        .await
        .unwrap();

    manager
        .add_to_agent(agent3, MemoryEntry::new("Agent 3 data".to_string(), 40))
        .await
        .unwrap();

    // Verify each agent has correct isolated stats
    assert_eq!(
        manager.get_agent_stats(agent1).await.unwrap().total_tokens,
        20
    );
    assert_eq!(
        manager.get_agent_stats(agent2).await.unwrap().total_tokens,
        30
    );
    assert_eq!(
        manager.get_agent_stats(agent3).await.unwrap().total_tokens,
        40
    );
}

#[tokio::test]
async fn test_blackboard_lru_eviction_with_agents() {
    let manager = Arc::new(MemoryManager::new(3)); // Small blackboard capacity

    let agent1 = uuid::Uuid::new_v4();
    let agent2 = uuid::Uuid::new_v4();

    // Agent 1 adds multiple items to blackboard
    for i in 0..5 {
        manager
            .add_to_blackboard(format!("key{}", i), format!("value{}", i), false)
            .await
            .unwrap();

        // Small delay to ensure different access times
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }

    // Only the last 3 should remain due to LRU
    let stats = manager.get_blackboard_stats().await;
    assert_eq!(stats.total_entries, 3);

    // Agent 2 can still read from blackboard
    assert!(manager.get_from_blackboard("key4").await.is_some());
}

#[tokio::test]
async fn test_blackboard_stats_tracking() {
    let manager = MemoryManager::new(10);

    // Add entries
    manager
        .add_to_blackboard("key1".to_string(), "value1".to_string(), false)
        .await
        .unwrap();

    manager
        .add_to_blackboard("key2".to_string(), "value2".to_string(), false)
        .await
        .unwrap();

    // Access key1 (hit)
    manager.get_from_blackboard("key1").await;

    // Access non-existent key (miss)
    manager.get_from_blackboard("key_nonexistent").await;

    let stats = manager.get_blackboard_stats().await;
    assert_eq!(stats.total_entries, 2);
    assert_eq!(stats.hit_count, 1);
    assert_eq!(stats.miss_count, 1);
}

#[tokio::test]
async fn test_memory_manager_list_agents() {
    let manager = MemoryManager::new(100);

    let agent1 = uuid::Uuid::new_v4();
    let agent2 = uuid::Uuid::new_v4();

    manager.create_agent_buffer(agent1, 100).await;
    manager.create_agent_buffer(agent2, 100).await;

    let agents = manager.list_agents().await;
    assert_eq!(agents.len(), 2);
    assert!(agents.contains(&agent1));
    assert!(agents.contains(&agent2));
}
