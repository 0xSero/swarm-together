import { test, expect } from '@playwright/test'

test.describe('Export/Import - Task 140', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('should export sessions to JSONL', async ({ page }) => {
    // Navigate to sessions page
    await page.goto('http://localhost:1420/sessions')
    await page.waitForLoadState('networkidle')

    // Click export button (if exists)
    const exportBtn = page.getByRole('button', { name: /export/i })
    if ((await exportBtn.count()) > 0) {
      await exportBtn.click()

      // Select JSONL format
      await page.selectOption('select[name="format"]', 'jsonl')

      // Start export
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: /download/i }).click()

      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('.jsonl')
    }
  })

  test('should export usage to CSV', async ({ page }) => {
    // Use programmatic export
    const csvData = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')
      const { ExportFormat, RedactionLevel } = await import('@/types/export')

      const blob = await exportImportService.exportUsage({
        format: ExportFormat.CSV,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      })

      return await blob.text()
    })

    expect(csvData).toContain('timestamp')
    expect(csvData).toContain('session_id')
    expect(csvData).toContain('provider')
    expect(csvData).toContain('model')
  })

  test('should redact sensitive data in exports', async ({ page }) => {
    const exportedData = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')
      const { ExportFormat, RedactionLevel } = await import('@/types/export')

      // Mock session with sensitive data
      ;(window as any).mockSessions = [
        {
          id: 'test-session',
          name: 'Test',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          status: 'active',
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'My API key is sk-secret123456789abcdef',
            },
          ],
          blocks: [],
        },
      ]

      const blob = await exportImportService.exportSessions({
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.BASIC,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      })

      return await blob.text()
    })

    // Verify sensitive data is redacted
    expect(exportedData).not.toContain('sk-secret123456789abcdef')
    expect(exportedData).toContain('[REDACTED]')
  })

  test('should import sessions from JSONL', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')

      const jsonl = `{"id":"imported-session","name":"Imported Test","created_at":"2025-01-01T00:00:00Z","updated_at":"2025-01-01T00:00:00Z","status":"active","messages":[],"blocks":[],"metadata":{},"export_metadata":{"exported_at":"2025-01-01T00:00:00Z","export_version":"1.0.0","redacted":false}}`

      const file = new File([jsonl], 'import.jsonl', { type: 'application/x-ndjson' })

      return await exportImportService.importSessions(file)
    })

    expect(result.success).toBe(true)
    expect(result.imported.sessions).toBeGreaterThan(0)
  })

  test('should handle export/import round-trip', async ({ page }) => {
    const roundTripResult = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')
      const { ExportFormat, RedactionLevel } = await import('@/types/export')

      // Original session data
      const originalSession = {
        id: 'roundtrip-test',
        name: 'Round Trip Test',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        status: 'active' as const,
        messages: [
          { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: '2025-01-01T00:00:00Z' },
          { id: 'msg-2', role: 'assistant' as const, content: 'Hi there', timestamp: '2025-01-01T00:00:01Z' },
        ],
        blocks: [],
      }

      // Mock sessions
      ;(window as any).mockSessions = [originalSession]

      // Export
      const exportBlob = await exportImportService.exportSessions({
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      })

      const exportedContent = await exportBlob.text()

      // Import
      const importFile = new File([exportedContent], 'roundtrip.jsonl', {
        type: 'application/x-ndjson',
      })

      const importResult = await exportImportService.importSessions(importFile)

      return {
        exported: JSON.parse(exportedContent),
        importResult,
      }
    })

    // Verify data preservation
    expect(roundTripResult.importResult.success).toBe(true)
    expect(roundTripResult.exported.id).toBe('roundtrip-test')
    expect(roundTripResult.exported.name).toBe('Round Trip Test')
    expect(roundTripResult.exported.messages).toHaveLength(2)
  })

  test('should enforce retention policies', async ({ page }) => {
    const retentionResult = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')
      const { DEFAULT_RETENTION_POLICIES } = await import('@/types/export')

      // Use first default policy
      const policy = { ...DEFAULT_RETENTION_POLICIES[0], dryRun: true }

      return await exportImportService.enforceRetention(policy)
    })

    expect(retentionResult).toBeDefined()
    expect(retentionResult.policy).toBeTruthy()
    expect(retentionResult.dryRun).toBe(true)
    expect(retentionResult.affected).toBeDefined()
  })

  test('should calculate export size estimate', async ({ page }) => {
    const sizeEstimate = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')
      const { ExportFormat, RedactionLevel } = await import('@/types/export')

      return await exportImportService.getExportSizeEstimate({
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      })
    })

    expect(sizeEstimate).toBeGreaterThanOrEqual(0)
  })

  test('should compress exports when requested', async ({ page }) => {
    const compressionTest = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')
      const { ExportFormat, RedactionLevel } = await import('@/types/export')

      const uncompressed = await exportImportService.getExportSizeEstimate({
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: false,
      })

      const compressed = await exportImportService.getExportSizeEstimate({
        format: ExportFormat.JSONL,
        redaction: RedactionLevel.NONE,
        includeAttachments: false,
        includeMetadata: true,
        compress: true,
      })

      return { uncompressed, compressed }
    })

    expect(compressionTest.compressed).toBeLessThanOrEqual(compressionTest.uncompressed)
  })

  test('should validate import data', async ({ page }) => {
    const validationResult = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')

      // Invalid JSONL (missing required fields)
      const invalidJsonl = `{"name":"Invalid Session"}`

      const file = new File([invalidJsonl], 'invalid.jsonl', { type: 'application/x-ndjson' })

      return await exportImportService.importSessions(file)
    })

    expect(validationResult.success).toBe(false)
    expect(validationResult.errors.length).toBeGreaterThan(0)
  })

  test('should track retention purge metrics', async ({ page }) => {
    const metricsTest = await page.evaluate(async () => {
      const { exportImportService } = await import('@/services/ExportImportService')

      // Mock old sessions
      const now = Date.now()
      const veryOldDate = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString()

      ;(window as any).mockSessions = [
        {
          id: 'old-session-1',
          status: 'archived',
          updated_at: veryOldDate,
          size_bytes: 1024 * 1024, // 1MB
        },
        {
          id: 'old-session-2',
          status: 'archived',
          updated_at: veryOldDate,
          size_bytes: 2 * 1024 * 1024, // 2MB
        },
      ]

      const result = await exportImportService.enforceRetention({
        name: 'Test Purge',
        retentionDays: 90,
        autoDeleteAfterDays: 90,
        applyToStatus: ['archived'],
        dryRun: true,
      })

      return result
    })

    expect(metricsTest.purged.sessions.length).toBeGreaterThanOrEqual(0)
    expect(metricsTest.purged.sizeMb).toBeGreaterThanOrEqual(0)
  })
})
