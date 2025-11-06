use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AuthService {
    tokens: Arc<RwLock<HashSet<String>>>,
}

impl AuthService {
    pub fn new() -> Self {
        let mut tokens = HashSet::new();
        // Add a default development token
        tokens.insert("dev-token-local".to_string());

        Self {
            tokens: Arc::new(RwLock::new(tokens)),
        }
    }

    pub async fn validate_token(&self, token: &str) -> bool {
        let tokens = self.tokens.read().await;
        tokens.contains(token)
    }

    pub async fn add_token(&self, token: String) -> Result<(), String> {
        let mut tokens = self.tokens.write().await;
        tokens.insert(token);
        Ok(())
    }

    pub async fn remove_token(&self, token: &str) -> Result<(), String> {
        let mut tokens = self.tokens.write().await;
        if tokens.remove(token) {
            Ok(())
        } else {
            Err("Token not found".to_string())
        }
    }

    pub async fn generate_token(&self) -> String {
        let token = format!("token-{}", uuid::Uuid::new_v4());
        self.add_token(token.clone()).await.ok();
        token
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_validate_token() {
        let auth = AuthService::new();

        // Default token should work
        assert!(auth.validate_token("dev-token-local").await);

        // Invalid token should fail
        assert!(!auth.validate_token("invalid").await);
    }

    #[tokio::test]
    async fn test_add_remove_token() {
        let auth = AuthService::new();

        let token = "test-token".to_string();
        auth.add_token(token.clone()).await.unwrap();

        assert!(auth.validate_token(&token).await);

        auth.remove_token(&token).await.unwrap();
        assert!(!auth.validate_token(&token).await);
    }

    #[tokio::test]
    async fn test_generate_token() {
        let auth = AuthService::new();

        let token = auth.generate_token().await;
        assert!(auth.validate_token(&token).await);
    }
}
