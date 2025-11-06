use agent_manager::connectors::ollama::{OllamaConfig, OllamaConnector};
use agent_manager::connectors::types::ConnectorMessage;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

#[tokio::test]
async fn test_ollama_health_check() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "models": [
                {"name": "llama2", "size": 1000000},
                {"name": "nomic-embed-text", "size": 500000}
            ]
        })))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 1,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);
    let is_healthy = connector.check_health().await.unwrap();

    assert!(is_healthy);
}

#[tokio::test]
async fn test_ollama_list_models() {
    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "models": [
                {"name": "llama2", "size": 1000000},
                {"name": "codellama", "size": 1200000},
                {"name": "nomic-embed-text", "size": 500000}
            ]
        })))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 1,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);
    let models = connector.list_models().await.unwrap();

    assert_eq!(models.len(), 3);
    assert!(models.contains(&"llama2".to_string()));
    assert!(models.contains(&"codellama".to_string()));
    assert!(models.contains(&"nomic-embed-text".to_string()));
}

#[tokio::test]
async fn test_ollama_chat() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/generate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "model": "llama2",
            "response": "Hello! How can I help you today?",
            "done": true,
            "total_duration": 1000000,
            "prompt_eval_count": 10,
            "eval_count": 20
        })))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 1,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);
    let mut rx = connector.chat("Hello").await.unwrap();

    let mut messages = Vec::new();
    while let Some(msg) = rx.recv().await {
        messages.push(msg);
    }

    // Should have received content, usage, and done messages
    let has_content = messages.iter().any(|m| matches!(m, ConnectorMessage::Content { .. }));
    let has_usage = messages.iter().any(|m| matches!(m, ConnectorMessage::Usage { .. }));
    let has_done = messages.iter().any(|m| matches!(m, ConnectorMessage::Done));

    assert!(has_content, "Should have received content message");
    assert!(has_usage, "Should have received usage message");
    assert!(has_done, "Should have received done message");

    // Check token counts
    if let Some(ConnectorMessage::Usage { input_tokens, output_tokens }) =
        messages.iter().find(|m| matches!(m, ConnectorMessage::Usage { .. }))
    {
        assert_eq!(*input_tokens, 10);
        assert_eq!(*output_tokens, 20);
    }
}

#[tokio::test]
async fn test_ollama_embeddings() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/embeddings"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "embedding": [0.1, 0.2, 0.3, 0.4, 0.5]
        })))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 1,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);
    let embedding = connector.embed("test text").await.unwrap();

    assert_eq!(embedding.len(), 5);
    assert!((embedding[0] - 0.1).abs() < 0.001);
    assert!((embedding[4] - 0.5).abs() < 0.001);
}

#[tokio::test]
async fn test_ollama_error_handling() {
    let mock_server = MockServer::start().await;

    // Return 500 error
    Mock::given(method("POST"))
        .and(path("/api/generate"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 2,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);
    let mut rx = connector.chat("Hello").await.unwrap();

    // Should receive error message
    let mut has_error = false;
    while let Some(msg) = rx.recv().await {
        if matches!(msg, ConnectorMessage::Error { .. }) {
            has_error = true;
        }
    }

    assert!(has_error, "Should have received error message");
}

#[tokio::test]
async fn test_embedding_validation() {
    // Valid embedding
    let valid = vec![0.1, 0.2, 0.3];
    assert!(OllamaConnector::validate_embedding(&valid));

    // Empty embedding
    let empty: Vec<f32> = vec![];
    assert!(!OllamaConnector::validate_embedding(&empty));

    // Invalid with NaN
    let invalid = vec![0.1, f32::NAN, 0.3];
    assert!(!OllamaConnector::validate_embedding(&invalid));

    // Invalid with infinity
    let invalid = vec![0.1, f32::INFINITY, 0.3];
    assert!(!OllamaConnector::validate_embedding(&invalid));
}

#[tokio::test]
async fn test_connector_metrics() {
    let mock_server = MockServer::start().await;

    Mock::given(method("POST"))
        .and(path("/api/embeddings"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "embedding": [0.1, 0.2, 0.3]
        })))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 1,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);

    // Initial metrics
    let metrics = connector.metrics().await;
    assert_eq!(metrics.spawn_count, 0);
    assert_eq!(metrics.success_count, 0);

    // Make a request
    let _ = connector.embed("test").await.unwrap();

    // Check updated metrics
    let metrics = connector.metrics().await;
    assert_eq!(metrics.spawn_count, 1);
    assert_eq!(metrics.success_count, 1);
    assert!(metrics.avg_response_time_ms > 0.0);
}

#[tokio::test]
async fn test_health_status_transitions() {
    let mock_server = MockServer::start().await;

    // First request succeeds
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "models": []
        })))
        .mount(&mock_server)
        .await;

    let config = OllamaConfig {
        host: mock_server.uri(),
        port: 80,
        timeout_ms: 5000,
        max_retries: 1,
        chat_model: "llama2".to_string(),
        embedding_model: "nomic-embed-text".to_string(),
    };

    let connector = OllamaConnector::new(config);

    // Should start healthy
    let health = connector.health().await;
    assert!(matches!(health, agent_manager::connectors::types::ConnectorHealth::Healthy));

    // After successful health check, should stay healthy
    let _ = connector.check_health().await;
    let health = connector.health().await;
    assert!(matches!(health, agent_manager::connectors::types::ConnectorHealth::Healthy));
}
