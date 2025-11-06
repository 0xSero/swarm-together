use super::types::{AgentId, AgentMessage, MessagePriority};
use std::collections::{BinaryHeap, HashMap};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};

/// Message wrapper for priority queue
#[derive(Debug, Clone)]
struct PriorityMessage {
    message: AgentMessage,
}

impl PartialEq for PriorityMessage {
    fn eq(&self, other: &Self) -> bool {
        self.message.priority == other.message.priority
    }
}

impl Eq for PriorityMessage {}

impl PartialOrd for PriorityMessage {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityMessage {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.message.priority.cmp(&other.message.priority)
    }
}

/// Mailbox for an individual agent
pub struct Mailbox {
    agent_id: AgentId,
    messages: Arc<Mutex<BinaryHeap<PriorityMessage>>>,
}

impl Mailbox {
    /// Create a new mailbox for an agent
    pub fn new(agent_id: AgentId) -> Self {
        Self {
            agent_id,
            messages: Arc::new(Mutex::new(BinaryHeap::new())),
        }
    }

    /// Push a message into the mailbox
    pub async fn push(&self, message: AgentMessage) {
        self.messages.lock().await.push(PriorityMessage { message });
    }

    /// Pop the highest priority message
    pub async fn pop(&self) -> Option<AgentMessage> {
        self.messages.lock().await.pop().map(|pm| pm.message)
    }

    /// Peek at the highest priority message without removing it
    pub async fn peek(&self) -> Option<AgentMessage> {
        self.messages
            .lock()
            .await
            .peek()
            .map(|pm| pm.message.clone())
    }

    /// Get the number of messages in the mailbox
    pub async fn len(&self) -> usize {
        self.messages.lock().await.len()
    }

    /// Check if the mailbox is empty
    pub async fn is_empty(&self) -> bool {
        self.messages.lock().await.is_empty()
    }

    /// Clear all messages
    pub async fn clear(&self) {
        self.messages.lock().await.clear();
    }
}

/// Message bus that routes messages between agents
pub struct MessageBus {
    mailboxes: Arc<RwLock<HashMap<AgentId, Arc<Mailbox>>>>,
    total_sent: Arc<Mutex<u64>>,
    total_received: Arc<Mutex<u64>>,
}

impl MessageBus {
    /// Create a new message bus
    pub fn new() -> Self {
        Self {
            mailboxes: Arc::new(RwLock::new(HashMap::new())),
            total_sent: Arc::new(Mutex::new(0)),
            total_received: Arc::new(Mutex::new(0)),
        }
    }

    /// Create a mailbox for an agent
    pub async fn create_mailbox(&self, agent_id: AgentId) -> Arc<Mailbox> {
        let mailbox = Arc::new(Mailbox::new(agent_id));
        self.mailboxes.write().await.insert(agent_id, mailbox.clone());
        mailbox
    }

    /// Remove a mailbox
    pub async fn remove_mailbox(&self, agent_id: AgentId) -> bool {
        self.mailboxes.write().await.remove(&agent_id).is_some()
    }

    /// Get a mailbox for an agent
    pub async fn get_mailbox(&self, agent_id: AgentId) -> Option<Arc<Mailbox>> {
        self.mailboxes.read().await.get(&agent_id).cloned()
    }

    /// Send a message to an agent
    pub async fn send(&self, message: AgentMessage) -> Result<(), String> {
        let mailboxes = self.mailboxes.read().await;
        if let Some(mailbox) = mailboxes.get(&message.to) {
            mailbox.push(message).await;
            *self.total_sent.lock().await += 1;
            Ok(())
        } else {
            Err(format!("Mailbox not found for agent: {}", message.to))
        }
    }

    /// Broadcast a message to all agents except sender
    pub async fn broadcast(&self, message: AgentMessage) -> usize {
        let mailboxes = self.mailboxes.read().await;
        let mut sent = 0;

        for (agent_id, mailbox) in mailboxes.iter() {
            if *agent_id != message.from {
                let mut broadcast_msg = message.clone();
                broadcast_msg.to = *agent_id;
                mailbox.push(broadcast_msg).await;
                sent += 1;
            }
        }

        *self.total_sent.lock().await += sent as u64;
        sent
    }

    /// Get total messages sent
    pub async fn total_sent(&self) -> u64 {
        *self.total_sent.lock().await
    }

    /// Get total messages received (popped from mailboxes)
    pub async fn total_received(&self) -> u64 {
        *self.total_received.lock().await
    }

    /// Increment received counter
    pub async fn mark_received(&self) {
        *self.total_received.lock().await += 1;
    }

    /// Get queue depth across all mailboxes
    pub async fn queue_depth(&self) -> usize {
        let mailboxes = self.mailboxes.read().await;
        let mut total = 0;
        for mailbox in mailboxes.values() {
            total += mailbox.len().await;
        }
        total
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mailbox_push_pop() {
        let agent_id = uuid::Uuid::new_v4();
        let mailbox = Mailbox::new(agent_id);

        let msg = AgentMessage::new(uuid::Uuid::new_v4(), agent_id, "test".to_string());
        mailbox.push(msg.clone()).await;

        assert_eq!(mailbox.len().await, 1);

        let popped = mailbox.pop().await.unwrap();
        assert_eq!(popped.content, "test");
        assert_eq!(mailbox.len().await, 0);
    }

    #[tokio::test]
    async fn test_mailbox_priority() {
        let agent_id = uuid::Uuid::new_v4();
        let mailbox = Mailbox::new(agent_id);

        let msg_low = AgentMessage::new(uuid::Uuid::new_v4(), agent_id, "low".to_string())
            .with_priority(MessagePriority::Low);
        let msg_high = AgentMessage::new(uuid::Uuid::new_v4(), agent_id, "high".to_string())
            .with_priority(MessagePriority::High);
        let msg_normal = AgentMessage::new(uuid::Uuid::new_v4(), agent_id, "normal".to_string())
            .with_priority(MessagePriority::Normal);

        mailbox.push(msg_low).await;
        mailbox.push(msg_high).await;
        mailbox.push(msg_normal).await;

        // Should pop in priority order: high, normal, low
        assert_eq!(mailbox.pop().await.unwrap().content, "high");
        assert_eq!(mailbox.pop().await.unwrap().content, "normal");
        assert_eq!(mailbox.pop().await.unwrap().content, "low");
    }

    #[tokio::test]
    async fn test_message_bus_send() {
        let bus = MessageBus::new();
        let agent_id = uuid::Uuid::new_v4();

        bus.create_mailbox(agent_id).await;

        let msg = AgentMessage::new(uuid::Uuid::new_v4(), agent_id, "test".to_string());
        bus.send(msg).await.unwrap();

        assert_eq!(bus.total_sent().await, 1);
        assert_eq!(bus.queue_depth().await, 1);
    }

    #[tokio::test]
    async fn test_message_bus_broadcast() {
        let bus = MessageBus::new();
        let agent1 = uuid::Uuid::new_v4();
        let agent2 = uuid::Uuid::new_v4();
        let agent3 = uuid::Uuid::new_v4();

        bus.create_mailbox(agent1).await;
        bus.create_mailbox(agent2).await;
        bus.create_mailbox(agent3).await;

        let msg = AgentMessage::new(agent1, agent1, "broadcast".to_string());
        let sent = bus.broadcast(msg).await;

        // Should send to 2 agents (not including sender)
        assert_eq!(sent, 2);
        assert_eq!(bus.queue_depth().await, 2);
    }

    #[tokio::test]
    async fn test_mailbox_clear() {
        let agent_id = uuid::Uuid::new_v4();
        let mailbox = Mailbox::new(agent_id);

        for i in 0..5 {
            let msg = AgentMessage::new(
                uuid::Uuid::new_v4(),
                agent_id,
                format!("msg{}", i),
            );
            mailbox.push(msg).await;
        }

        assert_eq!(mailbox.len().await, 5);

        mailbox.clear().await;
        assert_eq!(mailbox.len().await, 0);
    }
}
