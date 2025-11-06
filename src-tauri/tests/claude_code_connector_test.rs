use agent_manager::connectors::claude_code::ClaudeCodeConnector;
use agent_manager::connectors::types::{ConnectorConfig, ConnectorMessage};
use std::collections::HashMap;
use std::io::Write;
use std::process::{Command, Stdio};
use tempfile::NamedTempFile;

/// Create a stub CLI script that simulates Claude Code output
fn create_stub_cli() -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();

    // Create a bash script that outputs test data
    let script = r#"#!/bin/bash
echo "Starting Claude Code..."
echo '{"type":"content","content":"Hello from Claude"}'
echo "Some plain text output"
echo "input: 50 tokens, output: 25 tokens"
echo '{"type":"done"}'
exit 0
"#;

    file.write_all(script.as_bytes()).unwrap();
    file.flush().unwrap();

    // Make it executable
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(file.path()).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(file.path(), perms).unwrap();
    }

    file
}

/// Create a stub CLI that fails
fn create_failing_stub_cli() -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();

    let script = r#"#!/bin/bash
echo "Error: Something went wrong" >&2
exit 1
"#;

    file.write_all(script.as_bytes()).unwrap();
    file.flush().unwrap();

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(file.path()).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(file.path(), perms).unwrap();
    }

    file
}

/// Create a stub CLI that times out (sleeps for a long time)
fn create_timeout_stub_cli() -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();

    let script = r#"#!/bin/bash
sleep 10
exit 0
"#;

    file.write_all(script.as_bytes()).unwrap();
    file.flush().unwrap();

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(file.path()).unwrap().permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(file.path(), perms).unwrap();
    }

    file
}

#[tokio::test]
async fn test_connector_spawn_and_stream() {
    let stub = create_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(5000),
        max_retries: 1,
    };

    let connector = ClaudeCodeConnector::new(config);
    let mut rx = connector.execute("test prompt").await.unwrap();

    let mut messages = Vec::new();
    while let Some(msg) = rx.recv().await {
        messages.push(msg);
    }

    // Should have received multiple messages
    assert!(!messages.is_empty());

    // Check that we got different message types
    let has_content = messages.iter().any(|m| matches!(m, ConnectorMessage::Content { .. }));
    let has_done = messages.iter().any(|m| matches!(m, ConnectorMessage::Done));

    assert!(has_content, "Should have received content messages");
    assert!(has_done, "Should have received done message");
}

#[tokio::test]
async fn test_connector_timeout() {
    let stub = create_timeout_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(500), // 500ms timeout
        max_retries: 1,
    };

    let connector = ClaudeCodeConnector::new(config);
    let result = connector.execute("test prompt").await;

    // Should timeout
    assert!(result.is_err());
}

#[tokio::test]
async fn test_connector_retry_logic() {
    let stub = create_failing_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(5000),
        max_retries: 3,
    };

    let connector = ClaudeCodeConnector::new(config);
    let result = connector.execute("test prompt").await;

    // Should fail after retries
    assert!(result.is_err());

    // Check metrics were updated
    let metrics = connector.metrics().await;
    assert!(metrics.error_count > 0);
}

#[tokio::test]
async fn test_connector_cancellation() {
    let stub = create_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(5000),
        max_retries: 1,
    };

    let connector = ClaudeCodeConnector::new(config);
    let mut rx = connector.execute("test prompt").await.unwrap();

    // Receive one message then drop the receiver (simulating cancellation)
    let _ = rx.recv().await;
    drop(rx);

    // Test passes if we can drop without panicking
}

#[tokio::test]
async fn test_usage_tracking() {
    let stub = create_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(5000),
        max_retries: 1,
    };

    let connector = ClaudeCodeConnector::new(config);

    // Record some usage
    connector.record_usage(100, 50).await;
    connector.record_usage(200, 75).await;

    let metrics = connector.metrics().await;
    assert_eq!(metrics.total_input_tokens, 300);
    assert_eq!(metrics.total_output_tokens, 125);
}

#[tokio::test]
async fn test_health_status() {
    let config = ConnectorConfig::default();
    let connector = ClaudeCodeConnector::new(config);

    let health = connector.health().await;
    assert!(matches!(health, agent_manager::connectors::types::ConnectorHealth::Healthy));
}
