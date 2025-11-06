import { describe, it, expect, beforeEach } from 'vitest'
import { TokenService } from './TokenService'

describe('TokenService', () => {
  let service: TokenService

  beforeEach(() => {
    service = new TokenService()
  })

  describe('recordUsage', () => {
    it('should record token usage', () => {
      const meter = service.recordUsage(
        'message',
        'msg-1',
        100,
        50,
        'claude-code',
        'claude-sonnet-4'
      )

      expect(meter.id).toBeTruthy()
      expect(meter.level).toBe('message')
      expect(meter.entity_id).toBe('msg-1')
      expect(meter.usage.input_tokens).toBe(100)
      expect(meter.usage.output_tokens).toBe(50)
      expect(meter.usage.total_tokens).toBe(150)
      expect(meter.cost).toBeDefined()
    })

    it('should mark as estimated when specified', () => {
      const meter = service.recordUsage(
        'session',
        'session-1',
        200,
        100,
        'codex',
        'gpt-5',
        true
      )

      expect(meter.usage.estimated).toBe(true)
    })

    it('should calculate cost correctly', () => {
      const meter = service.recordUsage(
        'message',
        'msg-1',
        1_000_000, // 1M input tokens
        1_000_000, // 1M output tokens
        'claude-code',
        'claude-sonnet-4'
      )

      // Claude Sonnet 4: $3/1M input, $15/1M output
      expect(meter.cost?.input_cost_usd).toBe(3.00)
      expect(meter.cost?.output_cost_usd).toBe(15.00)
      expect(meter.cost?.total_cost_usd).toBe(18.00)
    })
  })

  describe('recordEstimatedUsage', () => {
    it('should estimate and record usage', () => {
      const meter = service.recordEstimatedUsage(
        'message',
        'msg-1',
        'Hello, how are you?',
        'I am doing well, thank you!',
        'claude-code'
      )

      expect(meter.usage.estimated).toBe(true)
      expect(meter.usage.input_tokens).toBeGreaterThan(0)
      expect(meter.usage.output_tokens).toBeGreaterThan(0)
    })
  })

  describe('getAggregatedUsage', () => {
    it('should aggregate multiple meters', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')
      service.recordUsage('session', 'session-1', 150, 75, 'ollama')

      const aggregated = service.getAggregatedUsage()

      expect(aggregated.total_input_tokens).toBe(450)
      expect(aggregated.total_output_tokens).toBe(225)
      expect(aggregated.total_tokens).toBe(675)
      expect(aggregated.sample_count).toBe(3)
    })

    it('should aggregate by provider', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'claude-code')
      service.recordUsage('message', 'msg-3', 150, 75, 'codex')

      const aggregated = service.getAggregatedUsage()

      expect(aggregated.by_provider['claude-code'].total_tokens).toBe(450)
      expect(aggregated.by_provider['claude-code'].request_count).toBe(2)
      expect(aggregated.by_provider['codex'].total_tokens).toBe(225)
      expect(aggregated.by_provider['codex'].request_count).toBe(1)
    })

    it('should aggregate by level', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 100, 50, 'claude-code')
      service.recordUsage('session', 'session-1', 200, 100, 'codex')

      const aggregated = service.getAggregatedUsage()

      expect(aggregated.by_level['message'].total_tokens).toBe(300)
      expect(aggregated.by_level['message'].entity_count).toBe(2)
      expect(aggregated.by_level['session'].total_tokens).toBe(300)
      expect(aggregated.by_level['session'].entity_count).toBe(1)
    })

    it('should cache aggregation results', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')

      const first = service.getAggregatedUsage()
      const second = service.getAggregatedUsage()

      expect(first).toBe(second) // Same object reference (cached)
    })

    it('should invalidate cache on new usage', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      const first = service.getAggregatedUsage()

      service.recordUsage('message', 'msg-2', 100, 50, 'claude-code')
      const second = service.getAggregatedUsage()

      expect(first).not.toBe(second) // Different object (cache invalidated)
      expect(second.total_tokens).toBeGreaterThan(first.total_tokens)
    })
  })

  describe('getUsageByLevel', () => {
    it('should filter meters by level', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('session', 'session-1', 200, 100, 'codex')
      service.recordUsage('message', 'msg-2', 150, 75, 'ollama')

      const messageMeters = service.getUsageByLevel('message')
      const sessionMeters = service.getUsageByLevel('session')

      expect(messageMeters).toHaveLength(2)
      expect(sessionMeters).toHaveLength(1)
    })
  })

  describe('getUsageByEntity', () => {
    it('should filter meters by entity ID', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-1', 200, 100, 'claude-code')
      service.recordUsage('message', 'msg-2', 150, 75, 'codex')

      const msg1Meters = service.getUsageByEntity('msg-1')
      const msg2Meters = service.getUsageByEntity('msg-2')

      expect(msg1Meters).toHaveLength(2)
      expect(msg2Meters).toHaveLength(1)
    })
  })

  describe('getUsageByProvider', () => {
    it('should filter meters by provider', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')
      service.recordUsage('message', 'msg-3', 150, 75, 'claude-code')

      const claudeMeters = service.getUsageByProvider('claude-code')
      const codexMeters = service.getUsageByProvider('codex')

      expect(claudeMeters).toHaveLength(2)
      expect(codexMeters).toHaveLength(1)
    })
  })

  describe('reconcileUsage', () => {
    it('should reconcile estimated usage with actual', async () => {
      const meter = service.recordUsage(
        'message',
        'msg-1',
        100,
        50,
        'claude-code',
        'claude-sonnet-4',
        true // estimated
      )

      const result = await service.reconcileUsage(meter.id, 110, 55)

      expect(result.before_tokens).toBe(150)
      expect(result.after_tokens).toBe(165)
      expect(result.delta).toBe(15)
      expect(result.reconciled_count).toBe(1)
      expect(result.failed_count).toBe(0)
    })

    it('should mark meter as no longer estimated', async () => {
      const meter = service.recordUsage(
        'message',
        'msg-1',
        100,
        50,
        'claude-code',
        'claude-sonnet-4',
        true
      )

      await service.reconcileUsage(meter.id, 110, 55)

      const meters = service.getAllMeters()
      const reconciledMeter = meters.find((m) => m.id === meter.id)

      expect(reconciledMeter?.usage.estimated).toBe(false)
    })

    it('should throw error for non-existent meter', async () => {
      await expect(
        service.reconcileUsage('non-existent', 100, 50)
      ).rejects.toThrow('Meter non-existent not found')
    })
  })

  describe('reconcileAll', () => {
    it('should reconcile all estimated meters', async () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code', 'claude-sonnet-4', true)
      service.recordUsage('message', 'msg-2', 200, 100, 'codex', 'gpt-5', true)
      service.recordUsage('message', 'msg-3', 150, 75, 'ollama', 'local', false) // not estimated

      const result = await service.reconcileAll()

      expect(result.reconciled_count).toBe(2)
      expect(result.failed_count).toBe(0)
    })

    it('should update aggregation after reconciliation', async () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code', 'claude-sonnet-4', true)

      const beforeAgg = service.getAggregatedUsage()
      expect(beforeAgg.estimated_count).toBe(1)
      expect(beforeAgg.reconciled_count).toBe(0)

      await service.reconcileAll()

      const afterAgg = service.getAggregatedUsage()
      expect(afterAgg.estimated_count).toBe(0)
      expect(afterAgg.reconciled_count).toBe(1)
    })
  })

  describe('reset', () => {
    it('should reset all meters', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')

      service.reset()

      const aggregated = service.getAggregatedUsage()
      expect(aggregated.total_tokens).toBe(0)
      expect(aggregated.sample_count).toBe(0)
    })
  })

  describe('resetEntity', () => {
    it('should reset meters for specific entity', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')

      service.resetEntity('msg-1')

      const meters = service.getAllMeters()
      expect(meters).toHaveLength(1)
      expect(meters[0].entity_id).toBe('msg-2')
    })
  })

  describe('getStatistics', () => {
    it('should return service statistics', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code', 'claude-sonnet-4', true)
      service.recordUsage('session', 'session-1', 200, 100, 'codex', 'gpt-5', false)

      const stats = service.getStatistics()

      expect(stats.total_meters).toBe(2)
      expect(stats.estimated_meters).toBe(1)
      expect(stats.reconciled_meters).toBe(1)
      expect(stats.providers).toContain('claude-code')
      expect(stats.providers).toContain('codex')
      expect(stats.levels).toContain('message')
      expect(stats.levels).toContain('session')
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero token usage', () => {
      const meter = service.recordUsage('message', 'msg-1', 0, 0, 'ollama')

      expect(meter.usage.total_tokens).toBe(0)
      expect(meter.cost?.total_cost_usd).toBe(0)
    })

    it('should handle very large token counts', () => {
      const meter = service.recordUsage(
        'session',
        'session-1',
        10_000_000,
        5_000_000,
        'claude-code'
      )

      expect(meter.usage.total_tokens).toBe(15_000_000)
      expect(meter.cost?.total_cost_usd).toBeGreaterThan(0)
    })

    it('should handle import and export', () => {
      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')

      const exported = service.getAllMeters()
      const newService = new TokenService()
      newService.importMeters(exported)

      const aggregated = newService.getAggregatedUsage()
      expect(aggregated.total_tokens).toBe(450)
    })
  })
})
