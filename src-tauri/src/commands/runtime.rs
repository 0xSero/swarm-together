use crate::runtime::{
    AgentConfig, AgentId, AgentMetadata, AgentRegistry, LoopGuard, MessageBus, Orchestrator,
    OrchestratorMetrics, StopReason,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// Runtime state
pub struct RuntimeState {
    pub registry: Arc<AgentRegistry>,
    pub message_bus: Arc<MessageBus>,
    pub orchestrator: Arc<Mutex<Option<Arc<Orchestrator>>>>,
}

impl RuntimeState {
    pub fn new() -> Self {
        let registry = Arc::new(AgentRegistry::new());
        let message_bus = Arc::new(MessageBus::new());

        Self {
            registry,
            message_bus,
            orchestrator: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterAgentRequest {
    pub config: AgentConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterAgentResponse {
    pub agent_id: String,
}

/// Register a new agent
#[tauri::command]
pub async fn register_agent(
    request: RegisterAgentRequest,
    state: State<'_, RuntimeState>,
) -> Result<RegisterAgentResponse, String> {
    let agent_id = state.registry.register(request.config).await;

    // Create mailbox for the agent
    state.message_bus.create_mailbox(agent_id).await;

    Ok(RegisterAgentResponse {
        agent_id: agent_id.to_string(),
    })
}

/// Unregister an agent
#[tauri::command]
pub async fn unregister_agent(
    agent_id: String,
    state: State<'_, RuntimeState>,
) -> Result<bool, String> {
    let agent_id = agent_id
        .parse::<uuid::Uuid>()
        .map_err(|e| format!("Invalid agent ID: {}", e))?;

    let removed = state.registry.unregister(agent_id).await;
    if removed {
        state.message_bus.remove_mailbox(agent_id).await;
    }

    Ok(removed)
}

/// List all agents
#[tauri::command]
pub async fn list_agents(state: State<'_, RuntimeState>) -> Result<Vec<AgentMetadata>, String> {
    Ok(state.registry.list_agents().await)
}

/// Get agent metadata
#[tauri::command]
pub async fn get_agent_metadata(
    agent_id: String,
    state: State<'_, RuntimeState>,
) -> Result<Option<AgentMetadata>, String> {
    let agent_id = agent_id
        .parse::<uuid::Uuid>()
        .map_err(|e| format!("Invalid agent ID: {}", e))?;

    Ok(state.registry.get_metadata(agent_id).await)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateOrchestratorRequest {
    pub max_iterations: Option<u32>,
    pub max_messages_per_agent: Option<u32>,
    pub max_execution_time_ms: Option<u64>,
}

/// Create and initialize the orchestrator
#[tauri::command]
pub async fn create_orchestrator(
    request: CreateOrchestratorRequest,
    state: State<'_, RuntimeState>,
) -> Result<String, String> {
    let mut loop_guard = LoopGuard::default();

    if let Some(max_iter) = request.max_iterations {
        loop_guard.max_iterations = max_iter;
    }
    if let Some(max_msg) = request.max_messages_per_agent {
        loop_guard.max_messages_per_agent = max_msg;
    }
    if let Some(max_time) = request.max_execution_time_ms {
        loop_guard.max_execution_time_ms = max_time;
    }

    let orchestrator = Arc::new(
        Orchestrator::new(state.registry.clone(), state.message_bus.clone())
            .with_loop_guard(loop_guard),
    );

    *state.orchestrator.lock().await = Some(orchestrator);

    Ok("Orchestrator created".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartOrchestratorResponse {
    pub stop_reason: String,
}

/// Start the orchestrator
#[tauri::command]
pub async fn start_orchestrator(
    state: State<'_, RuntimeState>,
) -> Result<StartOrchestratorResponse, String> {
    let orchestrator = state
        .orchestrator
        .lock()
        .await
        .clone()
        .ok_or_else(|| "Orchestrator not created".to_string())?;

    let stop_reason = orchestrator
        .start()
        .await
        .map_err(|e| format!("Orchestrator error: {}", e))?;

    let reason_str = match stop_reason {
        StopReason::Completed => "completed".to_string(),
        StopReason::MaxIterations => "max_iterations".to_string(),
        StopReason::MaxMessagesPerAgent { agent_id, count } => {
            format!("max_messages_per_agent:{}:{}", agent_id, count)
        }
        StopReason::MaxExecutionTime => "max_execution_time".to_string(),
        StopReason::AgentError { agent_id, error } => {
            format!("agent_error:{}:{}", agent_id, error)
        }
        StopReason::ManualStop => "manual_stop".to_string(),
    };

    Ok(StartOrchestratorResponse {
        stop_reason: reason_str,
    })
}

/// Stop the orchestrator
#[tauri::command]
pub async fn stop_orchestrator(state: State<'_, RuntimeState>) -> Result<String, String> {
    let orchestrator = state
        .orchestrator
        .lock()
        .await
        .clone()
        .ok_or_else(|| "Orchestrator not created".to_string())?;

    orchestrator.stop().await;
    Ok("Orchestrator stopped".to_string())
}

/// Get orchestrator metrics
#[tauri::command]
pub async fn get_orchestrator_metrics(
    state: State<'_, RuntimeState>,
) -> Result<OrchestratorMetrics, String> {
    let orchestrator = state
        .orchestrator
        .lock()
        .await
        .clone()
        .ok_or_else(|| "Orchestrator not created".to_string())?;

    Ok(orchestrator.metrics().await)
}

/// Get message bus queue depth
#[tauri::command]
pub async fn get_queue_depth(state: State<'_, RuntimeState>) -> Result<usize, String> {
    Ok(state.message_bus.queue_depth().await)
}
