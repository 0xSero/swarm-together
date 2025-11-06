import { describe, it, expect } from 'vitest'
import {
  ExportFormat,
  RedactionLevel,
  validateJsonlSession,
  validateCsvUsageRow,
  redactObject,
  redactString,
  usageToCsvRow,
  USAGE_CSV_HEADER,
  DEFAULT_RETENTION_POLICIES,
  type ExportedSession,
  type UsageExportRow,
} from './export'

describe('Export Types', () => {
  describe('JSONL Validation', () => {
    it('should validate valid session', () => {
      const session: ExportedSession = {
        id: 'session-1',
        name: 'Test Session',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        status: 'active',
        messages: [],
        blocks: [],
        metadata: {},
        export_metadata: {
          exported_at: '2025-01-01T00:00:00Z',
          export_version: '1.0.0',
          redacted: false,
        },
      }

      const result = validateJsonlSession(session)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalid = {
        name: 'Test Session',
      }

      const result = validateJsonlSession(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.includes('id'))).toBe(true)
    })

    it('should validate messages array', () => {
      const invalid = {
        id: 'session-1',
        name: 'Test',
        created_at: '2025-01-01T00:00:00Z',
        messages: 'not-an-array',
        blocks: [],
        export_metadata: {},
      }

      const result = validateJsonlSession(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Messages'))).toBe(true)
    })

    it('should validate message structure', () => {
      const invalid = {
        id: 'session-1',
        name: 'Test',
        created_at: '2025-01-01T00:00:00Z',
        messages: [
          { id: 'msg-1', role: 'user', content: 'valid' },
          { id: 'msg-2', content: 'missing role' },
        ],
        blocks: [],
        export_metadata: {},
      }

      const result = validateJsonlSession(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Message 1'))).toBe(true)
    })
  })

  describe('CSV Validation', () => {
    it('should validate valid usage row', () => {
      const row: UsageExportRow = {
        timestamp: '2025-01-01T00:00:00Z',
        session_id: 'session-1',
        agent_id: 'agent-1',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_cost_usd: 0.003,
        output_cost_usd: 0.006,
        total_cost_usd: 0.009,
        duration_ms: 1234,
        operation: 'completion',
      }

      const result = validateCsvUsageRow(row)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalid = {
        timestamp: '2025-01-01T00:00:00Z',
        provider: 'openai',
      }

      const result = validateCsvUsageRow(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should validate numeric fields', () => {
      const invalid = {
        timestamp: '2025-01-01T00:00:00Z',
        session_id: 'session-1',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 'not-a-number',
        output_tokens: 50,
        total_tokens: 150,
      }

      const result = validateCsvUsageRow(invalid)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('numeric'))).toBe(true)
    })
  })

  describe('Usage to CSV Conversion', () => {
    it('should convert usage to CSV row', () => {
      const usage = {
        timestamp: '2025-01-01T00:00:00Z',
        session_id: 'session-1',
        agent_id: 'agent-1',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        input_cost_usd: 0.003,
        output_cost_usd: 0.006,
        total_cost_usd: 0.009,
        duration_ms: 1234,
        operation: 'completion',
      }

      const row = usageToCsvRow(usage)
      expect(row.session_id).toBe('session-1')
      expect(row.input_tokens).toBe(100)
      expect(row.total_cost_usd).toBe(0.009)
    })

    it('should handle missing fields with defaults', () => {
      const partial = {
        provider: 'openai',
        model: 'gpt-4',
      }

      const row = usageToCsvRow(partial)
      expect(row.session_id).toBe('')
      expect(row.input_tokens).toBe(0)
      expect(row.operation).toBe('unknown')
    })
  })

  describe('CSV Header', () => {
    it('should have correct header fields', () => {
      expect(USAGE_CSV_HEADER).toContain('timestamp')
      expect(USAGE_CSV_HEADER).toContain('session_id')
      expect(USAGE_CSV_HEADER).toContain('provider')
      expect(USAGE_CSV_HEADER).toContain('model')
      expect(USAGE_CSV_HEADER).toContain('input_tokens')
      expect(USAGE_CSV_HEADER).toContain('total_cost_usd')
    })
  })

  describe('Redaction', () => {
    describe('String Redaction', () => {
      it('should redact API keys', () => {
        const text = 'Using API key: sk-1234567890abcdef1234567890abcdef'
        const redacted = redactString(text, RedactionLevel.BASIC)
        expect(redacted).toContain('sk-[REDACTED]')
        expect(redacted).not.toContain('sk-1234567890abcdef1234567890abcdef')
      })

      it('should redact bearer tokens', () => {
        const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
        const redacted = redactString(text, RedactionLevel.BASIC)
        expect(redacted).toContain('Bearer [REDACTED]')
        expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
      })

      it('should redact emails in full mode', () => {
        const text = 'Contact user@example.com for support'
        const redacted = redactString(text, RedactionLevel.FULL)
        expect(redacted).toContain('[EMAIL_REDACTED]')
        expect(redacted).not.toContain('user@example.com')
      })

      it('should not redact emails in basic mode', () => {
        const text = 'Contact user@example.com for support'
        const redacted = redactString(text, RedactionLevel.BASIC)
        expect(redacted).toContain('user@example.com')
      })

      it('should not redact when level is NONE', () => {
        const text = 'Using API key: sk-secret123'
        const redacted = redactString(text, RedactionLevel.NONE)
        expect(redacted).toBe(text)
      })
    })

    describe('Object Redaction', () => {
      it('should redact sensitive keys', () => {
        const obj = {
          user: 'john',
          api_key: 'sk-secret123',
          password: 'super_secret',
          data: 'normal data',
        }

        const redacted = redactObject(obj, RedactionLevel.BASIC)
        expect(redacted.user).toBe('john')
        expect(redacted.api_key).toBe('[REDACTED]')
        expect(redacted.password).toBe('[REDACTED]')
        expect(redacted.data).toBe('normal data')
      })

      it('should redact nested objects', () => {
        const obj = {
          user: {
            name: 'john',
            credentials: {
              token: 'secret-token',
              apiKey: 'secret-key',
            },
          },
        }

        const redacted = redactObject(obj, RedactionLevel.BASIC)
        expect(redacted.user.name).toBe('john')
        expect(redacted.user.credentials.token).toBe('[REDACTED]')
        expect(redacted.user.credentials.apiKey).toBe('[REDACTED]')
      })

      it('should redact patterns in string values', () => {
        const obj = {
          message: 'Login with token: sk-abc123def456ghi789jkl012mno345pqr567',
        }

        const redacted = redactObject(obj, RedactionLevel.BASIC)
        expect(redacted.message).toContain('sk-[REDACTED]')
        expect(redacted.message).not.toContain('sk-abc123def456ghi789jkl012mno345pqr567')
      })

      it('should not modify original object', () => {
        const obj = {
          api_key: 'secret',
          data: 'value',
        }

        const redacted = redactObject(obj, RedactionLevel.BASIC)
        expect(obj.api_key).toBe('secret') // Original unchanged
        expect(redacted.api_key).toBe('[REDACTED]')
      })

      it('should not redact when level is NONE', () => {
        const obj = {
          api_key: 'secret',
          password: 'pass',
        }

        const redacted = redactObject(obj, RedactionLevel.NONE)
        expect(redacted.api_key).toBe('secret')
        expect(redacted.password).toBe('pass')
      })
    })
  })

  describe('Retention Policies', () => {
    it('should have default policies', () => {
      expect(DEFAULT_RETENTION_POLICIES).toBeDefined()
      expect(DEFAULT_RETENTION_POLICIES.length).toBeGreaterThan(0)
    })

    it('should have active sessions policy', () => {
      const activePolicy = DEFAULT_RETENTION_POLICIES.find((p) => p.name === 'Active Sessions')
      expect(activePolicy).toBeDefined()
      expect(activePolicy?.applyToStatus).toContain('active')
      expect(activePolicy?.retentionDays).toBeGreaterThan(0)
    })

    it('should have archived sessions policy', () => {
      const archivedPolicy = DEFAULT_RETENTION_POLICIES.find((p) => p.name === 'Archived Sessions')
      expect(archivedPolicy).toBeDefined()
      expect(archivedPolicy?.applyToStatus).toContain('archived')
    })

    it('should have deleted sessions policy', () => {
      const deletedPolicy = DEFAULT_RETENTION_POLICIES.find((p) => p.name === 'Deleted Sessions')
      expect(deletedPolicy).toBeDefined()
      expect(deletedPolicy?.applyToStatus).toContain('deleted')
    })

    it('should have reasonable retention windows', () => {
      DEFAULT_RETENTION_POLICIES.forEach((policy) => {
        expect(policy.autoDeleteAfterDays).toBeGreaterThan(0)
        expect(policy.autoDeleteAfterDays).toBeLessThan(365) // Less than 1 year
      })
    })
  })
})
