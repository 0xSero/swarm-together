use super::types::{BlackboardEntry, BlackboardStats, EntryId};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;
use tokio::sync::RwLock;

/// Shared blackboard with TTL and LRU eviction
pub struct Blackboard {
    entries: Arc<RwLock<HashMap<String, BlackboardEntry>>>,
    max_entries: usize,
    stats: Arc<RwLock<BlackboardStats>>,
}

impl Blackboard {
    /// Create a new blackboard with max entry limit
    pub fn new(max_entries: usize) -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashMap::new())),
            max_entries,
            stats: Arc::new(RwLock::new(BlackboardStats::default())),
        }
    }

    /// Put an entry in the blackboard
    pub async fn put(&self, mut entry: BlackboardEntry) {
        // Touch the entry
        entry.touch();

        let mut entries = self.entries.write().await;
        let mut stats = self.stats.write().await;

        // Remove expired entries first
        self.cleanup_expired(&mut entries, &mut stats).await;

        // Check if we need to evict (LRU)
        if entries.len() >= self.max_entries && !entries.contains_key(&entry.key) {
            self.evict_lru(&mut entries, &mut stats).await;
        }

        entries.insert(entry.key.clone(), entry);
        stats.total_entries = entries.len();
    }

    /// Get an entry by key
    pub async fn get(&self, key: &str) -> Option<BlackboardEntry> {
        let mut entries = self.entries.write().await;
        let mut stats = self.stats.write().await;

        if let Some(entry) = entries.get_mut(key) {
            if entry.is_expired() {
                // Remove expired entry
                entries.remove(key);
                stats.expired_entries += 1;
                stats.miss_count += 1;
                None
            } else {
                // Touch and return
                entry.touch();
                stats.total_accesses += 1;
                stats.hit_count += 1;
                Some(entry.clone())
            }
        } else {
            stats.miss_count += 1;
            None
        }
    }

    /// Remove an entry by key
    pub async fn remove(&self, key: &str) -> bool {
        let mut entries = self.entries.write().await;
        let mut stats = self.stats.write().await;

        let removed = entries.remove(key).is_some();
        stats.total_entries = entries.len();
        removed
    }

    /// List all keys
    pub async fn keys(&self) -> Vec<String> {
        self.entries.read().await.keys().cloned().collect()
    }

    /// Get all entries
    pub async fn get_all(&self) -> Vec<BlackboardEntry> {
        self.entries.read().await.values().cloned().collect()
    }

    /// Semantic recall - find entries similar to query using embeddings
    pub async fn recall(&self, query_embedding: &[f32], top_k: usize) -> Vec<BlackboardEntry> {
        let start = std::time::Instant::now();

        let entries = self.entries.read().await;
        let mut results: Vec<(f32, BlackboardEntry)> = entries
            .values()
            .filter(|e| !e.is_expired() && e.embedding.is_some())
            .map(|e| {
                let similarity = cosine_similarity(
                    query_embedding,
                    e.embedding.as_ref().unwrap(),
                );
                (similarity, e.clone())
            })
            .collect();

        // Sort by similarity (descending)
        results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());

        // Take top-k
        let top_results: Vec<BlackboardEntry> = results
            .into_iter()
            .take(top_k)
            .map(|(_, entry)| entry)
            .collect();

        // Update stats
        let elapsed = start.elapsed().as_millis() as f64;
        let mut stats = self.stats.write().await;
        let n = (stats.hit_count + stats.miss_count) as f64;
        if n > 0.0 {
            stats.avg_recall_latency_ms = (stats.avg_recall_latency_ms * (n - 1.0) + elapsed) / n;
        } else {
            stats.avg_recall_latency_ms = elapsed;
        }

        top_results
    }

    /// Clear all entries
    pub async fn clear(&self) {
        let mut entries = self.entries.write().await;
        let mut stats = self.stats.write().await;

        entries.clear();
        stats.total_entries = 0;
    }

    /// Get statistics
    pub async fn stats(&self) -> BlackboardStats {
        let mut stats = self.stats.write().await;

        // Update expired count
        let entries = self.entries.read().await;
        stats.expired_entries = entries.values().filter(|e| e.is_expired()).count();

        stats.clone()
    }

    /// Cleanup expired entries
    async fn cleanup_expired(
        &self,
        entries: &mut HashMap<String, BlackboardEntry>,
        stats: &mut BlackboardStats,
    ) {
        let expired_keys: Vec<String> = entries
            .iter()
            .filter(|(_, e)| e.is_expired())
            .map(|(k, _)| k.clone())
            .collect();

        for key in expired_keys {
            entries.remove(&key);
            stats.expired_entries += 1;
        }

        stats.total_entries = entries.len();
    }

    /// Evict least recently used entry
    async fn evict_lru(
        &self,
        entries: &mut HashMap<String, BlackboardEntry>,
        stats: &mut BlackboardStats,
    ) {
        if let Some((lru_key, _)) = entries
            .iter()
            .min_by_key(|(_, e)| e.last_accessed)
        {
            let lru_key = lru_key.clone();
            entries.remove(&lru_key);
            stats.eviction_count += 1;
            tracing::debug!("Evicted LRU entry: {}", lru_key);
        }

        stats.total_entries = entries.len();
    }
}

/// Cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }

    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

    if magnitude_a == 0.0 || magnitude_b == 0.0 {
        0.0
    } else {
        dot_product / (magnitude_a * magnitude_b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_blackboard_put_get() {
        let bb = Blackboard::new(10);

        let entry = BlackboardEntry::new("key1".to_string(), "value1".to_string());
        bb.put(entry).await;

        let retrieved = bb.get("key1").await.unwrap();
        assert_eq!(retrieved.value, "value1");
        assert_eq!(retrieved.access_count, 1); // Touched on put, incremented on get
    }

    #[tokio::test]
    async fn test_blackboard_ttl() {
        let bb = Blackboard::new(10);

        let entry = BlackboardEntry::new("key1".to_string(), "value1".to_string())
            .with_ttl(0); // Expires immediately

        bb.put(entry).await;

        // Small delay to ensure expiration
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;

        // Should return None due to expiration
        let retrieved = bb.get("key1").await;
        assert!(retrieved.is_none());

        let stats = bb.stats().await;
        assert_eq!(stats.miss_count, 1);
    }

    #[tokio::test]
    async fn test_blackboard_lru_eviction() {
        let bb = Blackboard::new(3);

        // Add 3 entries
        for i in 0..3 {
            let entry = BlackboardEntry::new(format!("key{}", i), format!("value{}", i));
            bb.put(entry).await;
            // Small delay to ensure different timestamps
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }

        // Access key1 and key2 to update their last_accessed
        bb.get("key1").await;
        bb.get("key2").await;

        // Add a 4th entry, should evict key0 (least recently used)
        let entry = BlackboardEntry::new("key3".to_string(), "value3".to_string());
        bb.put(entry).await;

        assert!(bb.get("key0").await.is_none());
        assert!(bb.get("key1").await.is_some());
        assert!(bb.get("key2").await.is_some());
        assert!(bb.get("key3").await.is_some());
    }

    #[tokio::test]
    async fn test_blackboard_semantic_recall() {
        let bb = Blackboard::new(10);

        // Add entries with embeddings
        let e1 = BlackboardEntry::new("doc1".to_string(), "about cats".to_string())
            .with_embedding(vec![1.0, 0.0, 0.0]);
        let e2 = BlackboardEntry::new("doc2".to_string(), "about dogs".to_string())
            .with_embedding(vec![0.0, 1.0, 0.0]);
        let e3 = BlackboardEntry::new("doc3".to_string(), "about cats and dogs".to_string())
            .with_embedding(vec![0.7, 0.7, 0.0]);

        bb.put(e1).await;
        bb.put(e2).await;
        bb.put(e3).await;

        // Query for something similar to cats
        let query = vec![0.9, 0.1, 0.0];
        let results = bb.recall(&query, 2).await;

        assert_eq!(results.len(), 2);
        // Should return doc1 and doc3 (most similar to cats)
        assert!(results.iter().any(|e| e.key == "doc1"));
    }

    #[tokio::test]
    async fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert_eq!(cosine_similarity(&a, &b), 1.0);

        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        assert_eq!(cosine_similarity(&a, &b), 0.0);

        let a = vec![1.0, 1.0, 0.0];
        let b = vec![1.0, 1.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 0.001);
    }

    #[tokio::test]
    async fn test_blackboard_stats() {
        let bb = Blackboard::new(10);

        let entry = BlackboardEntry::new("key1".to_string(), "value1".to_string());
        bb.put(entry).await;

        bb.get("key1").await;
        bb.get("key_nonexistent").await;

        let stats = bb.stats().await;
        assert_eq!(stats.hit_count, 1);
        assert_eq!(stats.miss_count, 1);
        assert_eq!(stats.total_entries, 1);
    }

    #[tokio::test]
    async fn test_blackboard_clear() {
        let bb = Blackboard::new(10);

        for i in 0..5 {
            let entry = BlackboardEntry::new(format!("key{}", i), format!("value{}", i));
            bb.put(entry).await;
        }

        assert_eq!(bb.keys().await.len(), 5);

        bb.clear().await;
        assert_eq!(bb.keys().await.len(), 0);
    }
}
