use agent_manager::db::Database;
use agent_manager::session::{
    SessionService, Session, Message, Block, MessageType, MessageRole, BlockType,
};
use tempfile::NamedTempFile;

async fn setup_test_service() -> SessionService {
    let temp_file = NamedTempFile::new().unwrap();
    let db = Database::init(temp_file.path()).await.unwrap();
    SessionService::new(db.pool().clone())
}

#[tokio::test]
async fn test_full_session_workflow() {
    let service = setup_test_service().await;

    // Create a session
    let session = service.create_session("Test Session".to_string()).await.unwrap();
    assert_eq!(session.name, "Test Session");

    // Create a pane
    let pane = service.create_pane(session.id.clone(), "Main Pane".to_string(), 0).await.unwrap();
    assert_eq!(pane.name, "Main Pane");

    // Add messages
    let msg1 = Message::new(
        session.id.clone(),
        Some(pane.id.clone()),
        MessageType::UserInput,
        MessageRole::User,
        "Hello, agent!".to_string(),
        0,
    );
    service.add_message(msg1).await.unwrap();

    let msg2 = Message::new(
        session.id.clone(),
        Some(pane.id.clone()),
        MessageType::AgentOutput,
        MessageRole::Assistant,
        "Hello! How can I help?".to_string(),
        1,
    );
    service.add_message(msg2).await.unwrap();

    // Retrieve messages
    let messages = service.get_messages(&session.id).await.unwrap();
    assert_eq!(messages.len(), 2);
    assert_eq!(messages[0].content, "Hello, agent!");
    assert_eq!(messages[1].content, "Hello! How can I help?");

    // Assemble blocks from messages
    let blocks = service.assemble_blocks(&session.id).await.unwrap();
    assert_eq!(blocks.len(), 2); // One block per message type transition

    // List sessions
    let sessions = service.list_sessions().await.unwrap();
    assert_eq!(sessions.len(), 1);
}

#[tokio::test]
async fn test_multiple_panes_in_session() {
    let service = setup_test_service().await;

    let session = service.create_session("Multi-pane Session".to_string()).await.unwrap();

    // Create multiple panes
    let pane1 = service.create_pane(session.id.clone(), "Pane 1".to_string(), 0).await.unwrap();
    let pane2 = service.create_pane(session.id.clone(), "Pane 2".to_string(), 1).await.unwrap();
    let pane3 = service.create_pane(session.id.clone(), "Pane 3".to_string(), 2).await.unwrap();

    let panes = service.list_panes(&session.id).await.unwrap();
    assert_eq!(panes.len(), 3);
    assert_eq!(panes[0].position, 0);
    assert_eq!(panes[1].position, 1);
    assert_eq!(panes[2].position, 2);

    // Add messages to different panes
    service.add_message(Message::new(
        session.id.clone(),
        Some(pane1.id.clone()),
        MessageType::UserInput,
        MessageRole::User,
        "Message in pane 1".to_string(),
        0,
    )).await.unwrap();

    service.add_message(Message::new(
        session.id.clone(),
        Some(pane2.id.clone()),
        MessageType::UserInput,
        MessageRole::User,
        "Message in pane 2".to_string(),
        1,
    )).await.unwrap();

    // Get messages for specific panes
    let pane1_messages = service.get_pane_messages(&pane1.id).await.unwrap();
    let pane2_messages = service.get_pane_messages(&pane2.id).await.unwrap();

    assert_eq!(pane1_messages.len(), 1);
    assert_eq!(pane2_messages.len(), 1);
    assert_eq!(pane1_messages[0].content, "Message in pane 1");
    assert_eq!(pane2_messages[0].content, "Message in pane 2");
}

#[tokio::test]
async fn test_block_bookmarking() {
    let service = setup_test_service().await;

    let session = service.create_session("Bookmark Test".to_string()).await.unwrap();

    // Create a block
    let block = Block::new(
        session.id.clone(),
        None,
        BlockType::Command,
        "ls -la".to_string(),
        0,
    );
    let created_block = service.create_block(block).await.unwrap();

    assert!(!created_block.bookmarked);

    // Toggle bookmark
    service.toggle_bookmark(&created_block.id).await.unwrap();

    // Verify bookmark was toggled
    let blocks = service.get_blocks(&session.id).await.unwrap();
    assert_eq!(blocks.len(), 1);
    assert!(blocks[0].bookmarked);

    // Toggle again
    service.toggle_bookmark(&created_block.id).await.unwrap();

    let blocks = service.get_blocks(&session.id).await.unwrap();
    assert!(!blocks[0].bookmarked);
}

#[tokio::test]
async fn test_session_status_updates() {
    let service = setup_test_service().await;

    let session = service.create_session("Status Test".to_string()).await.unwrap();
    assert_eq!(session.status, "active");

    // Update to paused
    use agent_manager::session::SessionStatus;
    service.update_session_status(&session.id, SessionStatus::Paused).await.unwrap();

    let updated = service.get_session(&session.id).await.unwrap().unwrap();
    assert_eq!(updated.status, "paused");

    // Update to completed
    service.update_session_status(&session.id, SessionStatus::Completed).await.unwrap();

    let updated = service.get_session(&session.id).await.unwrap().unwrap();
    assert_eq!(updated.status, "completed");
}

#[tokio::test]
async fn test_sequence_number_tracking() {
    let service = setup_test_service().await;

    let session = service.create_session("Sequence Test".to_string()).await.unwrap();

    // Get next sequence number (should be 0 for empty session)
    let seq_num = service.get_next_sequence_number(&session.id).await.unwrap();
    assert_eq!(seq_num, 0);

    // Add a message
    service.add_message(Message::new(
        session.id.clone(),
        None,
        MessageType::UserInput,
        MessageRole::User,
        "First message".to_string(),
        seq_num,
    )).await.unwrap();

    // Next sequence number should increment
    let next_seq_num = service.get_next_sequence_number(&session.id).await.unwrap();
    assert_eq!(next_seq_num, 1);

    // Add another message
    service.add_message(Message::new(
        session.id.clone(),
        None,
        MessageType::AgentOutput,
        MessageRole::Assistant,
        "Second message".to_string(),
        next_seq_num,
    )).await.unwrap();

    // Should be 2 now
    let final_seq_num = service.get_next_sequence_number(&session.id).await.unwrap();
    assert_eq!(final_seq_num, 2);
}

#[tokio::test]
async fn test_delete_cascade() {
    let service = setup_test_service().await;

    let session = service.create_session("Delete Test".to_string()).await.unwrap();

    // Create pane and messages
    let pane = service.create_pane(session.id.clone(), "Test Pane".to_string(), 0).await.unwrap();
    service.add_message(Message::new(
        session.id.clone(),
        Some(pane.id.clone()),
        MessageType::UserInput,
        MessageRole::User,
        "Test message".to_string(),
        0,
    )).await.unwrap();

    // Delete pane
    service.delete_pane(&pane.id).await.unwrap();

    // Verify pane is deleted
    let panes = service.list_panes(&session.id).await.unwrap();
    assert_eq!(panes.len(), 0);

    // Delete session
    service.delete_session(&session.id).await.unwrap();

    // Verify session is deleted
    let retrieved = service.get_session(&session.id).await.unwrap();
    assert!(retrieved.is_none());
}
