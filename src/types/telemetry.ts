/**
 * Task 120: Telemetry and Debug Panel
 * Structured logging, traces, metrics, and debug panel types
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Log severity levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Trace span status
 */
export enum SpanStatus {
  OK = 'ok',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

/**
 * Component health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

// ============================================================================
// Structured Log Entry
// ============================================================================

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Unique log ID */
  id: string

  /** Timestamp in ISO format */
  timestamp: string

  /** Log level */
  level: LogLevel

  /** Component/service name */
  component: string

  /** Log message */
  message: string

  /** Optional context data */
  context?: Record<string, any>

  /** Optional error details */
  error?: {
    name: string
    message: string
    stack?: string
  }

  /** Optional trace span ID */
  span_id?: string

  /** Whether log has been redacted */
  redacted: boolean
}

/**
 * Log filter criteria
 */
export interface LogFilter {
  level?: LogLevel
  component?: string
  search?: string
  since?: string
  until?: string
}

// ============================================================================
// Trace Spans
// ============================================================================

/**
 * Trace span (OpenTelemetry-style)
 */
export interface TraceSpan {
  /** Unique span ID */
  span_id: string

  /** Parent span ID (if any) */
  parent_span_id?: string

  /** Trace ID (groups related spans) */
  trace_id: string

  /** Operation name */
  name: string

  /** Start timestamp */
  start_time: string

  /** End timestamp */
  end_time?: string

  /** Span duration in milliseconds */
  duration_ms?: number

  /** Span status */
  status: SpanStatus

  /** Span attributes */
  attributes: Record<string, any>

  /** Span events */
  events: SpanEvent[]
}

/**
 * Event within a span
 */
export interface SpanEvent {
  timestamp: string
  name: string
  attributes?: Record<string, any>
}

/**
 * Trace tree node (for visualization)
 */
export interface TraceNode {
  span: TraceSpan
  children: TraceNode[]
  depth: number
}

// ============================================================================
// Metrics
// ============================================================================

/**
 * Metric data point
 */
export interface Metric {
  /** Metric name */
  name: string

  /** Metric type */
  type: MetricType

  /** Metric value */
  value: number

  /** Timestamp */
  timestamp: string

  /** Labels/tags */
  labels: Record<string, string>

  /** Optional unit */
  unit?: string
}

/**
 * Aggregated metric (over time window)
 */
export interface MetricAggregate {
  name: string
  type: MetricType
  count: number
  sum: number
  min: number
  max: number
  avg: number
  p50?: number
  p95?: number
  p99?: number
  labels: Record<string, string>
  window_start: string
  window_end: string
}

// ============================================================================
// Component Health
// ============================================================================

/**
 * Health check result
 */
export interface HealthCheck {
  /** Component name */
  component: string

  /** Health status */
  status: HealthStatus

  /** Last check timestamp */
  last_check: string

  /** Optional status message */
  message?: string

  /** Detailed checks */
  checks: {
    name: string
    status: HealthStatus
    message?: string
    value?: any
  }[]

  /** Response time in milliseconds */
  response_time_ms: number
}

/**
 * Connector-specific health
 */
export interface ConnectorHealth extends HealthCheck {
  connector_type: 'claude-code' | 'codex' | 'ollama'
  connected: boolean
  last_request?: string
  request_count: number
  error_count: number
  error_rate: number
}

// ============================================================================
// Debug Panel State
// ============================================================================

/**
 * Debug panel configuration
 */
export interface DebugPanelConfig {
  /** Auto-scroll event stream */
  auto_scroll: boolean

  /** Maximum events to keep */
  max_events: number

  /** Refresh interval in milliseconds */
  refresh_interval_ms: number

  /** Enable log redaction */
  enable_redaction: boolean

  /** Sensitive field patterns to redact */
  redaction_patterns: string[]
}

/**
 * Debug panel state
 */
export interface DebugPanelState {
  /** Recent log entries */
  logs: LogEntry[]

  /** Active trace spans */
  spans: TraceSpan[]

  /** Recent metrics */
  metrics: Metric[]

  /** Component health status */
  health: HealthCheck[]

  /** Connector health */
  connectors: ConnectorHealth[]

  /** Number of dropped events */
  dropped_events: number

  /** Panel performance metrics */
  performance: {
    render_time_ms: number
    event_processing_rate: number
  }
}

// ============================================================================
// Telemetry Events
// ============================================================================

/**
 * Telemetry event (for streaming)
 */
export type TelemetryEvent =
  | { type: 'log'; data: LogEntry }
  | { type: 'span'; data: TraceSpan }
  | { type: 'metric'; data: Metric }
  | { type: 'health'; data: HealthCheck }

// ============================================================================
// Crash Recovery
// ============================================================================

/**
 * Crash report
 */
export interface CrashReport {
  /** Crash ID */
  id: string

  /** Crash timestamp */
  timestamp: string

  /** Error details */
  error: {
    name: string
    message: string
    stack?: string
  }

  /** Application state at crash */
  state: {
    component: string
    context?: Record<string, any>
  }

  /** Recent log entries */
  recent_logs: LogEntry[]

  /** Active spans at crash */
  active_spans: TraceSpan[]
}

// ============================================================================
// Redaction
// ============================================================================

/**
 * Redaction rule
 */
export interface RedactionRule {
  /** Rule name */
  name: string

  /** Field pattern (regex) */
  pattern: RegExp

  /** Replacement text */
  replacement: string

  /** Whether to apply to all strings */
  global: boolean
}

/**
 * Default redaction rules for sensitive data
 */
export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  {
    name: 'api_key',
    pattern: /api[_-]?key['":\s]*([\w-]+)/gi,
    replacement: 'api_key: [REDACTED]',
    global: true,
  },
  {
    name: 'token',
    pattern: /token['":\s]*([\w.-]+)/gi,
    replacement: 'token: [REDACTED]',
    global: true,
  },
  {
    name: 'password',
    pattern: /password['":\s]*([\w@#$%^&*]+)/gi,
    replacement: 'password: [REDACTED]',
    global: true,
  },
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
    global: true,
  },
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[\w.-]+/gi,
    replacement: 'Bearer [REDACTED]',
    global: true,
  },
]

// ============================================================================
// Utilities
// ============================================================================

/**
 * Apply redaction rules to a string
 */
export function redactString(input: string, rules: RedactionRule[] = DEFAULT_REDACTION_RULES): string {
  let result = input
  for (const rule of rules) {
    result = result.replace(rule.pattern, rule.replacement)
  }
  return result
}

/**
 * Apply redaction to a log entry
 */
export function redactLogEntry(entry: LogEntry, rules?: RedactionRule[]): LogEntry {
  return {
    ...entry,
    message: redactString(entry.message, rules),
    context: entry.context
      ? Object.fromEntries(
          Object.entries(entry.context).map(([k, v]) => [
            k,
            typeof v === 'string' ? redactString(v, rules) : v,
          ])
        )
      : undefined,
    redacted: true,
  }
}

/**
 * Convert trace spans to tree structure
 */
export function buildTraceTree(spans: TraceSpan[]): TraceNode[] {
  const spanMap = new Map<string, TraceSpan>()
  const roots: TraceNode[] = []

  // Index spans
  for (const span of spans) {
    spanMap.set(span.span_id, span)
  }

  // Build tree
  function buildNode(span: TraceSpan, depth: number): TraceNode {
    const children = spans
      .filter((s) => s.parent_span_id === span.span_id)
      .map((s) => buildNode(s, depth + 1))

    return { span, children, depth }
  }

  // Find roots (spans without parents)
  for (const span of spans) {
    if (!span.parent_span_id || !spanMap.has(span.parent_span_id)) {
      roots.push(buildNode(span, 0))
    }
  }

  return roots
}

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

/**
 * Get color for log level
 */
export function getLogLevelColor(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'text-text-muted'
    case LogLevel.INFO:
      return 'text-primary'
    case LogLevel.WARN:
      return 'text-warning'
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      return 'text-danger'
  }
}

/**
 * Get color for health status
 */
export function getHealthColor(status: HealthStatus): string {
  switch (status) {
    case HealthStatus.HEALTHY:
      return 'text-success'
    case HealthStatus.DEGRADED:
      return 'text-warning'
    case HealthStatus.UNHEALTHY:
      return 'text-danger'
    case HealthStatus.UNKNOWN:
      return 'text-text-muted'
  }
}
