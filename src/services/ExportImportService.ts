/**
 * Task 140: Export/Import Service
 * Service for exporting/importing sessions and enforcing retention policies
 */

import { invoke } from '@tauri-apps/api/tauri'
import {
  ExportConfig,
  ExportFormat,
  RedactionLevel,
  ExportedSession,
  UsageExportRow,
  ArtifactEntry,
  ArtifactManifest,
  ImportResult,
  RetentionPolicy,
  RetentionEnforcementResult,
  validateJsonlSession,
  validateCsvUsageRow,
  redactObject,
  usageToCsvRow,
  USAGE_CSV_HEADER,
} from '@/types/export'

/**
 * Export/Import Service
 */
export class ExportImportService {
  /**
   * Export sessions to JSONL format
   */
  async exportSessions(config: ExportConfig): Promise<Blob> {
    try {
      // Fetch sessions from backend
      const sessions = await this.fetchSessions(config.sessionIds, config.dateRange)

      // Convert to JSONL
      const lines: string[] = []
      for (const session of sessions) {
        const exported = this.convertToExportedSession(session, config.redaction)
        lines.push(JSON.stringify(exported))
      }

      const content = lines.join('\n')
      const blob = new Blob([content], { type: 'application/x-ndjson' })

      return config.compress ? await this.compress(blob) : blob
    } catch (error) {
      throw new Error(`Failed to export sessions: ${error}`)
    }
  }

  /**
   * Export usage data to CSV format
   */
  async exportUsage(config: ExportConfig): Promise<Blob> {
    try {
      // Fetch usage data
      const usageData = await this.fetchUsage(config.sessionIds, config.dateRange)

      // Convert to CSV
      const rows = usageData.map((usage) => usageToCsvRow(usage))
      const csvLines = [USAGE_CSV_HEADER.join(',')]

      for (const row of rows) {
        const values = USAGE_CSV_HEADER.map((header) => {
          const value = (row as any)[header]
          return typeof value === 'string' ? `"${value}"` : value
        })
        csvLines.push(values.join(','))
      }

      const content = csvLines.join('\n')
      const blob = new Blob([content], { type: 'text/csv' })

      return config.compress ? await this.compress(blob) : blob
    } catch (error) {
      throw new Error(`Failed to export usage: ${error}`)
    }
  }

  /**
   * Export artifacts to tarball
   */
  async exportArtifacts(config: ExportConfig): Promise<Blob> {
    try {
      // Fetch artifacts
      const artifacts = await this.fetchArtifacts(config.sessionIds)

      // Create manifest
      const manifest: ArtifactManifest = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        session_id: config.sessionIds?.[0] || 'all',
        entries: artifacts.map((a) => ({
          path: a.path,
          size: a.size,
          mimeType: a.mimeType,
        })),
      }

      // Create tarball entries
      const entries = [
        {
          path: 'manifest.json',
          content: JSON.stringify(manifest, null, 2),
          mimeType: 'application/json',
          size: 0,
          modifiedAt: new Date().toISOString(),
        },
        ...artifacts,
      ]

      // Convert to tarball (simplified - would use tar library in production)
      const blob = await this.createTarball(entries)
      return blob
    } catch (error) {
      throw new Error(`Failed to export artifacts: ${error}`)
    }
  }

  /**
   * Import sessions from JSONL
   */
  async importSessions(file: File): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      imported: { sessions: 0, messages: 0, blocks: 0, artifacts: 0 },
      errors: [],
    }

    try {
      const content = await file.text()
      const lines = content.split('\n').filter((line) => line.trim())

      for (let i = 0; i < lines.length; i++) {
        try {
          const session = JSON.parse(lines[i])

          // Validate format
          const validation = validateJsonlSession(session)
          if (!validation.valid) {
            result.errors.push({
              line: i + 1,
              message: `Validation failed: ${validation.errors.join(', ')}`,
              data: session,
            })
            continue
          }

          // Import session
          await invoke('create_session', { name: session.name })
          result.imported.sessions++
          result.imported.messages += session.messages?.length || 0
          result.imported.blocks += session.blocks?.length || 0
        } catch (error) {
          result.errors.push({
            line: i + 1,
            message: `Parse error: ${error}`,
          })
        }
      }

      result.success = result.imported.sessions > 0
      result.message = `Imported ${result.imported.sessions} sessions with ${result.errors.length} errors`

      return result
    } catch (error) {
      result.errors.push({ message: `Import failed: ${error}` })
      return result
    }
  }

  /**
   * Enforce retention policy
   */
  async enforceRetention(policy: RetentionPolicy): Promise<RetentionEnforcementResult> {
    const result: RetentionEnforcementResult = {
      policy: policy.name,
      executedAt: new Date().toISOString(),
      dryRun: policy.dryRun,
      affected: { sessions: 0, messages: 0, blocks: 0, attachments: 0 },
      purged: { sessions: [], sizeMb: 0 },
      errors: [],
    }

    try {
      // Calculate cutoff dates
      const now = new Date()
      const archiveCutoff = policy.autoArchiveAfterDays
        ? new Date(now.getTime() - policy.autoArchiveAfterDays * 24 * 60 * 60 * 1000)
        : null
      const deleteCutoff = new Date(now.getTime() - policy.autoDeleteAfterDays * 24 * 60 * 60 * 1000)

      // Fetch sessions matching policy
      const sessions = await this.fetchAllSessions()
      const affected = sessions.filter((session) => {
        // Check status matches
        if (!policy.applyToStatus.includes(session.status)) return false

        // Check exclusions
        if (policy.excludeIfHasTags && session.tags?.some((tag: string) => policy.excludeIfHasTags!.includes(tag))) {
          return false
        }

        // Check if should be affected
        const updatedAt = new Date(session.updated_at)
        return updatedAt < deleteCutoff || (archiveCutoff && updatedAt < archiveCutoff)
      })

      for (const session of affected) {
        const updatedAt = new Date(session.updated_at)

        try {
          // Archive if needed
          if (archiveCutoff && updatedAt < archiveCutoff && session.status === 'active') {
            if (!policy.dryRun) {
              await invoke('update_session_status', { sessionId: session.id, status: 'archived' })
            }
            result.affected.sessions++
          }

          // Delete if needed
          if (updatedAt < deleteCutoff) {
            if (!policy.dryRun) {
              await invoke('delete_session', { sessionId: session.id })
            }
            result.affected.sessions++
            result.purged.sessions.push(session.id)
            result.purged.sizeMb += (session.size_bytes || 0) / (1024 * 1024)
          }

          result.affected.messages += session.message_count || 0
          result.affected.blocks += session.block_count || 0
          result.affected.attachments += session.attachment_count || 0
        } catch (error) {
          result.errors.push(`Failed to process session ${session.id}: ${error}`)
        }
      }
    } catch (error) {
      result.errors.push(`Enforcement failed: ${error}`)
    }

    return result
  }

  /**
   * Get export size estimate
   */
  async getExportSizeEstimate(config: ExportConfig): Promise<number> {
    try {
      const sessions = await this.fetchSessions(config.sessionIds, config.dateRange)
      let totalSize = 0

      for (const session of sessions) {
        const exported = this.convertToExportedSession(session, config.redaction)
        totalSize += JSON.stringify(exported).length
      }

      if (config.includeAttachments) {
        const artifacts = await this.fetchArtifacts(config.sessionIds)
        totalSize += artifacts.reduce((sum, a) => sum + a.size, 0)
      }

      // Account for compression (rough estimate: 60% size reduction)
      return config.compress ? Math.floor(totalSize * 0.4) : totalSize
    } catch (error) {
      console.error('Failed to estimate export size:', error)
      return 0
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async fetchSessions(sessionIds?: string[], dateRange?: { start: string; end: string }): Promise<any[]> {
    try {
      const allSessions = await invoke<any[]>('list_sessions')

      let filtered = allSessions

      if (sessionIds && sessionIds.length > 0) {
        filtered = filtered.filter((s) => sessionIds.includes(s.id))
      }

      if (dateRange) {
        filtered = filtered.filter((s) => {
          const created = new Date(s.created_at)
          return created >= new Date(dateRange.start) && created <= new Date(dateRange.end)
        })
      }

      return filtered
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      return []
    }
  }

  private async fetchAllSessions(): Promise<any[]> {
    try {
      return await invoke<any[]>('list_sessions')
    } catch (error) {
      console.error('Failed to fetch all sessions:', error)
      return []
    }
  }

  private async fetchUsage(sessionIds?: string[], dateRange?: { start: string; end: string }): Promise<any[]> {
    // Mock implementation - would fetch from backend
    return []
  }

  private async fetchArtifacts(sessionIds?: string[]): Promise<ArtifactEntry[]> {
    // Mock implementation - would fetch from backend
    return []
  }

  private convertToExportedSession(session: any, redactionLevel: RedactionLevel): ExportedSession {
    const exported: ExportedSession = {
      id: session.id,
      name: session.name,
      created_at: session.created_at,
      updated_at: session.updated_at,
      status: session.status || 'active',
      messages: session.messages || [],
      blocks: session.blocks || [],
      metadata: session.metadata || {},
      export_metadata: {
        exported_at: new Date().toISOString(),
        export_version: '1.0.0',
        redacted: redactionLevel !== RedactionLevel.NONE,
      },
    }

    // Apply redaction
    if (redactionLevel !== RedactionLevel.NONE) {
      return redactObject(exported, redactionLevel)
    }

    return exported
  }

  private async compress(blob: Blob): Promise<Blob> {
    // Use CompressionStream if available
    if ('CompressionStream' in window) {
      const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
      return new Blob([await new Response(stream).blob()], { type: 'application/gzip' })
    }
    return blob
  }

  private async createTarball(entries: ArtifactEntry[]): Promise<Blob> {
    // Simplified tarball creation - would use proper tar library in production
    const chunks: string[] = []

    for (const entry of entries) {
      chunks.push(`--- ${entry.path} ---\n`)
      if (typeof entry.content === 'string') {
        chunks.push(entry.content)
      }
      chunks.push('\n')
    }

    return new Blob([chunks.join('')], { type: 'application/x-tar' })
  }
}

// Singleton instance
export const exportImportService = new ExportImportService()
