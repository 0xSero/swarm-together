/**
 * Task 140: Export/Import and Data Retention
 * Types for session export, usage export, and retention policies
 */

// ============================================================================
// Export Formats
// ============================================================================

/**
 * Export format type
 */
export enum ExportFormat {
  JSONL = 'jsonl', // JSON Lines for sessions
  CSV = 'csv', // CSV for usage/metrics
  TARBALL = 'tarball', // Tar.gz for artifacts
  JSON = 'json', // Standard JSON
}

/**
 * Redaction level
 */
export enum RedactionLevel {
  NONE = 'none', // No redaction
  BASIC = 'basic', // API keys, tokens, passwords
  FULL = 'full', // All potentially sensitive data
}

// ============================================================================
// Export Configuration
// ============================================================================

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Export format */
  format: ExportFormat

  /** Redaction level */
  redaction: RedactionLevel

  /** Include attachments */
  includeAttachments: boolean

  /** Include metadata */
  includeMetadata: boolean

  /** Compress output */
  compress: boolean

  /** Date range filter */
  dateRange?: {
    start: string
    end: string
  }

  /** Session IDs to export (empty = all) */
  sessionIds?: string[]
}

// ============================================================================
// Session Export
// ============================================================================

/**
 * Exported session (JSONL line)
 */
export interface ExportedSession {
  /** Session ID */
  id: string

  /** Session name */
  name: string

  /** Creation timestamp */
  created_at: string

  /** Last activity timestamp */
  updated_at: string

  /** Session status */
  status: 'active' | 'archived' | 'deleted'

  /** Session messages */
  messages: ExportedMessage[]

  /** Session blocks */
  blocks: ExportedBlock[]

  /** Session metadata */
  metadata: Record<string, any>

  /** Export metadata */
  export_metadata: {
    exported_at: string
    export_version: string
    redacted: boolean
  }
}

/**
 * Exported message
 */
export interface ExportedMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

/**
 * Exported block
 */
export interface ExportedBlock {
  id: string
  type: string
  content: string
  timestamp: string
  metadata?: Record<string, any>
}

// ============================================================================
// Usage Export (CSV)
// ============================================================================

/**
 * Usage export row (CSV format)
 */
export interface UsageExportRow {
  timestamp: string
  session_id: string
  agent_id: string
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_cost_usd: number
  output_cost_usd: number
  total_cost_usd: number
  duration_ms: number
  operation: string
}

/**
 * Convert usage to CSV row
 */
export function usageToCsvRow(usage: any): UsageExportRow {
  return {
    timestamp: usage.timestamp || new Date().toISOString(),
    session_id: usage.session_id || '',
    agent_id: usage.agent_id || '',
    provider: usage.provider || '',
    model: usage.model || '',
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    total_tokens: usage.total_tokens || 0,
    input_cost_usd: usage.input_cost_usd || 0,
    output_cost_usd: usage.output_cost_usd || 0,
    total_cost_usd: usage.total_cost_usd || 0,
    duration_ms: usage.duration_ms || 0,
    operation: usage.operation || 'unknown',
  }
}

/**
 * CSV header row
 */
export const USAGE_CSV_HEADER = [
  'timestamp',
  'session_id',
  'agent_id',
  'provider',
  'model',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'input_cost_usd',
  'output_cost_usd',
  'total_cost_usd',
  'duration_ms',
  'operation',
]

// ============================================================================
// Artifact Export (Tarball)
// ============================================================================

/**
 * Artifact export entry
 */
export interface ArtifactEntry {
  /** File path within tarball */
  path: string

  /** File content (binary or text) */
  content: Uint8Array | string

  /** Content type */
  mimeType: string

  /** File size in bytes */
  size: number

  /** Modified timestamp */
  modifiedAt: string
}

/**
 * Artifact export manifest
 */
export interface ArtifactManifest {
  version: string
  exported_at: string
  session_id: string
  entries: Array<{
    path: string
    size: number
    mimeType: string
  }>
}

// ============================================================================
// Import Result
// ============================================================================

/**
 * Import result
 */
export interface ImportResult {
  success: boolean
  message?: string
  imported: {
    sessions: number
    messages: number
    blocks: number
    artifacts: number
  }
  errors: Array<{
    line?: number
    message: string
    data?: any
  }>
}

// ============================================================================
// Data Retention
// ============================================================================

/**
 * Retention policy
 */
export interface RetentionPolicy {
  /** Policy name */
  name: string

  /** Retention window in days */
  retentionDays: number

  /** Auto-archive after (days) */
  autoArchiveAfterDays?: number

  /** Auto-delete after (days) */
  autoDeleteAfterDays: number

  /** Apply to session status */
  applyToStatus: Array<'active' | 'archived' | 'deleted'>

  /** Exclude if has tags */
  excludeIfHasTags?: string[]

  /** Dry run mode (don't actually delete) */
  dryRun: boolean
}

/**
 * Retention enforcement result
 */
export interface RetentionEnforcementResult {
  policy: string
  executedAt: string
  dryRun: boolean
  affected: {
    sessions: number
    messages: number
    blocks: number
    attachments: number
  }
  purged: {
    sessions: string[]
    sizeMb: number
  }
  errors: string[]
}

/**
 * Default retention policies
 */
export const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  {
    name: 'Active Sessions',
    retentionDays: 90,
    autoArchiveAfterDays: 30,
    autoDeleteAfterDays: 90,
    applyToStatus: ['active'],
    dryRun: false,
  },
  {
    name: 'Archived Sessions',
    retentionDays: 180,
    autoDeleteAfterDays: 180,
    applyToStatus: ['archived'],
    dryRun: false,
  },
  {
    name: 'Deleted Sessions',
    retentionDays: 30,
    autoDeleteAfterDays: 30,
    applyToStatus: ['deleted'],
    dryRun: false,
  },
]

// ============================================================================
// Format Validators
// ============================================================================

/**
 * Validate JSONL session export
 */
export function validateJsonlSession(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.id) errors.push('Missing session id')
  if (!data.name) errors.push('Missing session name')
  if (!data.created_at) errors.push('Missing created_at timestamp')
  if (!Array.isArray(data.messages)) errors.push('Messages must be an array')
  if (!Array.isArray(data.blocks)) errors.push('Blocks must be an array')
  if (!data.export_metadata) errors.push('Missing export_metadata')

  // Validate messages
  if (Array.isArray(data.messages)) {
    data.messages.forEach((msg: any, idx: number) => {
      if (!msg.id) errors.push(`Message ${idx}: missing id`)
      if (!msg.role) errors.push(`Message ${idx}: missing role`)
      if (!msg.content) errors.push(`Message ${idx}: missing content`)
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate CSV usage row
 */
export function validateCsvUsageRow(row: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const requiredFields = [
    'timestamp',
    'session_id',
    'provider',
    'model',
    'input_tokens',
    'output_tokens',
    'total_tokens',
  ]

  requiredFields.forEach((field) => {
    if (row[field] === undefined || row[field] === null || row[field] === '') {
      errors.push(`Missing required field: ${field}`)
    }
  })

  // Validate numeric fields
  const numericFields = [
    'input_tokens',
    'output_tokens',
    'total_tokens',
    'input_cost_usd',
    'output_cost_usd',
    'total_cost_usd',
  ]
  numericFields.forEach((field) => {
    if (row[field] !== undefined && isNaN(Number(row[field]))) {
      errors.push(`${field} must be numeric`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

// ============================================================================
// Redaction Utilities
// ============================================================================

/**
 * Redact sensitive data from object
 */
export function redactObject(obj: any, level: RedactionLevel): any {
  if (level === RedactionLevel.NONE) return obj

  const cloned = JSON.parse(JSON.stringify(obj))

  const sensitiveKeys = [
    'api_key',
    'apiKey',
    'token',
    'password',
    'secret',
    'authorization',
    'bearer',
    'private_key',
    'privateKey',
  ]

  function redactRecursive(o: any): any {
    if (typeof o !== 'object' || o === null) return o

    for (const key of Object.keys(o)) {
      const lowerKey = key.toLowerCase()

      // Check if key contains sensitive terms
      const isSensitive = sensitiveKeys.some((term) => lowerKey.includes(term.toLowerCase()))

      if (isSensitive) {
        o[key] = '[REDACTED]'
      } else if (typeof o[key] === 'object') {
        o[key] = redactRecursive(o[key])
      } else if (typeof o[key] === 'string') {
        // Redact patterns in strings
        o[key] = redactString(o[key], level)
      }
    }

    return o
  }

  return redactRecursive(cloned)
}

/**
 * Redact sensitive patterns from string
 */
export function redactString(str: string, level: RedactionLevel): string {
  if (level === RedactionLevel.NONE) return str

  let result = str

  // API keys and tokens
  result = result.replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-[REDACTED]')
  result = result.replace(/pk-[a-zA-Z0-9]{32,}/g, 'pk-[REDACTED]')
  result = result.replace(/Bearer\s+[\w.-]+/gi, 'Bearer [REDACTED]')

  // Email addresses (full redaction mode only)
  if (level === RedactionLevel.FULL) {
    result = result.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
  }

  return result
}
