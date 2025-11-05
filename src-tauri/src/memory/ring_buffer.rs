use super::types::{MemoryEntry, MemoryStats};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Ring buffer with token-based capacity
pub struct RingBuffer {
    entries: Arc<Mutex<VecDeque<MemoryEntry>>>,
    capacity_tokens: u32,
    summarization_threshold: f32, // Percentage of capacity (0.0-1.0)
    stats: Arc<Mutex<MemoryStats>>,
}

impl RingBuffer {
    /// Create a new ring buffer with token capacity
    pub fn new(capacity_tokens: u32) -> Self {
        Self {
            entries: Arc::new(Mutex::new(VecDeque::new())),
            capacity_tokens,
            summarization_threshold: 0.8, // 80% of capacity
            stats: Arc::new(Mutex::new(MemoryStats {
                capacity: capacity_tokens,
                ..Default::default()
            })),
        }
    }

    /// Create with custom summarization threshold
    pub fn with_threshold(mut self, threshold: f32) -> Self {
        self.summarization_threshold = threshold.clamp(0.0, 1.0);
        self
    }

    /// Push a new entry, evicting old entries if necessary
    pub async fn push(&self, entry: MemoryEntry) {
        let mut entries = self.entries.lock().await;
        let mut stats = self.stats.lock().await;

        // Add the new entry
        entries.push_back(entry.clone());
        stats.total_tokens += entry.token_count;
        stats.total_entries = entries.len();

        // Evict oldest entries if over capacity
        while stats.total_tokens > self.capacity_tokens {
            if let Some(evicted) = entries.pop_front() {
                stats.total_tokens -= evicted.token_count;
                stats.eviction_count += 1;
            } else {
                break;
            }
        }

        stats.total_entries = entries.len();
    }

    /// Check if summarization should be triggered
    pub async fn should_summarize(&self) -> bool {
        let stats = self.stats.lock().await;
        let usage_ratio = stats.total_tokens as f32 / self.capacity_tokens as f32;
        usage_ratio >= self.summarization_threshold
    }

    /// Get all entries
    pub async fn get_all(&self) -> Vec<MemoryEntry> {
        self.entries.lock().await.iter().cloned().collect()
    }

    /// Get recent entries (last n)
    pub async fn get_recent(&self, n: usize) -> Vec<MemoryEntry> {
        let entries = self.entries.lock().await;
        entries.iter().rev().take(n).rev().cloned().collect()
    }

    /// Clear all entries
    pub async fn clear(&self) {
        let mut entries = self.entries.lock().await;
        let mut stats = self.stats.lock().await;

        entries.clear();
        stats.total_tokens = 0;
        stats.total_entries = 0;
    }

    /// Summarize and compress the buffer
    pub async fn summarize(&self, summary: String, summary_tokens: u32) {
        let mut entries = self.entries.lock().await;
        let mut stats = self.stats.lock().await;

        // Clear old entries
        let old_token_count = stats.total_tokens;
        entries.clear();

        // Add summary as new entry
        let summary_entry = MemoryEntry::new(summary, summary_tokens);
        entries.push_back(summary_entry);

        // Update stats
        stats.total_tokens = summary_tokens;
        stats.total_entries = 1;
        stats.summarization_count += 1;

        tracing::info!(
            "Buffer summarized: {} tokens → {} tokens ({:.1}% reduction)",
            old_token_count,
            summary_tokens,
            (1.0 - summary_tokens as f32 / old_token_count as f32) * 100.0
        );
    }

    /// Get current statistics
    pub async fn stats(&self) -> MemoryStats {
        self.stats.lock().await.clone()
    }

    /// Get current token usage
    pub async fn token_count(&self) -> u32 {
        self.stats.lock().await.total_tokens
    }

    /// Get capacity
    pub fn capacity(&self) -> u32 {
        self.capacity_tokens
    }

    /// Get usage ratio (0.0-1.0)
    pub async fn usage_ratio(&self) -> f32 {
        let stats = self.stats.lock().await;
        stats.total_tokens as f32 / self.capacity_tokens as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ring_buffer_push() {
        let buffer = RingBuffer::new(100);

        let entry = MemoryEntry::new("test".to_string(), 10);
        buffer.push(entry).await;

        assert_eq!(buffer.token_count().await, 10);
        assert_eq!(buffer.get_all().await.len(), 1);
    }

    #[tokio::test]
    async fn test_ring_buffer_capacity_enforcement() {
        let buffer = RingBuffer::new(50);

        // Add entries totaling 70 tokens
        for i in 0..7 {
            let entry = MemoryEntry::new(format!("entry{}", i), 10);
            buffer.push(entry).await;
        }

        // Should have evicted oldest entries to stay under 50 tokens
        assert!(buffer.token_count().await <= 50);
    }

    #[tokio::test]
    async fn test_ring_buffer_eviction_order() {
        let buffer = RingBuffer::new(50);

        // Add 6 entries of 10 tokens each
        for i in 0..6 {
            let entry = MemoryEntry::new(format!("entry{}", i), 10);
            buffer.push(entry).await;
        }

        let entries = buffer.get_all().await;

        // Should have evicted entry0, kept entry1-5
        assert!(entries.len() <= 5);
        assert!(!entries.iter().any(|e| e.content == "entry0"));
    }

    #[tokio::test]
    async fn test_should_summarize() {
        let buffer = RingBuffer::new(100).with_threshold(0.8);

        // At 70 tokens, should not summarize
        buffer.push(MemoryEntry::new("test".to_string(), 70)).await;
        assert!(!buffer.should_summarize().await);

        // At 85 tokens, should summarize
        buffer.push(MemoryEntry::new("test2".to_string(), 15)).await;
        assert!(buffer.should_summarize().await);
    }

    #[tokio::test]
    async fn test_summarization() {
        let buffer = RingBuffer::new(100);

        // Fill buffer
        for i in 0..10 {
            buffer.push(MemoryEntry::new(format!("entry{}", i), 10)).await;
        }

        assert_eq!(buffer.token_count().await, 100);

        // Summarize
        buffer.summarize("Summary of all entries".to_string(), 20).await;

        assert_eq!(buffer.token_count().await, 20);
        assert_eq!(buffer.get_all().await.len(), 1);

        let stats = buffer.stats().await;
        assert_eq!(stats.summarization_count, 1);
    }

    #[tokio::test]
    async fn test_get_recent() {
        let buffer = RingBuffer::new(1000);

        for i in 0..10 {
            buffer.push(MemoryEntry::new(format!("entry{}", i), 10)).await;
        }

        let recent = buffer.get_recent(3).await;
        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0].content, "entry7");
        assert_eq!(recent[1].content, "entry8");
        assert_eq!(recent[2].content, "entry9");
    }

    #[tokio::test]
    async fn test_usage_ratio() {
        let buffer = RingBuffer::new(100);

        buffer.push(MemoryEntry::new("test".to_string(), 50)).await;
        assert_eq!(buffer.usage_ratio().await, 0.5);

        buffer.push(MemoryEntry::new("test2".to_string(), 30)).await;
        assert_eq!(buffer.usage_ratio().await, 0.8);
    }
}
