import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TelemetryService } from './TelemetryService'
import {
  LogLevel,
  SpanStatus,
  MetricType,
  HealthStatus,
  type ConnectorHealth,
} from '@/types/telemetry'

describe('TelemetryService', () => {
  let service: TelemetryService

  beforeEach(() => {
    service = new TelemetryService({ enable_redaction: false })
  })

  describe('Logging', () => {
    it('should log messages', () => {
      service.info('test', 'Test message')

      const logs = service.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.INFO)
      expect(logs[0].component).toBe('test')
      expect(logs[0].message).toBe('Test message')
    })

    it('should log with context', () => {
      service.info('test', 'Test message', { userId: '123' })

      const logs = service.getLogs()
      expect(logs[0].context).toEqual({ userId: '123' })
    })

    it('should log errors with stack trace', () => {
      const error = new Error('Test error')
      service.error('test', 'An error occurred', error)

      const logs = service.getLogs()
      expect(logs[0].level).toBe(LogLevel.ERROR)
      expect(logs[0].error).toBeDefined()
      expect(logs[0].error?.name).toBe('Error')
      expect(logs[0].error?.message).toBe('Test error')
      expect(logs[0].error?.stack).toBeDefined()
    })

    it('should filter logs by level', () => {
      service.debug('test', 'Debug message')
      service.info('test', 'Info message')
      service.warn('test', 'Warn message')
      service.error('test', 'Error message')

      const errorLogs = service.getLogs({ level: LogLevel.ERROR })
      expect(errorLogs).toHaveLength(1)
      expect(errorLogs[0].level).toBe(LogLevel.ERROR)
    })

    it('should filter logs by component', () => {
      service.info('component-a', 'Message A')
      service.info('component-b', 'Message B')

      const filtered = service.getLogs({ component: 'component-a' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].component).toBe('component-a')
    })

    it('should filter logs by search', () => {
      service.info('test', 'Looking for needle in haystack')
      service.info('test', 'Other message')

      const filtered = service.getLogs({ search: 'needle' })
      expect(filtered).toHaveLength(1)
      expect(filtered[0].message).toContain('needle')
    })

    it('should enforce max events limit', () => {
      const smallService = new TelemetryService({ max_events: 10 })

      for (let i = 0; i < 20; i++) {
        smallService.info('test', `Message ${i}`)
      }

      const logs = smallService.getLogs()
      expect(logs.length).toBeLessThanOrEqual(10)
      expect(smallService.getDroppedEvents()).toBeGreaterThan(0)
    })

    it('should clear logs', () => {
      service.info('test', 'Message 1')
      service.info('test', 'Message 2')

      service.clearLogs()
      expect(service.getLogs()).toHaveLength(0)
    })

    it('should redact sensitive data when enabled', () => {
      const redactService = new TelemetryService({ enable_redaction: true })
      redactService.info('test', 'User logged in with api_key: sk-secret123')

      const logs = redactService.getLogs()
      expect(logs[0].message).toContain('[REDACTED]')
      expect(logs[0].message).not.toContain('sk-secret123')
      expect(logs[0].redacted).toBe(true)
    })
  })

  describe('Tracing', () => {
    it('should start span', () => {
      const span = service.startSpan('test-operation')

      expect(span.span_id).toBeDefined()
      expect(span.trace_id).toBeDefined()
      expect(span.name).toBe('test-operation')
      expect(span.status).toBe(SpanStatus.OK)
    })

    it('should end span with duration', () => {
      const span = service.startSpan('test-operation')

      // Wait a bit
      setTimeout(() => {
        service.endSpan(span.span_id)
      }, 10)

      // Check after timeout
      setTimeout(() => {
        const spans = service.getSpans()
        const endedSpan = spans.find((s) => s.span_id === span.span_id)
        expect(endedSpan?.end_time).toBeDefined()
        expect(endedSpan?.duration_ms).toBeGreaterThan(0)
      }, 20)
    })

    it('should create parent-child spans', () => {
      const parent = service.startSpan('parent')
      const child = service.startSpan('child', parent.trace_id, parent.span_id)

      expect(child.trace_id).toBe(parent.trace_id)
      expect(child.parent_span_id).toBe(parent.span_id)
    })

    it('should add span events', () => {
      const span = service.startSpan('test-operation')
      service.addSpanEvent(span.span_id, 'checkpoint', { step: 1 })

      const spans = service.getSpans()
      const updatedSpan = spans.find((s) => s.span_id === span.span_id)
      expect(updatedSpan?.events).toHaveLength(1)
      expect(updatedSpan?.events[0].name).toBe('checkpoint')
    })

    it('should get spans by trace ID', () => {
      const traceId = 'test-trace'
      service.startSpan('span-1', traceId)
      service.startSpan('span-2', traceId)
      service.startSpan('span-3', 'other-trace')

      const traceSpans = service.getSpansByTrace(traceId)
      expect(traceSpans).toHaveLength(2)
    })
  })

  describe('Metrics', () => {
    it('should record counter', () => {
      service.incrementCounter('requests')

      const metrics = service.getMetrics('requests')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].type).toBe(MetricType.COUNTER)
      expect(metrics[0].value).toBe(1)
    })

    it('should record gauge', () => {
      service.setGauge('memory_usage', 1024)

      const metrics = service.getMetrics('memory_usage')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].type).toBe(MetricType.GAUGE)
      expect(metrics[0].value).toBe(1024)
    })

    it('should record histogram', () => {
      service.recordHistogram('response_time', 123.45, {}, 'ms')

      const metrics = service.getMetrics('response_time')
      expect(metrics).toHaveLength(1)
      expect(metrics[0].type).toBe(MetricType.HISTOGRAM)
      expect(metrics[0].value).toBe(123.45)
      expect(metrics[0].unit).toBe('ms')
    })

    it('should aggregate metrics', () => {
      service.recordHistogram('response_time', 100)
      service.recordHistogram('response_time', 200)
      service.recordHistogram('response_time', 300)

      const aggregate = service.aggregateMetrics('response_time', 60000)
      expect(aggregate).toBeDefined()
      expect(aggregate?.count).toBe(3)
      expect(aggregate?.min).toBe(100)
      expect(aggregate?.max).toBe(300)
      expect(aggregate?.avg).toBe(200)
    })

    it('should return null for empty aggregation', () => {
      const aggregate = service.aggregateMetrics('nonexistent', 60000)
      expect(aggregate).toBeNull()
    })
  })

  describe('Health Checks', () => {
    it('should record health check', () => {
      service.recordHealthCheck({
        component: 'database',
        status: HealthStatus.HEALTHY,
        last_check: new Date().toISOString(),
        checks: [{ name: 'connection', status: HealthStatus.HEALTHY }],
        response_time_ms: 50,
      })

      const checks = service.getHealthChecks()
      expect(checks).toHaveLength(1)
      expect(checks[0].component).toBe('database')
      expect(checks[0].status).toBe(HealthStatus.HEALTHY)
    })

    it('should record connector health', () => {
      const health: ConnectorHealth = {
        component: 'claude-code',
        connector_type: 'claude-code',
        status: HealthStatus.HEALTHY,
        connected: true,
        last_check: new Date().toISOString(),
        request_count: 100,
        error_count: 2,
        error_rate: 0.02,
        checks: [],
        response_time_ms: 150,
      }

      service.recordConnectorHealth(health)

      const connectors = service.getConnectorHealth()
      expect(connectors).toHaveLength(1)
      expect(connectors[0].connector_type).toBe('claude-code')
      expect(connectors[0].error_rate).toBe(0.02)
    })

    it('should calculate system health', () => {
      service.recordHealthCheck({
        component: 'comp-1',
        status: HealthStatus.HEALTHY,
        last_check: new Date().toISOString(),
        checks: [],
        response_time_ms: 50,
      })

      service.recordHealthCheck({
        component: 'comp-2',
        status: HealthStatus.HEALTHY,
        last_check: new Date().toISOString(),
        checks: [],
        response_time_ms: 60,
      })

      expect(service.getSystemHealth()).toBe(HealthStatus.HEALTHY)
    })

    it('should detect degraded system health', () => {
      service.recordHealthCheck({
        component: 'comp-1',
        status: HealthStatus.HEALTHY,
        last_check: new Date().toISOString(),
        checks: [],
        response_time_ms: 50,
      })

      service.recordHealthCheck({
        component: 'comp-2',
        status: HealthStatus.DEGRADED,
        last_check: new Date().toISOString(),
        checks: [],
        response_time_ms: 200,
      })

      expect(service.getSystemHealth()).toBe(HealthStatus.DEGRADED)
    })

    it('should detect unhealthy system health', () => {
      service.recordHealthCheck({
        component: 'comp-1',
        status: HealthStatus.UNHEALTHY,
        last_check: new Date().toISOString(),
        checks: [],
        response_time_ms: 5000,
      })

      expect(service.getSystemHealth()).toBe(HealthStatus.UNHEALTHY)
    })
  })

  describe('Event Streaming', () => {
    it('should subscribe to events', () => {
      const events: any[] = []
      const unsubscribe = service.subscribe((event) => {
        events.push(event)
      })

      service.info('test', 'Test message')

      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('log')
      expect(events[0].data.message).toBe('Test message')

      unsubscribe()
    })

    it('should unsubscribe from events', () => {
      const events: any[] = []
      const unsubscribe = service.subscribe((event) => {
        events.push(event)
      })

      service.info('test', 'Message 1')
      unsubscribe()
      service.info('test', 'Message 2')

      expect(events).toHaveLength(1)
    })

    it('should handle multiple subscribers', () => {
      const events1: any[] = []
      const events2: any[] = []

      service.subscribe((event) => events1.push(event))
      service.subscribe((event) => events2.push(event))

      service.info('test', 'Test message')

      expect(events1).toHaveLength(1)
      expect(events2).toHaveLength(1)
    })
  })

  describe('Crash Recovery', () => {
    it('should record crash reports', () => {
      service.recordCrash({
        id: 'crash-1',
        timestamp: new Date().toISOString(),
        error: {
          name: 'Error',
          message: 'Something went wrong',
        },
        state: {
          component: 'test',
        },
        recent_logs: [],
        active_spans: [],
      })

      const crashes = service.getCrashReports()
      expect(crashes).toHaveLength(1)
      expect(crashes[0].id).toBe('crash-1')
    })
  })

  describe('Statistics', () => {
    it('should provide statistics', () => {
      service.info('test', 'Log message')
      service.startSpan('test-span')
      service.incrementCounter('test-counter')

      const stats = service.getStats()
      expect(stats.logs).toBeGreaterThan(0)
      expect(stats.spans).toBeGreaterThan(0)
      expect(stats.metrics).toBeGreaterThan(0)
    })
  })
})
