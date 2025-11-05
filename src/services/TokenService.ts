import type {
  TokenMeter,
  TokenUsage,
  AggregatedUsage,
  Provider,
  MeterLevel,
  ReconciliationResult,
} from '@/types/tokens'
import { createTokenMeter, aggregateMeters } from '@/types/tokens'
import { estimateTokens } from '@/utils/tokenEstimator'

export class TokenService {
  private meters: TokenMeter[] = []
  private aggregatedCache: AggregatedUsage | null = null
  private cacheInvalidated: boolean = true

  /**
   * Record token usage for a specific entity
   */
  recordUsage(
    level: MeterLevel,
    entity_id: string,
    input_tokens: number,
    output_tokens: number,
    provider: Provider,
    model?: string,
    estimated: boolean = false
  ): TokenMeter {
    const usage: TokenUsage = {
      input_tokens,
      output_tokens,
      total_tokens: input_tokens + output_tokens,
      estimated,
      timestamp: new Date().toISOString(),
    }

    const meter = createTokenMeter(level, entity_id, usage, provider, model)
    this.meters.push(meter)
    this.cacheInvalidated = true

    return meter
  }

  /**
   * Record estimated usage based on text content
   */
  recordEstimatedUsage(
    level: MeterLevel,
    entity_id: string,
    input_text: string,
    output_text: string,
    provider: Provider,
    model?: string
  ): TokenMeter {
    const inputEstimate = estimateTokens(input_text, model)
    const outputEstimate = estimateTokens(output_text, model)

    return this.recordUsage(
      level,
      entity_id,
      inputEstimate.tokens,
      outputEstimate.tokens,
      provider,
      model,
      true
    )
  }

  /**
   * Get aggregated usage across all levels
   */
  getAggregatedUsage(): AggregatedUsage {
    if (!this.cacheInvalidated && this.aggregatedCache) {
      return this.aggregatedCache
    }

    this.aggregatedCache = aggregateMeters(this.meters)
    this.cacheInvalidated = false

    return this.aggregatedCache
  }

  /**
   * Get usage for a specific level
   */
  getUsageByLevel(level: MeterLevel): TokenMeter[] {
    return this.meters.filter((m) => m.level === level)
  }

  /**
   * Get usage for a specific entity
   */
  getUsageByEntity(entity_id: string): TokenMeter[] {
    return this.meters.filter((m) => m.entity_id === entity_id)
  }

  /**
   * Get usage for a specific provider
   */
  getUsageByProvider(provider: Provider): TokenMeter[] {
    return this.meters.filter((m) => m.metadata?.provider === provider)
  }

  /**
   * Get recent meters (last N)
   */
  getRecentMeters(limit: number = 100): TokenMeter[] {
    return this.meters.slice(-limit)
  }

  /**
   * Reconcile estimated usage with actual usage from provider
   */
  async reconcileUsage(
    meter_id: string,
    actual_input: number,
    actual_output: number
  ): Promise<ReconciliationResult> {
    const meterIndex = this.meters.findIndex((m) => m.id === meter_id)

    if (meterIndex === -1) {
      throw new Error(`Meter ${meter_id} not found`)
    }

    const meter = this.meters[meterIndex]
    const before_tokens = meter.usage.total_tokens

    // Update with actual usage
    meter.usage.input_tokens = actual_input
    meter.usage.output_tokens = actual_output
    meter.usage.total_tokens = actual_input + actual_output
    meter.usage.estimated = false

    const after_tokens = meter.usage.total_tokens
    const delta = after_tokens - before_tokens

    this.cacheInvalidated = true

    return {
      before_tokens,
      after_tokens,
      delta,
      deltas_by_provider: {
        [meter.metadata?.provider || 'unknown']: delta,
      } as Record<Provider, number>,
      reconciled_count: 1,
      failed_count: 0,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Batch reconcile multiple meters (stubbed)
   */
  async reconcileAll(): Promise<ReconciliationResult> {
    const estimatedMeters = this.meters.filter((m) => m.usage.estimated)

    let total_before = 0
    let total_after = 0
    let reconciled_count = 0
    let failed_count = 0
    const deltas_by_provider: Record<Provider, number> = {
      'claude-code': 0,
      'codex': 0,
      'ollama': 0,
      'unknown': 0,
    }

    for (const meter of estimatedMeters) {
      try {
        // In a real implementation, this would call the provider API
        // For now, we just simulate by keeping the estimated values
        const before = meter.usage.total_tokens
        total_before += before

        // Simulate reconciliation (in reality, fetch from provider)
        meter.usage.estimated = false
        const after = meter.usage.total_tokens
        total_after += after

        const delta = after - before
        const provider = meter.metadata?.provider as Provider || 'unknown'
        deltas_by_provider[provider] = (deltas_by_provider[provider] || 0) + delta

        reconciled_count++
      } catch (error) {
        console.error('Reconciliation failed for meter:', meter.id, error)
        failed_count++
      }
    }

    this.cacheInvalidated = true

    return {
      before_tokens: total_before,
      after_tokens: total_after,
      delta: total_after - total_before,
      deltas_by_provider,
      reconciled_count,
      failed_count,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Reset all counters
   */
  reset(): void {
    this.meters = []
    this.aggregatedCache = null
    this.cacheInvalidated = true
  }

  /**
   * Reset counters for a specific entity
   */
  resetEntity(entity_id: string): void {
    this.meters = this.meters.filter((m) => m.entity_id !== entity_id)
    this.cacheInvalidated = true
  }

  /**
   * Get all meters (for export/debugging)
   */
  getAllMeters(): TokenMeter[] {
    return [...this.meters]
  }

  /**
   * Import meters (for restore/testing)
   */
  importMeters(meters: TokenMeter[]): void {
    this.meters = [...meters]
    this.cacheInvalidated = true
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total_meters: number
    estimated_meters: number
    reconciled_meters: number
    providers: string[]
    levels: string[]
  } {
    const providers = new Set<string>()
    const levels = new Set<string>()
    let estimated_meters = 0
    let reconciled_meters = 0

    for (const meter of this.meters) {
      if (meter.usage.estimated) {
        estimated_meters++
      } else {
        reconciled_meters++
      }

      if (meter.metadata?.provider) {
        providers.add(meter.metadata.provider)
      }

      levels.add(meter.level)
    }

    return {
      total_meters: this.meters.length,
      estimated_meters,
      reconciled_meters,
      providers: Array.from(providers),
      levels: Array.from(levels),
    }
  }
}

// Global singleton instance
let globalTokenService: TokenService | null = null

export function getTokenService(): TokenService {
  if (!globalTokenService) {
    globalTokenService = new TokenService()
  }
  return globalTokenService
}
