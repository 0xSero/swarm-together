use super::mailbox::{Mailbox, MessageBus};
use super::registry::AgentRegistry;
use super::types::{AgentConfig, AgentId, AgentMessage, AgentStatus};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

/// Loop guard to prevent runaway execution
#[derive(Debug, Clone)]
pub struct LoopGuard {
    /// Maximum iterations before stopping
    pub max_iterations: u32,
    /// Maximum messages per agent
    pub max_messages_per_agent: u32,
    /// Maximum total execution time in milliseconds
    pub max_execution_time_ms: u64,
}

impl Default for LoopGuard {
    fn default() -> Self {
        Self {
            max_iterations: 100,
            max_messages_per_agent: 50,
            max_execution_time_ms: 600000, // 10 minutes
        }
    }
}

/// Loop stoppage reason
#[derive(Debug, Clone)]
pub enum StopReason {
    /// Completed successfully
    Completed,
    /// Max iterations reached
    MaxIterations,
    /// Max messages per agent reached
    MaxMessagesPerAgent { agent_id: AgentId, count: u32 },
    /// Max execution time reached
    MaxExecutionTime,
    /// Agent error
    AgentError { agent_id: AgentId, error: String },
    /// Manual stop
    ManualStop,
}

/// Orchestrator metrics
#[derive(Debug, Clone, Default)]
pub struct OrchestratorMetrics {
    pub total_iterations: u32,
    pub total_messages: u64,
    pub messages_per_agent: HashMap<AgentId, u32>,
    pub retry_count: u64,
    pub error_count: u64,
    pub queue_depth: usize,
}

/// Core orchestrator for managing agent execution
pub struct Orchestrator {
    registry: Arc<AgentRegistry>,
    message_bus: Arc<MessageBus>,
    loop_guard: LoopGuard,
    metrics: Arc<Mutex<OrchestratorMetrics>>,
    running: Arc<RwLock<bool>>,
}

impl Orchestrator {
    /// Create a new orchestrator
    pub fn new(registry: Arc<AgentRegistry>, message_bus: Arc<MessageBus>) -> Self {
        Self {
            registry,
            message_bus,
            loop_guard: LoopGuard::default(),
            metrics: Arc::new(Mutex::new(OrchestratorMetrics::default())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Create with custom loop guard
    pub fn with_loop_guard(mut self, guard: LoopGuard) -> Self {
        self.loop_guard = guard;
        self
    }

    /// Start the orchestrator
    pub async fn start(&self) -> Result<StopReason, String> {
        *self.running.write().await = true;

        info!("Orchestrator starting...");

        let start_time = std::time::Instant::now();
        let mut iterations = 0u32;

        loop {
            // Check if still running
            if !*self.running.read().await {
                info!("Orchestrator stopped manually");
                return Ok(StopReason::ManualStop);
            }

            // Check iteration limit
            if iterations >= self.loop_guard.max_iterations {
                warn!("Max iterations reached: {}", iterations);
                return Ok(StopReason::MaxIterations);
            }

            // Check execution time
            if start_time.elapsed().as_millis() as u64 >= self.loop_guard.max_execution_time_ms {
                warn!("Max execution time reached");
                return Ok(StopReason::MaxExecutionTime);
            }

            // Process messages for all agents
            let agents = self.registry.list_agents().await;
            if agents.is_empty() {
                debug!("No agents registered, stopping");
                return Ok(StopReason::Completed);
            }

            let mut processed_any = false;

            for agent in agents {
                // Check per-agent message limit
                let agent_msg_count = self
                    .metrics
                    .lock()
                    .await
                    .messages_per_agent
                    .get(&agent.id)
                    .copied()
                    .unwrap_or(0);

                if agent_msg_count >= self.loop_guard.max_messages_per_agent {
                    warn!(
                        "Agent {} reached max messages: {}",
                        agent.name, agent_msg_count
                    );
                    return Ok(StopReason::MaxMessagesPerAgent {
                        agent_id: agent.id,
                        count: agent_msg_count,
                    });
                }

                // Process one message for this agent
                if let Some(result) = self.process_agent_message(agent.id).await {
                    match result {
                        Ok(_) => processed_any = true,
                        Err(e) => {
                            error!("Agent {} error: {}", agent.name, e);
                            return Ok(StopReason::AgentError {
                                agent_id: agent.id,
                                error: e,
                            });
                        }
                    }
                }
            }

            // Update metrics
            {
                let mut metrics = self.metrics.lock().await;
                metrics.total_iterations = iterations;
                metrics.queue_depth = self.message_bus.queue_depth().await;
            }

            iterations += 1;

            // If no messages were processed and queue is empty, we're done
            if !processed_any && self.message_bus.queue_depth().await == 0 {
                info!("All messages processed, orchestrator completing");
                return Ok(StopReason::Completed);
            }

            // Small delay to prevent busy loop
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }

    /// Stop the orchestrator
    pub async fn stop(&self) {
        *self.running.write().await = false;
    }

    /// Process a single message for an agent
    async fn process_agent_message(&self, agent_id: AgentId) -> Option<Result<(), String>> {
        let mailbox = self.message_bus.get_mailbox(agent_id).await?;

        // Get the next message
        let message = mailbox.pop().await?;

        debug!(
            "Processing message {} for agent {}",
            message.id, agent_id
        );

        // Update status
        self.registry
            .update_status(agent_id, AgentStatus::Processing)
            .await;

        // Process with retry logic
        let config = self.registry.get_config(agent_id).await?;
        let result = self.execute_with_retry(agent_id, message, &config).await;

        // Update status based on result
        match &result {
            Ok(_) => {
                self.registry
                    .update_status(agent_id, AgentStatus::Idle)
                    .await;
            }
            Err(_) => {
                self.registry
                    .update_status(
                        agent_id,
                        AgentStatus::Failed {
                            reason: "Processing failed".to_string(),
                        },
                    )
                    .await;
            }
        }

        // Mark as received
        self.message_bus.mark_received().await;

        // Update per-agent message count
        {
            let mut metrics = self.metrics.lock().await;
            *metrics.messages_per_agent.entry(agent_id).or_insert(0) += 1;
            metrics.total_messages += 1;
        }

        Some(result)
    }

    /// Execute message processing with retry logic
    async fn execute_with_retry(
        &self,
        agent_id: AgentId,
        message: AgentMessage,
        config: &AgentConfig,
    ) -> Result<(), String> {
        let mut retries = 0;

        loop {
            match self.execute_message(agent_id, &message, config).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    retries += 1;

                    if retries >= config.max_retries {
                        self.metrics.lock().await.error_count += 1;
                        return Err(format!("Max retries exceeded: {}", e));
                    }

                    self.metrics.lock().await.retry_count += 1;

                    // Exponential backoff
                    let backoff = Duration::from_millis(100 * 2_u64.pow(retries - 1));
                    warn!(
                        "Retry {} for agent {}, backing off for {:?}",
                        retries, agent_id, backoff
                    );
                    tokio::time::sleep(backoff).await;
                }
            }
        }
    }

    /// Execute a message (stub implementation)
    async fn execute_message(
        &self,
        _agent_id: AgentId,
        message: &AgentMessage,
        config: &AgentConfig,
    ) -> Result<(), String> {
        // Simulate processing with timeout
        let work = async {
            // Stub: In a real implementation, this would call the connector
            tokio::time::sleep(Duration::from_millis(10)).await;
            debug!("Processed message: {}", message.content);
            Ok(())
        };

        timeout(Duration::from_millis(config.timeout_ms), work)
            .await
            .map_err(|_| "Timeout".to_string())?
    }

    /// Get current metrics
    pub async fn metrics(&self) -> OrchestratorMetrics {
        self.metrics.lock().await.clone()
    }

    /// Reset metrics
    pub async fn reset_metrics(&self) {
        *self.metrics.lock().await = OrchestratorMetrics::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::types::AgentRole;

    #[tokio::test]
    async fn test_loop_guard_max_iterations() {
        let registry = Arc::new(AgentRegistry::new());
        let bus = Arc::new(MessageBus::new());

        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );
        let agent_id = registry.register(config).await;
        bus.create_mailbox(agent_id).await;

        // Send many messages
        for i in 0..10 {
            let msg = AgentMessage::new(agent_id, agent_id, format!("msg{}", i));
            bus.send(msg).await.unwrap();
        }

        let orchestrator = Orchestrator::new(registry, bus).with_loop_guard(LoopGuard {
            max_iterations: 5,
            max_messages_per_agent: 100,
            max_execution_time_ms: 60000,
        });

        let result = orchestrator.start().await.unwrap();
        assert!(matches!(result, StopReason::MaxIterations));
    }

    #[tokio::test]
    async fn test_loop_guard_max_messages_per_agent() {
        let registry = Arc::new(AgentRegistry::new());
        let bus = Arc::new(MessageBus::new());

        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );
        let agent_id = registry.register(config).await;
        bus.create_mailbox(agent_id).await;

        // Send messages
        for i in 0..10 {
            let msg = AgentMessage::new(agent_id, agent_id, format!("msg{}", i));
            bus.send(msg).await.unwrap();
        }

        let orchestrator = Orchestrator::new(registry, bus).with_loop_guard(LoopGuard {
            max_iterations: 1000,
            max_messages_per_agent: 3,
            max_execution_time_ms: 60000,
        });

        let result = orchestrator.start().await.unwrap();
        assert!(matches!(
            result,
            StopReason::MaxMessagesPerAgent { .. }
        ));
    }

    #[tokio::test]
    async fn test_orchestrator_completion() {
        let registry = Arc::new(AgentRegistry::new());
        let bus = Arc::new(MessageBus::new());

        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );
        let agent_id = registry.register(config).await;
        bus.create_mailbox(agent_id).await;

        // Send just one message
        let msg = AgentMessage::new(agent_id, agent_id, "test".to_string());
        bus.send(msg).await.unwrap();

        let orchestrator = Orchestrator::new(registry, bus);

        let result = orchestrator.start().await.unwrap();
        assert!(matches!(result, StopReason::Completed));

        let metrics = orchestrator.metrics().await;
        assert_eq!(metrics.total_messages, 1);
    }

    #[tokio::test]
    async fn test_orchestrator_metrics() {
        let registry = Arc::new(AgentRegistry::new());
        let bus = Arc::new(MessageBus::new());

        let config = AgentConfig::new(
            "test-agent".to_string(),
            AgentRole::Worker,
            "claude_code".to_string(),
        );
        let agent_id = registry.register(config).await;
        bus.create_mailbox(agent_id).await;

        for i in 0..5 {
            let msg = AgentMessage::new(agent_id, agent_id, format!("msg{}", i));
            bus.send(msg).await.unwrap();
        }

        let orchestrator = Orchestrator::new(registry, bus);
        orchestrator.start().await.unwrap();

        let metrics = orchestrator.metrics().await;
        assert_eq!(metrics.total_messages, 5);
        assert!(metrics.total_iterations > 0);
    }
}
