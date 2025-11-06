import { describe, it, expect } from 'vitest'
import {
  LogLevel,
  SpanStatus,
  HealthStatus,
  redactString,
  redactLogEntry,
  buildTraceTree,
  formatDuration,
  getLogLevelColor,
  getHealthColor,
  DEFAULT_REDACTION_RULES,
  type LogEntry,
  type TraceSpan,
} from './telemetry'

describe('Telemetry Types', () => {
  describe('Redaction', () => {
    it('should redact API keys', () => {
      const input = 'Using api_key: sk-abc123xyz789'
      const result = redactString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('sk-abc123xyz789')
    })

    it('should redact tokens', () => {
      const input = 'Authorization token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      const result = redactString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    })

    it('should redact passwords', () => {
      const input = 'User password: super_secret_123'
      const result = redactString(input)
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('super_secret_123')
    })

    it('should redact email addresses', () => {
      const input = 'Contact user@example.com for support'
      const result = redactString(input)
      expect(result).toContain('[EMAIL_REDACTED]')
      expect(result).not.toContain('user@example.com')
    })

    it('should redact bearer tokens', () => {
      const input = 'Authorization: Bearer sk-1234567890abcdef'
      const result = redactString(input)
      expect(result).toContain('Bearer [REDACTED]')
      expect(result).not.toContain('sk-1234567890abcdef')
    })

    it('should apply multiple redactions', () => {
      const input = 'User user@example.com with api_key: sk-abc123 and password: secret123'
      const result = redactString(input)
      expect(result).toContain('[EMAIL_REDACTED]')
      expect(result).toContain('[REDACTED]')
      expect(result).not.toContain('user@example.com')
      expect(result).not.toContain('sk-abc123')
      expect(result).not.toContain('secret123')
    })

    it('should redact log entry', () => {
      const entry: LogEntry = {
        id: 'log-1',
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        component: 'auth',
        message: 'User logged in with token: abc123',
        context: {
          email: 'user@example.com',
          api_key: 'sk-secret',
        },
        redacted: false,
      }

      const redacted = redactLogEntry(entry)
      expect(redacted.redacted).toBe(true)
      expect(redacted.message).toContain('[REDACTED]')
      expect(redacted.message).not.toContain('abc123')
      expect(JSON.stringify(redacted.context)).toContain('[EMAIL_REDACTED]')
      expect(JSON.stringify(redacted.context)).toContain('[REDACTED]')
    })

    it('should not modify non-sensitive data', () => {
      const input = 'Processing request from client 192.168.1.1'
      const result = redactString(input)
      expect(result).toBe(input)
    })
  })

  describe('Trace Tree', () => {
    it('should build single root tree', () => {
      const spans: TraceSpan[] = [
        {
          span_id: 'span-1',
          trace_id: 'trace-1',
          name: 'root',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
      ]

      const tree = buildTraceTree(spans)
      expect(tree).toHaveLength(1)
      expect(tree[0].span.span_id).toBe('span-1')
      expect(tree[0].depth).toBe(0)
      expect(tree[0].children).toHaveLength(0)
    })

    it('should build parent-child tree', () => {
      const spans: TraceSpan[] = [
        {
          span_id: 'span-1',
          trace_id: 'trace-1',
          name: 'root',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
        {
          span_id: 'span-2',
          parent_span_id: 'span-1',
          trace_id: 'trace-1',
          name: 'child',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
      ]

      const tree = buildTraceTree(spans)
      expect(tree).toHaveLength(1)
      expect(tree[0].span.span_id).toBe('span-1')
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].span.span_id).toBe('span-2')
      expect(tree[0].children[0].depth).toBe(1)
    })

    it('should build multi-level tree', () => {
      const spans: TraceSpan[] = [
        {
          span_id: 'span-1',
          trace_id: 'trace-1',
          name: 'root',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
        {
          span_id: 'span-2',
          parent_span_id: 'span-1',
          trace_id: 'trace-1',
          name: 'child-1',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
        {
          span_id: 'span-3',
          parent_span_id: 'span-2',
          trace_id: 'trace-1',
          name: 'grandchild',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
      ]

      const tree = buildTraceTree(spans)
      expect(tree).toHaveLength(1)
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].children).toHaveLength(1)
      expect(tree[0].children[0].children[0].depth).toBe(2)
    })

    it('should handle multiple roots', () => {
      const spans: TraceSpan[] = [
        {
          span_id: 'span-1',
          trace_id: 'trace-1',
          name: 'root-1',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
        {
          span_id: 'span-2',
          trace_id: 'trace-1',
          name: 'root-2',
          start_time: new Date().toISOString(),
          status: SpanStatus.OK,
          attributes: {},
          events: [],
        },
      ]

      const tree = buildTraceTree(spans)
      expect(tree).toHaveLength(2)
      expect(tree[0].depth).toBe(0)
      expect(tree[1].depth).toBe(0)
    })
  })

  describe('Format Duration', () => {
    it('should format microseconds', () => {
      expect(formatDuration(0.5)).toContain('µs')
    })

    it('should format milliseconds', () => {
      expect(formatDuration(50)).toContain('ms')
      expect(formatDuration(500)).toContain('ms')
    })

    it('should format seconds', () => {
      expect(formatDuration(5000)).toContain('s')
      expect(formatDuration(30000)).toContain('s')
    })

    it('should format minutes', () => {
      expect(formatDuration(120000)).toContain('m')
      expect(formatDuration(300000)).toContain('m')
    })
  })

  describe('Color Helpers', () => {
    it('should return color for log levels', () => {
      expect(getLogLevelColor(LogLevel.DEBUG)).toBeTruthy()
      expect(getLogLevelColor(LogLevel.INFO)).toBeTruthy()
      expect(getLogLevelColor(LogLevel.WARN)).toBeTruthy()
      expect(getLogLevelColor(LogLevel.ERROR)).toBeTruthy()
      expect(getLogLevelColor(LogLevel.FATAL)).toBeTruthy()
    })

    it('should return color for health status', () => {
      expect(getHealthColor(HealthStatus.HEALTHY)).toBeTruthy()
      expect(getHealthColor(HealthStatus.DEGRADED)).toBeTruthy()
      expect(getHealthColor(HealthStatus.UNHEALTHY)).toBeTruthy()
      expect(getHealthColor(HealthStatus.UNKNOWN)).toBeTruthy()
    })
  })
})
