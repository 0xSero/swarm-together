use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub requests_per_second: u32,
    pub burst_size: u32,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_second: 100,
            burst_size: 150,
        }
    }
}

struct ClientState {
    tokens: u32,
    last_refill: SystemTime,
}

pub struct RateLimiter {
    config: RateLimitConfig,
    clients: Arc<RwLock<HashMap<String, ClientState>>>,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            config,
            clients: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn check_rate_limit(&self, client_id: &str) -> Result<(), String> {
        let mut clients = self.clients.write().await;

        let now = SystemTime::now();

        let state = clients.entry(client_id.to_string()).or_insert(ClientState {
            tokens: self.config.burst_size,
            last_refill: now,
        });

        // Refill tokens based on time elapsed
        let elapsed = now
            .duration_since(state.last_refill)
            .unwrap_or(Duration::from_secs(0));

        let refill_amount = (elapsed.as_secs_f64() * self.config.requests_per_second as f64) as u32;

        if refill_amount > 0 {
            state.tokens = (state.tokens + refill_amount).min(self.config.burst_size);
            state.last_refill = now;
        }

        // Check if we have tokens
        if state.tokens == 0 {
            return Err("Rate limit exceeded".to_string());
        }

        // Consume a token
        state.tokens -= 1;

        Ok(())
    }

    pub async fn reset_client(&self, client_id: &str) {
        let mut clients = self.clients.write().await;
        clients.remove(client_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limit_allows_requests() {
        let limiter = RateLimiter::new(RateLimitConfig::default());

        // Should allow initial requests
        for _ in 0..10 {
            assert!(limiter.check_rate_limit("client1").await.is_ok());
        }
    }

    #[tokio::test]
    async fn test_rate_limit_exhausts() {
        let limiter = RateLimiter::new(RateLimitConfig {
            requests_per_second: 10,
            burst_size: 5,
        });

        // Exhaust burst
        for _ in 0..5 {
            limiter.check_rate_limit("client1").await.ok();
        }

        // Next request should fail
        assert!(limiter.check_rate_limit("client1").await.is_err());
    }

    #[tokio::test]
    async fn test_rate_limit_refills() {
        let limiter = RateLimiter::new(RateLimitConfig {
            requests_per_second: 10,
            burst_size: 5,
        });

        // Exhaust burst
        for _ in 0..5 {
            limiter.check_rate_limit("client1").await.ok();
        }

        // Wait for refill
        tokio::time::sleep(Duration::from_millis(200)).await;

        // Should allow more requests now
        assert!(limiter.check_rate_limit("client1").await.is_ok());
    }

    #[tokio::test]
    async fn test_rate_limit_per_client() {
        let limiter = RateLimiter::new(RateLimitConfig {
            requests_per_second: 10,
            burst_size: 2,
        });

        // Exhaust client1
        limiter.check_rate_limit("client1").await.ok();
        limiter.check_rate_limit("client1").await.ok();

        // Client1 should be limited
        assert!(limiter.check_rate_limit("client1").await.is_err());

        // Client2 should still work
        assert!(limiter.check_rate_limit("client2").await.is_ok());
    }
}
