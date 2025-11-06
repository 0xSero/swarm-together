use super::types::*;
use sqlx::{Pool, Sqlite};
use std::path::Path;

/// Session service for CRUD operations and event assembly
pub struct SessionService {
    pool: Pool<Sqlite>,
}

impl SessionService {
    /// Create a new session service
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    // ===== Session operations =====

    /// Create a new session
    pub async fn create_session(&self, name: String) -> Result<Session, sqlx::Error> {
        let session = Session::new(name);

        sqlx::query(
            "INSERT INTO sessions (id, name, created_at, updated_at, status, metadata)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&session.id)
        .bind(&session.name)
        .bind(&session.created_at)
        .bind(&session.updated_at)
        .bind(&session.status)
        .bind(&session.metadata)
        .execute(&self.pool)
        .await?;

        Ok(session)
    }

    /// Get session by ID
    pub async fn get_session(&self, id: &str) -> Result<Option<Session>, sqlx::Error> {
        sqlx::query_as::<_, Session>("SELECT * FROM sessions WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> Result<Vec<Session>, sqlx::Error> {
        sqlx::query_as::<_, Session>("SELECT * FROM sessions ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await
    }

    /// Update session status
    pub async fn update_session_status(
        &self,
        id: &str,
        status: SessionStatus,
    ) -> Result<(), sqlx::Error> {
        let now = chrono::Utc::now().to_rfc3339();
        let status_str = format!("{:?}", status).to_lowercase();

        sqlx::query("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?")
            .bind(status_str)
            .bind(now)
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Delete session
    pub async fn delete_session(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM sessions WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // ===== Pane operations =====

    /// Create a pane
    pub async fn create_pane(
        &self,
        session_id: String,
        name: String,
        position: i32,
    ) -> Result<Pane, sqlx::Error> {
        let pane = Pane::new(session_id, name, position);

        sqlx::query(
            "INSERT INTO panes (id, session_id, name, position, created_at, updated_at, active)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&pane.id)
        .bind(&pane.session_id)
        .bind(&pane.name)
        .bind(pane.position)
        .bind(&pane.created_at)
        .bind(&pane.updated_at)
        .bind(pane.active)
        .execute(&self.pool)
        .await?;

        Ok(pane)
    }

    /// List panes for a session
    pub async fn list_panes(&self, session_id: &str) -> Result<Vec<Pane>, sqlx::Error> {
        sqlx::query_as::<_, Pane>(
            "SELECT * FROM panes WHERE session_id = ? ORDER BY position"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Delete pane
    pub async fn delete_pane(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM panes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    // ===== Message operations =====

    /// Add a message
    pub async fn add_message(&self, message: Message) -> Result<Message, sqlx::Error> {
        sqlx::query(
            "INSERT INTO messages (id, session_id, pane_id, message_type, role, content, created_at, sequence_number, parent_id, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&message.id)
        .bind(&message.session_id)
        .bind(&message.pane_id)
        .bind(&message.message_type)
        .bind(&message.role)
        .bind(&message.content)
        .bind(&message.created_at)
        .bind(message.sequence_number)
        .bind(&message.parent_id)
        .bind(&message.metadata)
        .execute(&self.pool)
        .await?;

        Ok(message)
    }

    /// Get messages for a session
    pub async fn get_messages(&self, session_id: &str) -> Result<Vec<Message>, sqlx::Error> {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY sequence_number"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Get messages for a pane
    pub async fn get_pane_messages(&self, pane_id: &str) -> Result<Vec<Message>, sqlx::Error> {
        sqlx::query_as::<_, Message>(
            "SELECT * FROM messages WHERE pane_id = ? ORDER BY sequence_number"
        )
        .bind(pane_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Get next sequence number for session
    pub async fn get_next_sequence_number(&self, session_id: &str) -> Result<i32, sqlx::Error> {
        let result: Option<(i32,)> = sqlx::query_as(
            "SELECT MAX(sequence_number) FROM messages WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.and_then(|(n,)| n).unwrap_or(-1) + 1)
    }

    // ===== Block operations =====

    /// Create a block
    pub async fn create_block(&self, block: Block) -> Result<Block, sqlx::Error> {
        sqlx::query(
            "INSERT INTO blocks (id, session_id, pane_id, block_type, title, content, created_at, updated_at, sequence_number, bookmarked, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&block.id)
        .bind(&block.session_id)
        .bind(&block.pane_id)
        .bind(&block.block_type)
        .bind(&block.title)
        .bind(&block.content)
        .bind(&block.created_at)
        .bind(&block.updated_at)
        .bind(block.sequence_number)
        .bind(block.bookmarked)
        .bind(&block.metadata)
        .execute(&self.pool)
        .await?;

        Ok(block)
    }

    /// Get blocks for a session
    pub async fn get_blocks(&self, session_id: &str) -> Result<Vec<Block>, sqlx::Error> {
        sqlx::query_as::<_, Block>(
            "SELECT * FROM blocks WHERE session_id = ? ORDER BY sequence_number"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Toggle bookmark on a block
    pub async fn toggle_bookmark(&self, block_id: &str) -> Result<(), sqlx::Error> {
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            "UPDATE blocks SET bookmarked = NOT bookmarked, updated_at = ? WHERE id = ?"
        )
        .bind(now)
        .bind(block_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Assemble blocks from messages (event-to-block assembly)
    pub async fn assemble_blocks(&self, session_id: &str) -> Result<Vec<Block>, sqlx::Error> {
        let messages = self.get_messages(session_id).await?;

        let mut blocks = Vec::new();
        let mut current_block_messages: Vec<Message> = Vec::new();
        let mut sequence_number = 0;

        for message in messages {
            // Group messages into blocks based on type transitions
            if !current_block_messages.is_empty() {
                let last_type = &current_block_messages.last().unwrap().message_type;
                if last_type != &message.message_type {
                    // Create block from accumulated messages
                    if let Some(block) = self.messages_to_block(
                        &current_block_messages,
                        session_id,
                        sequence_number,
                    ) {
                        blocks.push(block);
                        sequence_number += 1;
                    }
                    current_block_messages.clear();
                }
            }

            current_block_messages.push(message);
        }

        // Handle remaining messages
        if !current_block_messages.is_empty() {
            if let Some(block) = self.messages_to_block(
                &current_block_messages,
                session_id,
                sequence_number,
            ) {
                blocks.push(block);
            }
        }

        Ok(blocks)
    }

    /// Convert messages to a block
    fn messages_to_block(
        &self,
        messages: &[Message],
        session_id: &str,
        sequence_number: i32,
    ) -> Option<Block> {
        if messages.is_empty() {
            return None;
        }

        let first_msg = &messages[0];
        let pane_id = first_msg.pane_id.clone();

        // Determine block type based on message type
        let block_type = match first_msg.message_type.as_str() {
            "userinput" => BlockType::Command,
            "agentoutput" => BlockType::Output,
            "systemmessage" => BlockType::Conversation,
            "toolcall" | "toolresult" => BlockType::Artifact,
            _ => BlockType::Output,
        };

        // Concatenate message contents
        let content = messages
            .iter()
            .map(|m| m.content.as_str())
            .collect::<Vec<&str>>()
            .join("\n");

        Some(Block::new(
            session_id.to_string(),
            pane_id,
            block_type,
            content,
            sequence_number,
        ))
    }

    // ===== Attachment operations =====

    /// Create an attachment
    pub async fn create_attachment(&self, attachment: Attachment) -> Result<Attachment, sqlx::Error> {
        sqlx::query(
            "INSERT INTO attachments (id, block_id, message_id, attachment_type, filename, content_type, size_bytes, storage_path, created_at, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&attachment.id)
        .bind(&attachment.block_id)
        .bind(&attachment.message_id)
        .bind(&attachment.attachment_type)
        .bind(&attachment.filename)
        .bind(&attachment.content_type)
        .bind(attachment.size_bytes)
        .bind(&attachment.storage_path)
        .bind(&attachment.created_at)
        .bind(&attachment.metadata)
        .execute(&self.pool)
        .await?;

        Ok(attachment)
    }

    /// Get attachments for a block
    pub async fn get_block_attachments(&self, block_id: &str) -> Result<Vec<Attachment>, sqlx::Error> {
        sqlx::query_as::<_, Attachment>(
            "SELECT * FROM attachments WHERE block_id = ? ORDER BY created_at"
        )
        .bind(block_id)
        .fetch_all(&self.pool)
        .await
    }

    // ===== Progress events =====

    /// Add a progress event
    pub async fn add_progress_event(&self, event: ProgressEvent) -> Result<ProgressEvent, sqlx::Error> {
        sqlx::query(
            "INSERT INTO progress_events (id, session_id, event_type, description, created_at, data)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&event.id)
        .bind(&event.session_id)
        .bind(&event.event_type)
        .bind(&event.description)
        .bind(&event.created_at)
        .bind(&event.data)
        .execute(&self.pool)
        .await?;

        Ok(event)
    }

    /// Get progress timeline for a session
    pub async fn get_progress_timeline(&self, session_id: &str) -> Result<Vec<ProgressEvent>, sqlx::Error> {
        sqlx::query_as::<_, ProgressEvent>(
            "SELECT * FROM progress_events WHERE session_id = ? ORDER BY created_at"
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use tempfile::NamedTempFile;

    async fn setup_test_db() -> SessionService {
        let temp_file = NamedTempFile::new().unwrap();
        let db = Database::init(temp_file.path()).await.unwrap();
        SessionService::new(db.pool().clone())
    }

    #[tokio::test]
    async fn test_create_and_get_session() {
        let service = setup_test_db().await;

        let session = service.create_session("test-session".to_string()).await.unwrap();
        assert_eq!(session.name, "test-session");

        let retrieved = service.get_session(&session.id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "test-session");
    }

    #[tokio::test]
    async fn test_list_sessions() {
        let service = setup_test_db().await;

        service.create_session("session1".to_string()).await.unwrap();
        service.create_session("session2".to_string()).await.unwrap();

        let sessions = service.list_sessions().await.unwrap();
        assert_eq!(sessions.len(), 2);
    }

    #[tokio::test]
    async fn test_create_pane() {
        let service = setup_test_db().await;

        let session = service.create_session("test-session".to_string()).await.unwrap();
        let pane = service.create_pane(session.id.clone(), "pane1".to_string(), 0).await.unwrap();

        assert_eq!(pane.name, "pane1");
        assert_eq!(pane.position, 0);

        let panes = service.list_panes(&session.id).await.unwrap();
        assert_eq!(panes.len(), 1);
    }

    #[tokio::test]
    async fn test_add_message() {
        let service = setup_test_db().await;

        let session = service.create_session("test-session".to_string()).await.unwrap();
        let message = Message::new(
            session.id.clone(),
            None,
            MessageType::UserInput,
            MessageRole::User,
            "Hello".to_string(),
            0,
        );

        service.add_message(message).await.unwrap();

        let messages = service.get_messages(&session.id).await.unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "Hello");
    }

    #[tokio::test]
    async fn test_create_block() {
        let service = setup_test_db().await;

        let session = service.create_session("test-session".to_string()).await.unwrap();
        let block = Block::new(
            session.id.clone(),
            None,
            BlockType::Command,
            "ls -la".to_string(),
            0,
        );

        service.create_block(block).await.unwrap();

        let blocks = service.get_blocks(&session.id).await.unwrap();
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].content, "ls -la");
    }

    #[tokio::test]
    async fn test_assemble_blocks_from_messages() {
        let service = setup_test_db().await;

        let session = service.create_session("test-session".to_string()).await.unwrap();

        // Add several messages
        service.add_message(Message::new(
            session.id.clone(),
            None,
            MessageType::UserInput,
            MessageRole::User,
            "First command".to_string(),
            0,
        )).await.unwrap();

        service.add_message(Message::new(
            session.id.clone(),
            None,
            MessageType::AgentOutput,
            MessageRole::Assistant,
            "First output".to_string(),
            1,
        )).await.unwrap();

        service.add_message(Message::new(
            session.id.clone(),
            None,
            MessageType::UserInput,
            MessageRole::User,
            "Second command".to_string(),
            2,
        )).await.unwrap();

        // Assemble blocks
        let blocks = service.assemble_blocks(&session.id).await.unwrap();

        // Should have 3 blocks (command, output, command)
        assert_eq!(blocks.len(), 3);
        assert_eq!(blocks[0].block_type, "command");
        assert_eq!(blocks[1].block_type, "output");
        assert_eq!(blocks[2].block_type, "command");
    }

    #[tokio::test]
    async fn test_bookmark_block() {
        let service = setup_test_db().await;

        let session = service.create_session("test-session".to_string()).await.unwrap();
        let block = Block::new(
            session.id.clone(),
            None,
            BlockType::Command,
            "important command".to_string(),
            0,
        );

        let created_block = service.create_block(block).await.unwrap();
        assert!(!created_block.bookmarked);

        service.toggle_bookmark(&created_block.id).await.unwrap();

        let blocks = service.get_blocks(&session.id).await.unwrap();
        assert!(blocks[0].bookmarked);
    }
}
