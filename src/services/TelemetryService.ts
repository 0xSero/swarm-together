/**
 * Task 120: Telemetry Service
 * Core telemetry collection, storage, and streaming service
 */

import {
  LogEntry,
  LogLevel,
  LogFilter,
  TraceSpan,
  SpanStatus,
  SpanEvent,
  Metric,
  MetricType,
  MetricAggregate,
  HealthCheck,
  HealthStatus,
  ConnectorHealth,
  CrashReport,
  TelemetryEvent,
  DebugPanelConfig,
  RedactionRule,
  DEFAULT_REDACTION_RULES,
  redactLogEntry,
} from '@/types/telemetry'

/**
 * Telemetry event callback
 */
type TelemetryCallback = (event: TelemetryEvent) => void

/**
 * Telemetry Service
 * Collects logs, traces, metrics, and health checks
 */
export class TelemetryService {
  private logs: LogEntry[] = []
  private spans: Map<string, TraceSpan> = new Map()
  private metrics: Metric[] = []
  private healthChecks: Map<string, HealthCheck> = new Map()
  private connectorHealth: Map<string, ConnectorHealth> = new Map()
  private crashReports: CrashReport[] = []

  private listeners: Set<TelemetryCallback> = new Set()
  private config: DebugPanelConfig
  private redactionRules: RedactionRule[]

  private droppedEvents = 0

  constructor(config?: Partial<DebugPanelConfig>) {
    this.config = {
      auto_scroll: true,
      max_events: 10000,
      refresh_interval_ms: 1000,
      enable_redaction: true,
      redaction_patterns: [],
      ...config,
    }

    this.redactionRules = DEFAULT_REDACTION_RULES

    // Setup crash recovery
    this.setupCrashRecovery()
  }

  // ==========================================================================
  // Logging
  // ==========================================================================

  /**
   * Log a message
   */
  log(level: LogLevel, component: string, message: string, context?: Record<string, any>): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      context,
      redacted: false,
    }

    this.addLog(entry)
  }

  /**
   * Log debug message
   */
  debug(component: string, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, component, message, context)
  }

  /**
   * Log info message
   */
  info(component: string, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, component, message, context)
  }

  /**
   * Log warning message
   */
  warn(component: string, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, component, message, context)
  }

  /**
   * Log error message
   */
  error(component: string, message: string, error?: Error, context?: Record<string, any>): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      component,
      message,
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
      redacted: false,
    }

    this.addLog(entry)
  }

  /**
   * Add log entry
   */
  private addLog(entry: LogEntry): void {
    // Apply redaction if enabled
    if (this.config.enable_redaction) {
      entry = redactLogEntry(entry, this.redactionRules)
    }

    // Add to buffer
    this.logs.push(entry)

    // Enforce max size
    if (this.logs.length > this.config.max_events) {
      this.logs.shift()
      this.droppedEvents++
    }

    // Notify listeners
    this.notifyListeners({ type: 'log', data: entry })
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let filtered = this.logs

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter((log) => log.level === filter.level)
      }
      if (filter.component) {
        filtered = filtered.filter((log) => log.component === filter.component)
      }
      if (filter.search) {
        const search = filter.search.toLowerCase()
        filtered = filtered.filter(
          (log) =>
            log.message.toLowerCase().includes(search) ||
            JSON.stringify(log.context).toLowerCase().includes(search)
        )
      }
      if (filter.since) {
        filtered = filtered.filter((log) => log.timestamp >= filter.since!)
      }
      if (filter.until) {
        filtered = filtered.filter((log) => log.timestamp <= filter.until!)
      }
    }

    return filtered
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = []
  }

  // ==========================================================================
  // Tracing
  // ==========================================================================

  /**
   * Start a trace span
   */
  startSpan(name: string, traceId?: string, parentSpanId?: string, attributes?: Record<string, any>): TraceSpan {
    const span: TraceSpan = {
      span_id: this.generateId(),
      parent_span_id: parentSpanId,
      trace_id: traceId || this.generateId(),
      name,
      start_time: new Date().toISOString(),
      status: SpanStatus.OK,
      attributes: attributes || {},
      events: [],
    }

    this.spans.set(span.span_id, span)
    this.notifyListeners({ type: 'span', data: span })

    return span
  }

  /**
   * End a trace span
   */
  endSpan(spanId: string, status: SpanStatus = SpanStatus.OK, attributes?: Record<string, any>): void {
    const span = this.spans.get(spanId)
    if (!span) return

    span.end_time = new Date().toISOString()
    span.status = status
    span.duration_ms = new Date(span.end_time).getTime() - new Date(span.start_time).getTime()

    if (attributes) {
      span.attributes = { ...span.attributes, ...attributes }
    }

    this.notifyListeners({ type: 'span', data: span })
  }

  /**
   * Add event to span
   */
  addSpanEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
    const span = this.spans.get(spanId)
    if (!span) return

    const event: SpanEvent = {
      timestamp: new Date().toISOString(),
      name,
      attributes,
    }

    span.events.push(event)
    this.notifyListeners({ type: 'span', data: span })
  }

  /**
   * Get all spans
   */
  getSpans(): TraceSpan[] {
    return Array.from(this.spans.values())
  }

  /**
   * Get spans by trace ID
   */
  getSpansByTrace(traceId: string): TraceSpan[] {
    return Array.from(this.spans.values()).filter((span) => span.trace_id === traceId)
  }

  /**
   * Clear completed spans (older than 1 hour)
   */
  clearOldSpans(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    for (const [spanId, span] of this.spans.entries()) {
      if (span.end_time && span.end_time < oneHourAgo) {
        this.spans.delete(spanId)
      }
    }
  }

  // ==========================================================================
  // Metrics
  // ==========================================================================

  /**
   * Record a metric
   */
  recordMetric(
    name: string,
    type: MetricType,
    value: number,
    labels: Record<string, string> = {},
    unit?: string
  ): void {
    const metric: Metric = {
      name,
      type,
      value,
      timestamp: new Date().toISOString(),
      labels,
      unit,
    }

    this.metrics.push(metric)

    // Enforce max size
    if (this.metrics.length > this.config.max_events) {
      this.metrics.shift()
      this.droppedEvents++
    }

    this.notifyListeners({ type: 'metric', data: metric })
  }

  /**
   * Increment counter
   */
  incrementCounter(name: string, labels: Record<string, string> = {}): void {
    this.recordMetric(name, MetricType.COUNTER, 1, labels)
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.recordMetric(name, MetricType.GAUGE, value, labels)
  }

  /**
   * Record histogram value
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}, unit?: string): void {
    this.recordMetric(name, MetricType.HISTOGRAM, value, labels, unit)
  }

  /**
   * Get metrics
   */
  getMetrics(name?: string, since?: string): Metric[] {
    let filtered = this.metrics

    if (name) {
      filtered = filtered.filter((m) => m.name === name)
    }

    if (since) {
      filtered = filtered.filter((m) => m.timestamp >= since)
    }

    return filtered
  }

  /**
   * Aggregate metrics over time window
   */
  aggregateMetrics(name: string, windowMs: number = 60000): MetricAggregate | null {
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowMs).toISOString()

    const metrics = this.getMetrics(name, windowStart)
    if (metrics.length === 0) return null

    const values = metrics.map((m) => m.value)
    values.sort((a, b) => a - b)

    return {
      name,
      type: metrics[0].type,
      count: metrics.length,
      sum: values.reduce((sum, v) => sum + v, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      labels: metrics[0].labels,
      window_start: windowStart,
      window_end: now.toISOString(),
    }
  }

  // ==========================================================================
  // Health Checks
  // ==========================================================================

  /**
   * Record health check
   */
  recordHealthCheck(check: HealthCheck): void {
    this.healthChecks.set(check.component, check)
    this.notifyListeners({ type: 'health', data: check })
  }

  /**
   * Record connector health
   */
  recordConnectorHealth(health: ConnectorHealth): void {
    this.connectorHealth.set(health.component, health)
    this.notifyListeners({ type: 'health', data: health })
  }

  /**
   * Get all health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values())
  }

  /**
   * Get connector health
   */
  getConnectorHealth(): ConnectorHealth[] {
    return Array.from(this.connectorHealth.values())
  }

  /**
   * Check overall system health
   */
  getSystemHealth(): HealthStatus {
    const checks = this.getHealthChecks()
    if (checks.length === 0) return HealthStatus.UNKNOWN

    const hasUnhealthy = checks.some((c) => c.status === HealthStatus.UNHEALTHY)
    if (hasUnhealthy) return HealthStatus.UNHEALTHY

    const hasDegraded = checks.some((c) => c.status === HealthStatus.DEGRADED)
    if (hasDegraded) return HealthStatus.DEGRADED

    return HealthStatus.HEALTHY
  }

  // ==========================================================================
  // Crash Recovery
  // ==========================================================================

  /**
   * Setup crash recovery
   */
  private setupCrashRecovery(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.recordCrash({
          id: this.generateId(),
          timestamp: new Date().toISOString(),
          error: {
            name: event.error?.name || 'Error',
            message: event.message,
            stack: event.error?.stack,
          },
          state: {
            component: 'window',
            context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
          },
          recent_logs: this.logs.slice(-50),
          active_spans: Array.from(this.spans.values()).filter((s) => !s.end_time),
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        this.recordCrash({
          id: this.generateId(),
          timestamp: new Date().toISOString(),
          error: {
            name: 'UnhandledRejection',
            message: String(event.reason),
          },
          state: {
            component: 'window',
          },
          recent_logs: this.logs.slice(-50),
          active_spans: Array.from(this.spans.values()).filter((s) => !s.end_time),
        })
      })
    }
  }

  /**
   * Record crash report
   */
  recordCrash(report: CrashReport): void {
    this.crashReports.push(report)
    this.error('crash-recovery', `Crash recorded: ${report.error.message}`, undefined, {
      crash_id: report.id,
    })
  }

  /**
   * Get crash reports
   */
  getCrashReports(): CrashReport[] {
    return this.crashReports
  }

  // ==========================================================================
  // Event Streaming
  // ==========================================================================

  /**
   * Subscribe to telemetry events
   */
  subscribe(callback: TelemetryCallback): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: TelemetryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('Telemetry listener error:', error)
      }
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Get dropped events count
   */
  getDroppedEvents(): number {
    return this.droppedEvents
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      logs: this.logs.length,
      spans: this.spans.size,
      metrics: this.metrics.length,
      health_checks: this.healthChecks.size,
      connectors: this.connectorHealth.size,
      dropped_events: this.droppedEvents,
      crash_reports: this.crashReports.length,
    }
  }
}

// Singleton instance
export const telemetry = new TelemetryService()
