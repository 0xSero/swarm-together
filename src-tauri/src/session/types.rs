use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Session identifier
pub type SessionId = Uuid;

/// Pane identifier
pub type PaneId = Uuid;

/// Message identifier
pub type MessageId = Uuid;

/// Block identifier
pub type BlockId = Uuid;

/// Attachment identifier
pub type AttachmentId = Uuid;

/// Session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[sqlx(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Paused,
    Completed,
    Archived,
}

/// Message type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[sqlx(rename_all = "lowercase")]
pub enum MessageType {
    UserInput,
    AgentOutput,
    SystemMessage,
    ToolCall,
    ToolResult,
}

/// Message role
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[sqlx(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
    Tool,
}

/// Block type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[sqlx(rename_all = "lowercase")]
pub enum BlockType {
    Command,
    Output,
    Error,
    Conversation,
    Artifact,
}

/// Attachment type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
#[sqlx(rename_all = "lowercase")]
pub enum AttachmentType {
    File,
    Diff,
    Log,
    Image,
    Code,
}

/// Session model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
    pub metadata: Option<String>,
}

impl Session {
    pub fn new(name: String) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            created_at: now.clone(),
            updated_at: now,
            status: "active".to_string(),
            metadata: None,
        }
    }
}

/// Pane model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Pane {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub position: i32,
    pub created_at: String,
    pub updated_at: String,
    pub active: bool,
}

impl Pane {
    pub fn new(session_id: String, name: String, position: i32) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: Uuid::new_v4().to_string(),
            session_id,
            name,
            position,
            created_at: now.clone(),
            updated_at: now,
            active: true,
        }
    }
}

/// Message model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub pane_id: Option<String>,
    pub message_type: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    pub sequence_number: i32,
    pub parent_id: Option<String>,
    pub metadata: Option<String>,
}

impl Message {
    pub fn new(
        session_id: String,
        pane_id: Option<String>,
        message_type: MessageType,
        role: MessageRole,
        content: String,
        sequence_number: i32,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            session_id,
            pane_id,
            message_type: format!("{:?}", message_type).to_lowercase(),
            role: format!("{:?}", role).to_lowercase(),
            content,
            created_at: chrono::Utc::now().to_rfc3339(),
            sequence_number,
            parent_id: None,
            metadata: None,
        }
    }
}

/// Block model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Block {
    pub id: String,
    pub session_id: String,
    pub pane_id: Option<String>,
    pub block_type: String,
    pub title: Option<String>,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub sequence_number: i32,
    pub bookmarked: bool,
    pub metadata: Option<String>,
}

impl Block {
    pub fn new(
        session_id: String,
        pane_id: Option<String>,
        block_type: BlockType,
        content: String,
        sequence_number: i32,
    ) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: Uuid::new_v4().to_string(),
            session_id,
            pane_id,
            block_type: format!("{:?}", block_type).to_lowercase(),
            title: None,
            content,
            created_at: now.clone(),
            updated_at: now,
            sequence_number,
            bookmarked: false,
            metadata: None,
        }
    }
}

/// Attachment model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Attachment {
    pub id: String,
    pub block_id: Option<String>,
    pub message_id: Option<String>,
    pub attachment_type: String,
    pub filename: Option<String>,
    pub content_type: Option<String>,
    pub size_bytes: i64,
    pub storage_path: String,
    pub created_at: String,
    pub metadata: Option<String>,
}

impl Attachment {
    pub fn new(
        attachment_type: AttachmentType,
        storage_path: String,
        size_bytes: i64,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            block_id: None,
            message_id: None,
            attachment_type: format!("{:?}", attachment_type).to_lowercase(),
            filename: None,
            content_type: None,
            size_bytes,
            storage_path,
            created_at: chrono::Utc::now().to_rfc3339(),
            metadata: None,
        }
    }
}

/// Progress event model
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProgressEvent {
    pub id: String,
    pub session_id: String,
    pub event_type: String,
    pub description: String,
    pub created_at: String,
    pub data: Option<String>,
}

impl ProgressEvent {
    pub fn new(session_id: String, event_type: String, description: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            session_id,
            event_type,
            description,
            created_at: chrono::Utc::now().to_rfc3339(),
            data: None,
        }
    }
}

// Helper methods for string conversion
impl MessageType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "userinput" => MessageType::UserInput,
            "agentoutput" => MessageType::AgentOutput,
            "systemmessage" => MessageType::SystemMessage,
            "toolcall" => MessageType::ToolCall,
            "toolresult" => MessageType::ToolResult,
            _ => MessageType::SystemMessage, // Default fallback
        }
    }
}

impl MessageRole {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "user" => MessageRole::User,
            "assistant" => MessageRole::Assistant,
            "system" => MessageRole::System,
            "tool" => MessageRole::Tool,
            _ => MessageRole::System, // Default fallback
        }
    }
}

impl BlockType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "command" => BlockType::Command,
            "output" => BlockType::Output,
            "error" => BlockType::Error,
            "conversation" => BlockType::Conversation,
            "artifact" => BlockType::Artifact,
            _ => BlockType::Output, // Default fallback
        }
    }
}
