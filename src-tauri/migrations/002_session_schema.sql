-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    metadata TEXT,
    UNIQUE(name)
);

CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);

-- Panes table (terminal panes within sessions)
CREATE TABLE IF NOT EXISTS panes (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT 1,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_panes_session ON panes(session_id);
CREATE INDEX idx_panes_position ON panes(session_id, position);

-- Messages table (agent messages, user inputs, system outputs)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    pane_id TEXT,
    message_type TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    parent_id TEXT,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (pane_id) REFERENCES panes(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_pane ON messages(pane_id);
CREATE INDEX idx_messages_sequence ON messages(session_id, sequence_number);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Blocks table (assembled message blocks for UI display)
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    pane_id TEXT,
    block_type TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    bookmarked BOOLEAN NOT NULL DEFAULT 0,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (pane_id) REFERENCES panes(id) ON DELETE SET NULL
);

CREATE INDEX idx_blocks_session ON blocks(session_id);
CREATE INDEX idx_blocks_pane ON blocks(pane_id);
CREATE INDEX idx_blocks_sequence ON blocks(session_id, sequence_number);
CREATE INDEX idx_blocks_bookmarked ON blocks(bookmarked);

-- Attachments table (files, diffs, logs, etc.)
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    block_id TEXT,
    message_id TEXT,
    attachment_type TEXT NOT NULL,
    filename TEXT,
    content_type TEXT,
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    metadata TEXT,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_block ON attachments(block_id);
CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_attachments_type ON attachments(attachment_type);

-- Progress events table (for timeline assembly)
CREATE TABLE IF NOT EXISTS progress_events (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_progress_session ON progress_events(session_id);
CREATE INDEX idx_progress_created_at ON progress_events(created_at);
