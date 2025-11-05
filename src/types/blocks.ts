export interface Block {
  id: string
  session_id: string
  pane_id?: string
  block_type: BlockType
  title?: string
  content: string
  created_at: string
  updated_at: string
  sequence_number: number
  bookmarked: boolean
  metadata?: BlockMetadata
}

export type BlockType = 'command' | 'output' | 'error' | 'conversation' | 'artifact'

export interface BlockMetadata {
  language?: string
  exit_code?: number
  duration_ms?: number
  working_dir?: string
  environment?: Record<string, string>
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  block_id?: string
  message_id?: string
  attachment_type: AttachmentType
  filename?: string
  content_type?: string
  size_bytes: number
  storage_path: string
  created_at: string
  metadata?: AttachmentMetadata
}

export type AttachmentType = 'file' | 'diff' | 'log' | 'image' | 'code'

export interface AttachmentMetadata {
  lines?: number
  additions?: number
  deletions?: number
  preview?: string
}

export interface BlockAction {
  icon: React.ReactNode
  label: string
  onClick: () => void | Promise<void>
  disabled?: boolean
}

export interface BlockRenderMetrics {
  blockId: string
  renderTime: number
  contentSize: number
  hasAttachments: boolean
  timestamp: number
}

export interface BlockTransformOptions {
  stripAnsiCodes?: boolean
  maxLength?: number
  highlightSyntax?: boolean
  wrapLines?: boolean
}

// Block transformation utilities
export function transformBlock(block: Block, options: BlockTransformOptions = {}): Block {
  const { stripAnsiCodes = false, maxLength, highlightSyntax = true, wrapLines = true } = options

  let content = block.content

  // Strip ANSI codes if requested
  if (stripAnsiCodes) {
    content = content.replace(/\x1b\[[0-9;]*m/g, '')
  }

  // Truncate if max length specified
  if (maxLength && content.length > maxLength) {
    content = content.substring(0, maxLength) + '\n... (truncated)'
  }

  return {
    ...block,
    content,
    metadata: {
      ...block.metadata,
      highlightSyntax,
      wrapLines,
    } as BlockMetadata,
  }
}

export function groupMessagesIntoBlocks(messages: any[]): Block[] {
  const blocks: Block[] = []
  let currentBlock: Partial<Block> | null = null

  for (const message of messages) {
    const messageType = message.message_type || message.type
    const blockType = messageTypeToBlockType(messageType)

    // Start a new block if type changes or we don't have a current block
    if (!currentBlock || currentBlock.block_type !== blockType) {
      if (currentBlock) {
        blocks.push(currentBlock as Block)
      }

      currentBlock = {
        id: message.id || `block-${Date.now()}`,
        session_id: message.session_id,
        pane_id: message.pane_id,
        block_type: blockType,
        content: message.content,
        created_at: message.created_at || new Date().toISOString(),
        updated_at: message.created_at || new Date().toISOString(),
        sequence_number: message.sequence_number || 0,
        bookmarked: false,
      }
    } else {
      // Append to current block
      currentBlock.content += '\n' + message.content
      currentBlock.updated_at = message.created_at || new Date().toISOString()
    }
  }

  // Push the last block
  if (currentBlock) {
    blocks.push(currentBlock as Block)
  }

  return blocks
}

function messageTypeToBlockType(messageType: string): BlockType {
  const typeMap: Record<string, BlockType> = {
    userinput: 'command',
    agentoutput: 'output',
    systemmessage: 'conversation',
    toolcall: 'command',
    toolresult: 'output',
    error: 'error',
  }

  return typeMap[messageType?.toLowerCase()] || 'output'
}

export function extractCodeFromBlock(block: Block): string {
  // Extract code from markdown code blocks
  const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g
  const matches = Array.from(block.content.matchAll(codeBlockRegex))

  if (matches.length > 0) {
    return matches.map((m) => m[1]).join('\n\n')
  }

  return block.content
}

export function detectLanguage(content: string, filename?: string): string {
  // Detect from filename extension
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    const extMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      sh: 'bash',
      md: 'markdown',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      sql: 'sql',
    }

    if (ext && extMap[ext]) {
      return extMap[ext]
    }
  }

  // Detect from content patterns
  if (content.includes('function') && content.includes('{')) {
    return 'javascript'
  }
  if (content.includes('def ') && content.includes(':')) {
    return 'python'
  }
  if (content.includes('fn ') && content.includes('->')) {
    return 'rust'
  }

  return 'text'
}

export function formatBlockTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}
