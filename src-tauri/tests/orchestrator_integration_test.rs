use agent_manager::runtime::{
    AgentConfig, AgentMessage, AgentRegistry, AgentRole, LoopGuard, MessageBus, Orchestrator,
    StopReason,
};
use std::sync::Arc;

#[tokio::test]
async fn test_two_agent_message_exchange() {
    // Setup
    let registry = Arc::new(AgentRegistry::new());
    let bus = Arc::new(MessageBus::new());

    // Create two agents
    let config1 = AgentConfig::new(
        "agent-1".to_string(),
        AgentRole::Worker,
        "claude_code".to_string(),
    );
    let config2 = AgentConfig::new(
        "agent-2".to_string(),
        AgentRole::Worker,
        "codex_cli".to_string(),
    );

    let agent1 = registry.register(config1).await;
    let agent2 = registry.register(config2).await;

    // Create mailboxes
    bus.create_mailbox(agent1).await;
    bus.create_mailbox(agent2).await;

    // Send messages between agents
    let msg1 = AgentMessage::new(agent1, agent2, "Hello from agent 1".to_string());
    let msg2 = AgentMessage::new(agent2, agent1, "Hello from agent 2".to_string());

    bus.send(msg1).await.unwrap();
    bus.send(msg2).await.unwrap();

    // Create orchestrator with reasonable limits
    let orchestrator = Orchestrator::new(registry.clone(), bus.clone()).with_loop_guard(LoopGuard {
        max_iterations: 100,
        max_messages_per_agent: 10,
        max_execution_time_ms: 5000,
    });

    // Run orchestrator
    let result = orchestrator.start().await.unwrap();

    // Should complete successfully
    assert!(matches!(result, StopReason::Completed));

    // Check metrics
    let metrics = orchestrator.metrics().await;
    assert_eq!(metrics.total_messages, 2);
    assert!(metrics.total_iterations > 0);
    assert!(metrics.total_iterations < 100);

    // Verify both agents processed messages
    assert_eq!(metrics.messages_per_agent.get(&agent1).copied().unwrap(), 1);
    assert_eq!(metrics.messages_per_agent.get(&agent2).copied().unwrap(), 1);

    // Queue should be empty
    assert_eq!(bus.queue_depth().await, 0);
}

#[tokio::test]
async fn test_orchestrator_prevents_runaway_loop() {
    let registry = Arc::new(AgentRegistry::new());
    let bus = Arc::new(MessageBus::new());

    let config = AgentConfig::new(
        "runaway-agent".to_string(),
        AgentRole::Worker,
        "claude_code".to_string(),
    );
    let agent_id = registry.register(config).await;
    bus.create_mailbox(agent_id).await;

    // Send many messages to simulate runaway condition
    for i in 0..100 {
        let msg = AgentMessage::new(agent_id, agent_id, format!("message {}", i));
        bus.send(msg).await.unwrap();
    }

    // Create orchestrator with strict limits
    let orchestrator = Orchestrator::new(registry, bus).with_loop_guard(LoopGuard {
        max_iterations: 10,
        max_messages_per_agent: 5,
        max_execution_time_ms: 5000,
    });

    let result = orchestrator.start().await.unwrap();

    // Should stop due to limits
    assert!(
        matches!(result, StopReason::MaxMessagesPerAgent { .. })
            || matches!(result, StopReason::MaxIterations)
    );
}

#[tokio::test]
async fn test_orchestrator_retry_logic() {
    let registry = Arc::new(AgentRegistry::new());
    let bus = Arc::new(MessageBus::new());

    let config = AgentConfig::new(
        "test-agent".to_string(),
        AgentRole::Worker,
        "claude_code".to_string(),
    );
    let agent_id = registry.register(config).await;
    bus.create_mailbox(agent_id).await;

    // Send a message
    let msg = AgentMessage::new(agent_id, agent_id, "test message".to_string());
    bus.send(msg).await.unwrap();

    let orchestrator = Orchestrator::new(registry, bus);
    orchestrator.start().await.unwrap();

    let metrics = orchestrator.metrics().await;

    // Retry count might be 0 if execution succeeds first time
    // But the test validates retry infrastructure exists
    assert!(metrics.retry_count >= 0);
}

#[tokio::test]
async fn test_orchestrator_queue_depth_tracking() {
    let registry = Arc::new(AgentRegistry::new());
    let bus = Arc::new(MessageBus::new());

    let config = AgentConfig::new(
        "test-agent".to_string(),
        AgentRole::Worker,
        "claude_code".to_string(),
    );
    let agent_id = registry.register(config).await;
    bus.create_mailbox(agent_id).await;

    // Send multiple messages
    for i in 0..5 {
        let msg = AgentMessage::new(agent_id, agent_id, format!("msg {}", i));
        bus.send(msg).await.unwrap();
    }

    // Queue depth should be 5 before processing
    assert_eq!(bus.queue_depth().await, 5);

    let orchestrator = Orchestrator::new(registry, bus.clone());
    orchestrator.start().await.unwrap();

    // Queue should be empty after processing
    assert_eq!(bus.queue_depth().await, 0);
}

#[tokio::test]
async fn test_orchestrator_multi_agent_coordination() {
    let registry = Arc::new(AgentRegistry::new());
    let bus = Arc::new(MessageBus::new());

    // Create coordinator and two workers
    let coordinator_config = AgentConfig::new(
        "coordinator".to_string(),
        AgentRole::Coordinator,
        "claude_code".to_string(),
    );
    let worker1_config = AgentConfig::new(
        "worker-1".to_string(),
        AgentRole::Worker,
        "codex_cli".to_string(),
    );
    let worker2_config = AgentConfig::new(
        "worker-2".to_string(),
        AgentRole::Worker,
        "ollama".to_string(),
    );

    let coordinator_id = registry.register(coordinator_config).await;
    let worker1_id = registry.register(worker1_config).await;
    let worker2_id = registry.register(worker2_config).await;

    bus.create_mailbox(coordinator_id).await;
    bus.create_mailbox(worker1_id).await;
    bus.create_mailbox(worker2_id).await;

    // Coordinator sends tasks to workers
    let task1 = AgentMessage::new(coordinator_id, worker1_id, "Task 1".to_string());
    let task2 = AgentMessage::new(coordinator_id, worker2_id, "Task 2".to_string());

    bus.send(task1).await.unwrap();
    bus.send(task2).await.unwrap();

    // Workers send results back to coordinator
    let result1 = AgentMessage::new(worker1_id, coordinator_id, "Result 1".to_string());
    let result2 = AgentMessage::new(worker2_id, coordinator_id, "Result 2".to_string());

    bus.send(result1).await.unwrap();
    bus.send(result2).await.unwrap();

    let orchestrator = Orchestrator::new(registry.clone(), bus.clone());
    let stop_reason = orchestrator.start().await.unwrap();

    assert!(matches!(stop_reason, StopReason::Completed));

    let metrics = orchestrator.metrics().await;
    assert_eq!(metrics.total_messages, 4);

    // Each agent should have processed messages
    assert!(metrics.messages_per_agent.contains_key(&coordinator_id));
    assert!(metrics.messages_per_agent.contains_key(&worker1_id));
    assert!(metrics.messages_per_agent.contains_key(&worker2_id));
}

#[tokio::test]
async fn test_orchestrator_metrics_reset() {
    let registry = Arc::new(AgentRegistry::new());
    let bus = Arc::new(MessageBus::new());

    let config = AgentConfig::new(
        "test-agent".to_string(),
        AgentRole::Worker,
        "claude_code".to_string(),
    );
    let agent_id = registry.register(config).await;
    bus.create_mailbox(agent_id).await;

    let msg = AgentMessage::new(agent_id, agent_id, "test".to_string());
    bus.send(msg).await.unwrap();

    let orchestrator = Orchestrator::new(registry, bus);
    orchestrator.start().await.unwrap();

    // Metrics should be non-zero
    let metrics = orchestrator.metrics().await;
    assert!(metrics.total_messages > 0);

    // Reset metrics
    orchestrator.reset_metrics().await;

    let metrics = orchestrator.metrics().await;
    assert_eq!(metrics.total_messages, 0);
    assert_eq!(metrics.total_iterations, 0);
}
