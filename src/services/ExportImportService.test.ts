import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExportImportService } from './ExportImportService'
import {
  ExportFormat,
  RedactionLevel,
  type ExportConfig,
  type RetentionPolicy,
} from '@/types/export'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}))

describe('ExportImportService', () => {
  let service: ExportImportService
  const mockInvoke = vi.fn()

  beforeEach(() => {
    service = new ExportImportService()
    vi.clearAllMocks()

    // Setup mock
    const tauri = require('@tauri-apps/api/tauri')
    tauri.invoke = mockInvoke
  })

  describe('Export Sessions', () => {
    it('should export sessions to JSONL', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          status: 'active',
          messages: [],
          blocks: [],
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const config: ExportConfig = {
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      }

      const blob = await service.exportSessions(config)
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/x-ndjson')

      const content = await blob.text()
      expect(content).toContain('session-1')
      expect(content).toContain('Test Session')
    })

    it('should apply redaction to exported sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          status: 'active',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'My API key is sk-secret123456789',
            },
          ],
          blocks: [],
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const config: ExportConfig = {
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.BASIC,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      }

      const blob = await service.exportSessions(config)
      const content = await blob.text()

      expect(content).not.toContain('sk-secret123456789')
      expect(content).toContain('[REDACTED]')
    })

    it('should filter by session IDs', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'Session 1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
        { id: 'session-2', name: 'Session 2', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const config: ExportConfig = {
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
        sessionIds: ['session-1'],
      }

      const blob = await service.exportSessions(config)
      const content = await blob.text()

      expect(content).toContain('session-1')
      expect(content).not.toContain('session-2')
    })

    it('should filter by date range', async () => {
      const mockSessions = [
        { id: 'session-1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z', name: 'Old' },
        { id: 'session-2', created_at: '2025-06-01T00:00:00Z', updated_at: '2025-06-01T00:00:00Z', name: 'New' },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const config: ExportConfig = {
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
        dateRange: {
          start: '2025-05-01T00:00:00Z',
          end: '2025-12-31T00:00:00Z',
        },
      }

      const blob = await service.exportSessions(config)
      const content = await blob.text()

      expect(content).toContain('session-2')
      expect(content).not.toContain('session-1')
    })
  })

  describe('Export Usage', () => {
    it('should export usage to CSV', async () => {
      const config: ExportConfig = {
        format: ExportFormat.CSV,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      }

      const blob = await service.exportUsage(config)
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/csv')

      const content = await blob.text()
      expect(content).toContain('timestamp')
      expect(content).toContain('session_id')
      expect(content).toContain('provider')
    })
  })

  describe('Import Sessions', () => {
    it('should import valid JSONL sessions', async () => {
      const jsonl = `{"id":"session-1","name":"Test","created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z","status":"active","messages":[],"blocks":[],"metadata":{},"export_metadata":{"exported_at":"2025-01-01T00:00:00Z","export_version":"1.0.0","redacted":false}}`

      const file = new File([jsonl], 'sessions.jsonl', { type: 'application/x-ndjson' })

      mockInvoke.mockResolvedValue({ id: 'session-1' })

      const result = await service.importSessions(file)

      expect(result.success).toBe(true)
      expect(result.imported.sessions).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle validation errors', async () => {
      const invalid = `{"name":"Missing ID"}`

      const file = new File([invalid], 'invalid.jsonl', { type: 'application/x-ndjson' })

      const result = await service.importSessions(file)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('Validation failed')
    })

    it('should handle parse errors', async () => {
      const invalid = `{invalid json}`

      const file = new File([invalid], 'invalid.jsonl', { type: 'application/x-ndjson' })

      const result = await service.importSessions(file)

      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toContain('Parse error')
    })

    it('should import multiple sessions', async () => {
      const jsonl = [
        `{"id":"session-1","name":"Test 1","created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z","status":"active","messages":[],"blocks":[],"metadata":{},"export_metadata":{"exported_at":"2025-01-01T00:00:00Z","export_version":"1.0.0","redacted":false}}`,
        `{"id":"session-2","name":"Test 2","created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z","status":"active","messages":[],"blocks":[],"metadata":{},"export_metadata":{"exported_at":"2025-01-01T00:00:00Z","export_version":"1.0.0","redacted":false}}`,
      ].join('\n')

      const file = new File([jsonl], 'sessions.jsonl', { type: 'application/x-ndjson' })

      mockInvoke.mockResolvedValue({ id: 'session-1' })

      const result = await service.importSessions(file)

      expect(result.success).toBe(true)
      expect(result.imported.sessions).toBe(2)
    })
  })

  describe('Retention Enforcement', () => {
    it('should identify sessions for archival', async () => {
      const now = Date.now()
      const oldDate = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString() // 35 days ago

      const mockSessions = [
        {
          id: 'session-1',
          status: 'active',
          updated_at: oldDate,
          message_count: 10,
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const policy: RetentionPolicy = {
        name: 'Test Policy',
        retentionDays: 90,
        autoArchiveAfterDays: 30,
        autoDeleteAfterDays: 90,
        applyToStatus: ['active'],
        dryRun: true,
      }

      const result = await service.enforceRetention(policy)

      expect(result.affected.sessions).toBeGreaterThan(0)
      expect(result.dryRun).toBe(true)
    })

    it('should identify sessions for deletion', async () => {
      const now = Date.now()
      const veryOldDate = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString() // 100 days ago

      const mockSessions = [
        {
          id: 'session-1',
          status: 'archived',
          updated_at: veryOldDate,
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const policy: RetentionPolicy = {
        name: 'Delete Old',
        retentionDays: 90,
        autoDeleteAfterDays: 90,
        applyToStatus: ['archived'],
        dryRun: true,
      }

      const result = await service.enforceRetention(policy)

      expect(result.purged.sessions).toContain('session-1')
    })

    it('should respect tag exclusions', async () => {
      const now = Date.now()
      const oldDate = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString()

      const mockSessions = [
        {
          id: 'session-1',
          status: 'archived',
          updated_at: oldDate,
          tags: ['important'],
        },
        {
          id: 'session-2',
          status: 'archived',
          updated_at: oldDate,
          tags: [],
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const policy: RetentionPolicy = {
        name: 'Delete Non-Important',
        retentionDays: 90,
        autoDeleteAfterDays: 90,
        applyToStatus: ['archived'],
        excludeIfHasTags: ['important'],
        dryRun: true,
      }

      const result = await service.enforceRetention(policy)

      expect(result.purged.sessions).not.toContain('session-1')
      expect(result.purged.sessions).toContain('session-2')
    })
  })

  describe('Export Size Estimation', () => {
    it('should estimate export size', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          messages: [{ id: 'msg-1', content: 'Hello' }],
          blocks: [],
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const config: ExportConfig = {
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      }

      const size = await service.getExportSizeEstimate(config)

      expect(size).toBeGreaterThan(0)
    })

    it('should account for compression', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Test Session',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          messages: [],
          blocks: [],
        },
      ]

      mockInvoke.mockResolvedValue(mockSessions)

      const uncompressedConfig: ExportConfig = {
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      }

      const compressedConfig: ExportConfig = {
        ...uncompressedConfig,
        compress: true,
      }

      const uncompressedSize = await service.getExportSizeEstimate(uncompressedConfig)
      const compressedSize = await service.getExportSizeEstimate(compressedConfig)

      expect(compressedSize).toBeLessThan(uncompressedSize)
    })
  })
})
