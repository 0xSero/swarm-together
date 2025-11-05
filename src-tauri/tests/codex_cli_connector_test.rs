use agent_manager::connectors::codex_cli::{CodexCliConnector, GptModel};
use agent_manager::connectors::types::{ConnectorConfig, ConnectorMessage};
use std::collections::HashMap;
use std::io::Write;
use tempfile::NamedTempFile;

/// Create a stub CLI script that simulates Codex CLI output
fn create_stub_cli() -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();

    // Create a bash script that outputs test data
    let script = r#"#!/bin/bash
# Read model command
read -r line

# Read prompt
read -r prompt

echo "Model switched to: ${line#/model }"
echo '{"type":"content","content":"Hello from GPT-5"}'
echo "Some code output"
echo '{"usage":{"prompt_tokens":75,"completion_tokens":30,"total_tokens":105}}'
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
echo "Error: Model not found" >&2
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

/// Create a stub CLI that times out
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

    let connector = CodexCliConnector::new(config);
    let mut rx = connector.execute("test prompt").await.unwrap();

    let mut messages = Vec::new();
    while let Some(msg) = rx.recv().await {
        messages.push(msg);
    }

    // Should have received multiple messages
    assert!(!messages.is_empty());

    // Check that we got different message types
    let has_content = messages.iter().any(|m| matches!(m, ConnectorMessage::Content { .. }));
    let has_usage = messages.iter().any(|m| matches!(m, ConnectorMessage::Usage { .. }));
    let has_done = messages.iter().any(|m| matches!(m, ConnectorMessage::Done));

    assert!(has_content, "Should have received content messages");
    assert!(has_usage, "Should have received usage message");
    assert!(has_done, "Should have received done message");
}

#[tokio::test]
async fn test_connector_model_switch() {
    let config = ConnectorConfig::default();
    let connector = CodexCliConnector::new(config);

    // Check default model
    assert_eq!(connector.current_model().await, GptModel::Gpt5);

    // Switch to GPT-5-Codex
    connector.switch_model(GptModel::Gpt5Codex).await.unwrap();
    assert_eq!(connector.current_model().await, GptModel::Gpt5Codex);

    // Switch to GPT-4
    connector.switch_model(GptModel::Gpt4).await.unwrap();
    assert_eq!(connector.current_model().await, GptModel::Gpt4);
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

    let connector = CodexCliConnector::new(config);
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

    let connector = CodexCliConnector::new(config);
    let result = connector.execute("test prompt").await;

    // Should fail after retries
    assert!(result.is_err());

    // Check metrics were updated
    let metrics = connector.metrics().await;
    assert!(metrics.error_count > 0);
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

    let connector = CodexCliConnector::new(config);

    // Record some usage
    connector.record_usage(150, 75).await;
    connector.record_usage(200, 100).await;

    let metrics = connector.metrics().await;
    assert_eq!(metrics.total_input_tokens, 350);
    assert_eq!(metrics.total_output_tokens, 175);
}

#[tokio::test]
async fn test_openai_usage_parsing() {
    let stub = create_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(5000),
        max_retries: 1,
    };

    let connector = CodexCliConnector::new(config);
    let mut rx = connector.execute("test prompt").await.unwrap();

    let mut usage_found = false;
    while let Some(msg) = rx.recv().await {
        if let ConnectorMessage::Usage { input_tokens, output_tokens } = msg {
            // Check that usage was parsed from the OpenAI format
            assert_eq!(input_tokens, 75);
            assert_eq!(output_tokens, 30);
            usage_found = true;
        }
    }

    assert!(usage_found, "Should have parsed OpenAI usage object");
}

#[tokio::test]
async fn test_health_status() {
    let config = ConnectorConfig::default();
    let connector = CodexCliConnector::new(config);

    let health = connector.health().await;
    assert!(matches!(health, agent_manager::connectors::types::ConnectorHealth::Healthy));
}

#[tokio::test]
async fn test_graceful_shutdown() {
    let stub = create_stub_cli();
    let config = ConnectorConfig {
        cli_path: stub.path().to_str().unwrap().to_string(),
        flags: vec![],
        env: HashMap::new(),
        timeout_ms: Some(5000),
        max_retries: 1,
    };

    let connector = CodexCliConnector::new(config);
    let mut rx = connector.execute("test prompt").await.unwrap();

    // Receive one message then drop the receiver (simulating cancellation)
    let _ = rx.recv().await;
    drop(rx);

    // Test passes if we can drop without panicking
}
