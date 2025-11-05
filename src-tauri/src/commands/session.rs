use crate::session::{
    SessionService, Session, Pane, Message, Block, Attachment, ProgressEvent,
    MessageType, MessageRole, BlockType,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;

/// Shared session service state
pub struct SessionState {
    pub service: Arc<SessionService>,
}

impl SessionState {
    pub fn new(service: SessionService) -> Self {
        Self {
            service: Arc::new(service),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePaneRequest {
    pub session_id: String,
    pub name: String,
    pub position: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddMessageRequest {
    pub session_id: String,
    pub pane_id: Option<String>,
    pub message_type: String,
    pub role: String,
    pub content: String,
    pub sequence_number: i32,
    pub parent_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBlockRequest {
    pub session_id: String,
    pub pane_id: Option<String>,
    pub block_type: String,
    pub content: String,
    pub sequence_number: i32,
}

// ===== Session commands =====

/// Create a new session
#[tauri::command]
pub async fn create_session(
    request: CreateSessionRequest,
    state: State<'_, SessionState>,
) -> Result<Session, String> {
    state.service
        .create_session(request.name)
        .await
        .map_err(|e| format!("Failed to create session: {}", e))
}

/// Get session by ID
#[tauri::command]
pub async fn get_session(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<Option<Session>, String> {
    state.service
        .get_session(&session_id)
        .await
        .map_err(|e| format!("Failed to get session: {}", e))
}

/// List all sessions
#[tauri::command]
pub async fn list_sessions(
    state: State<'_, SessionState>,
) -> Result<Vec<Session>, String> {
    state.service
        .list_sessions()
        .await
        .map_err(|e| format!("Failed to list sessions: {}", e))
}

/// Update session status
#[tauri::command]
pub async fn update_session_status(
    session_id: String,
    status: String,
    state: State<'_, SessionState>,
) -> Result<(), String> {
    use crate::session::SessionStatus;

    let session_status = match status.to_lowercase().as_str() {
        "active" => SessionStatus::Active,
        "paused" => SessionStatus::Paused,
        "completed" => SessionStatus::Completed,
        "archived" => SessionStatus::Archived,
        _ => return Err(format!("Invalid status: {}", status)),
    };

    state.service
        .update_session_status(&session_id, session_status)
        .await
        .map_err(|e| format!("Failed to update session status: {}", e))
}

/// Delete session
#[tauri::command]
pub async fn delete_session(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<(), String> {
    state.service
        .delete_session(&session_id)
        .await
        .map_err(|e| format!("Failed to delete session: {}", e))
}

// ===== Pane commands =====

/// Create a pane
#[tauri::command]
pub async fn create_pane(
    request: CreatePaneRequest,
    state: State<'_, SessionState>,
) -> Result<Pane, String> {
    state.service
        .create_pane(request.session_id, request.name, request.position)
        .await
        .map_err(|e| format!("Failed to create pane: {}", e))
}

/// List panes for a session
#[tauri::command]
pub async fn list_panes(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<Pane>, String> {
    state.service
        .list_panes(&session_id)
        .await
        .map_err(|e| format!("Failed to list panes: {}", e))
}

/// Delete pane
#[tauri::command]
pub async fn delete_pane(
    pane_id: String,
    state: State<'_, SessionState>,
) -> Result<(), String> {
    state.service
        .delete_pane(&pane_id)
        .await
        .map_err(|e| format!("Failed to delete pane: {}", e))
}

// ===== Message commands =====

/// Add a message
#[tauri::command]
pub async fn add_message(
    request: AddMessageRequest,
    state: State<'_, SessionState>,
) -> Result<Message, String> {
    let message = Message::new(
        request.session_id,
        request.pane_id,
        MessageType::from_str(&request.message_type),
        MessageRole::from_str(&request.role),
        request.content,
        request.sequence_number,
    );

    state.service
        .add_message(message)
        .await
        .map_err(|e| format!("Failed to add message: {}", e))
}

/// Get messages for a session
#[tauri::command]
pub async fn get_messages(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<Message>, String> {
    state.service
        .get_messages(&session_id)
        .await
        .map_err(|e| format!("Failed to get messages: {}", e))
}

/// Get messages for a pane
#[tauri::command]
pub async fn get_pane_messages(
    pane_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<Message>, String> {
    state.service
        .get_pane_messages(&pane_id)
        .await
        .map_err(|e| format!("Failed to get pane messages: {}", e))
}

/// Get next sequence number for session
#[tauri::command]
pub async fn get_next_sequence_number(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<i32, String> {
    state.service
        .get_next_sequence_number(&session_id)
        .await
        .map_err(|e| format!("Failed to get next sequence number: {}", e))
}

// ===== Block commands =====

/// Create a block
#[tauri::command]
pub async fn create_block(
    request: CreateBlockRequest,
    state: State<'_, SessionState>,
) -> Result<Block, String> {
    let block = Block::new(
        request.session_id,
        request.pane_id,
        BlockType::from_str(&request.block_type),
        request.content,
        request.sequence_number,
    );

    state.service
        .create_block(block)
        .await
        .map_err(|e| format!("Failed to create block: {}", e))
}

/// Get blocks for a session
#[tauri::command]
pub async fn get_blocks(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<Block>, String> {
    state.service
        .get_blocks(&session_id)
        .await
        .map_err(|e| format!("Failed to get blocks: {}", e))
}

/// Toggle bookmark on a block
#[tauri::command]
pub async fn toggle_bookmark(
    block_id: String,
    state: State<'_, SessionState>,
) -> Result<(), String> {
    state.service
        .toggle_bookmark(&block_id)
        .await
        .map_err(|e| format!("Failed to toggle bookmark: {}", e))
}

/// Assemble blocks from messages
#[tauri::command]
pub async fn assemble_blocks(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<Block>, String> {
    state.service
        .assemble_blocks(&session_id)
        .await
        .map_err(|e| format!("Failed to assemble blocks: {}", e))
}

// ===== Attachment commands =====

/// Get attachments for a block
#[tauri::command]
pub async fn get_block_attachments(
    block_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<Attachment>, String> {
    state.service
        .get_block_attachments(&block_id)
        .await
        .map_err(|e| format!("Failed to get block attachments: {}", e))
}

// ===== Progress events =====

/// Get progress timeline for a session
#[tauri::command]
pub async fn get_progress_timeline(
    session_id: String,
    state: State<'_, SessionState>,
) -> Result<Vec<ProgressEvent>, String> {
    state.service
        .get_progress_timeline(&session_id)
        .await
        .map_err(|e| format!("Failed to get progress timeline: {}", e))
}
