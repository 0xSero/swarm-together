import { describe, it, expect } from 'vitest'
import {
  transformBlock,
  groupMessagesIntoBlocks,
  extractCodeFromBlock,
  detectLanguage,
  formatBlockTimestamp,
  type Block,
  type BlockType,
} from './blocks'

describe('Block Transformations', () => {
  describe('transformBlock', () => {
    it('should strip ANSI codes when requested', () => {
      const block: Block = {
        id: 'test-1',
        session_id: 'session-1',
        block_type: 'output',
        content: '\x1b[31mError:\x1b[0m Something went wrong',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sequence_number: 0,
        bookmarked: false,
      }

      const transformed = transformBlock(block, { stripAnsiCodes: true })

      expect(transformed.content).toBe('Error: Something went wrong')
      expect(transformed.content).not.toContain('\x1b')
    })

    it('should truncate content when maxLength is specified', () => {
      const block: Block = {
        id: 'test-2',
        session_id: 'session-1',
        block_type: 'output',
        content: 'A'.repeat(200),
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sequence_number: 0,
        bookmarked: false,
      }

      const transformed = transformBlock(block, { maxLength: 100 })

      expect(transformed.content.length).toBeLessThan(120) // 100 + truncation message
      expect(transformed.content).toContain('... (truncated)')
    })

    it('should preserve original block when no options specified', () => {
      const block: Block = {
        id: 'test-3',
        session_id: 'session-1',
        block_type: 'output',
        content: 'Original content',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sequence_number: 0,
        bookmarked: false,
      }

      const transformed = transformBlock(block, {})

      expect(transformed.content).toBe(block.content)
    })
  })

  describe('groupMessagesIntoBlocks', () => {
    it('should group consecutive messages of same type into single block', () => {
      const messages = [
        {
          id: 'msg-1',
          session_id: 'session-1',
          message_type: 'userinput',
          content: 'ls',
          sequence_number: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          session_id: 'session-1',
          message_type: 'agentoutput',
          content: 'file1.txt',
          sequence_number: 1,
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          id: 'msg-3',
          session_id: 'session-1',
          message_type: 'agentoutput',
          content: 'file2.txt',
          sequence_number: 2,
          created_at: '2024-01-01T00:00:02Z',
        },
      ]

      const blocks = groupMessagesIntoBlocks(messages)

      expect(blocks).toHaveLength(2)
      expect(blocks[0].block_type).toBe('command')
      expect(blocks[0].content).toBe('ls')
      expect(blocks[1].block_type).toBe('output')
      expect(blocks[1].content).toBe('file1.txt\nfile2.txt')
    })

    it('should create separate blocks for different message types', () => {
      const messages = [
        {
          id: 'msg-1',
          session_id: 'session-1',
          message_type: 'userinput',
          content: 'command1',
          sequence_number: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          session_id: 'session-1',
          message_type: 'userinput',
          content: 'command2',
          sequence_number: 1,
          created_at: '2024-01-01T00:00:01Z',
        },
        {
          id: 'msg-3',
          session_id: 'session-1',
          message_type: 'agentoutput',
          content: 'output',
          sequence_number: 2,
          created_at: '2024-01-01T00:00:02Z',
        },
      ]

      const blocks = groupMessagesIntoBlocks(messages)

      expect(blocks).toHaveLength(2)
      expect(blocks[0].block_type).toBe('command')
      expect(blocks[0].content).toContain('command1')
      expect(blocks[0].content).toContain('command2')
      expect(blocks[1].block_type).toBe('output')
    })

    it('should handle empty message array', () => {
      const blocks = groupMessagesIntoBlocks([])

      expect(blocks).toHaveLength(0)
    })

    it('should handle error messages', () => {
      const messages = [
        {
          id: 'msg-1',
          session_id: 'session-1',
          message_type: 'error',
          content: 'Something went wrong',
          sequence_number: 0,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      const blocks = groupMessagesIntoBlocks(messages)

      expect(blocks).toHaveLength(1)
      expect(blocks[0].block_type).toBe('error')
    })
  })

  describe('extractCodeFromBlock', () => {
    it('should extract code from markdown code blocks', () => {
      const block: Block = {
        id: 'test-4',
        session_id: 'session-1',
        block_type: 'output',
        content: 'Some text\n```javascript\nconst x = 1;\n```\nMore text',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sequence_number: 0,
        bookmarked: false,
      }

      const code = extractCodeFromBlock(block)

      expect(code).toBe('const x = 1;')
    })

    it('should extract multiple code blocks', () => {
      const block: Block = {
        id: 'test-5',
        session_id: 'session-1',
        block_type: 'output',
        content: '```js\ncode1\n```\ntext\n```js\ncode2\n```',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sequence_number: 0,
        bookmarked: false,
      }

      const code = extractCodeFromBlock(block)

      expect(code).toContain('code1')
      expect(code).toContain('code2')
    })

    it('should return full content if no code blocks found', () => {
      const block: Block = {
        id: 'test-6',
        session_id: 'session-1',
        block_type: 'output',
        content: 'Just plain text',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sequence_number: 0,
        bookmarked: false,
      }

      const code = extractCodeFromBlock(block)

      expect(code).toBe('Just plain text')
    })
  })

  describe('detectLanguage', () => {
    it('should detect language from filename extension', () => {
      expect(detectLanguage('', 'test.ts')).toBe('typescript')
      expect(detectLanguage('', 'test.py')).toBe('python')
      expect(detectLanguage('', 'test.rs')).toBe('rust')
      expect(detectLanguage('', 'test.js')).toBe('javascript')
      expect(detectLanguage('', 'test.go')).toBe('go')
      expect(detectLanguage('', 'test.sh')).toBe('bash')
    })

    it('should detect language from content patterns', () => {
      expect(detectLanguage('function foo() { return 1; }')).toBe('javascript')
      expect(detectLanguage('def foo():\n    return 1')).toBe('python')
      expect(detectLanguage('fn foo() -> i32 { 1 }')).toBe('rust')
    })

    it('should fallback to text for unknown languages', () => {
      expect(detectLanguage('random content', 'unknown.xyz')).toBe('text')
      expect(detectLanguage('random content')).toBe('text')
    })
  })

  describe('formatBlockTimestamp', () => {
    it('should format recent timestamps as relative time', () => {
      const now = new Date()

      // Just now
      const justNow = new Date(now.getTime() - 30 * 1000).toISOString()
      expect(formatBlockTimestamp(justNow)).toBe('just now')

      // Minutes ago
      const minsAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
      expect(formatBlockTimestamp(minsAgo)).toBe('5m ago')

      // Hours ago
      const hoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
      expect(formatBlockTimestamp(hoursAgo)).toBe('3h ago')

      // Days ago
      const daysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
      expect(formatBlockTimestamp(daysAgo)).toBe('2d ago')
    })

    it('should format old timestamps as date', () => {
      const oldDate = new Date('2024-01-01T00:00:00Z').toISOString()
      const formatted = formatBlockTimestamp(oldDate)

      // Should be a locale date string (varies by system)
      expect(formatted).toMatch(/\d/)
    })
  })

  describe('Block Type Conversions', () => {
    it('should convert message types to block types correctly', () => {
      const testCases = [
        { messageType: 'userinput', expected: 'command' },
        { messageType: 'agentoutput', expected: 'output' },
        { messageType: 'systemmessage', expected: 'conversation' },
        { messageType: 'toolcall', expected: 'command' },
        { messageType: 'toolresult', expected: 'output' },
        { messageType: 'error', expected: 'error' },
      ]

      testCases.forEach(({ messageType, expected }) => {
        const messages = [
          {
            id: 'test',
            session_id: 'session-1',
            message_type: messageType,
            content: 'test',
            sequence_number: 0,
            created_at: '2024-01-01T00:00:00Z',
          },
        ]

        const blocks = groupMessagesIntoBlocks(messages)
        expect(blocks[0].block_type).toBe(expected)
      })
    })
  })
})
