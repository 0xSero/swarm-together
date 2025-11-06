export type Provider = 'claude-code' | 'codex' | 'ollama' | 'unknown'

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated: boolean
  timestamp: string
}

export interface TokenCost {
  input_cost_usd: number
  output_cost_usd: number
  total_cost_usd: number
  provider: Provider
  model?: string
}

export interface TokenMeter {
  id: string
  level: MeterLevel
  entity_id: string // session_id, pane_id, agent_id, worktree_id, message_id
  usage: TokenUsage
  cost?: TokenCost
  metadata?: Record<string, any>
}

export type MeterLevel = 'message' | 'pane' | 'agent' | 'session' | 'worktree' | 'global'

export interface AggregatedUsage {
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost_usd: number
  by_provider: Record<Provider, ProviderUsage>
  by_level: Record<MeterLevel, LevelUsage>
  sample_count: number
  estimated_count: number
  reconciled_count: number
  last_updated: string
}

export interface ProviderUsage {
  provider: Provider
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
  request_count: number
  last_request: string
}

export interface LevelUsage {
  level: MeterLevel
  total_tokens: number
  cost_usd: number
  entity_count: number
}

export interface TokenEstimate {
  tokens: number
  method: 'exact' | 'tiktoken' | 'char-based' | 'word-based'
  confidence: number // 0-1
}

export interface ReconciliationResult {
  before_tokens: number
  after_tokens: number
  delta: number
  deltas_by_provider: Record<Provider, number>
  reconciled_count: number
  failed_count: number
  timestamp: string
}

export interface ProviderPricing {
  provider: Provider
  model: string
  input_cost_per_1m: number // Cost per 1M input tokens
  output_cost_per_1m: number // Cost per 1M output tokens
  effective_date: string
}

// Standard pricing (2024 rates - can be updated)
export const DEFAULT_PRICING: ProviderPricing[] = [
  {
    provider: 'claude-code',
    model: 'claude-sonnet-4',
    input_cost_per_1m: 3.00,
    output_cost_per_1m: 15.00,
    effective_date: '2024-01-01',
  },
  {
    provider: 'claude-code',
    model: 'claude-sonnet-3.5',
    input_cost_per_1m: 3.00,
    output_cost_per_1m: 15.00,
    effective_date: '2024-01-01',
  },
  {
    provider: 'codex',
    model: 'gpt-5',
    input_cost_per_1m: 2.50,
    output_cost_per_1m: 10.00,
    effective_date: '2024-01-01',
  },
  {
    provider: 'codex',
    model: 'gpt-4',
    input_cost_per_1m: 30.00,
    output_cost_per_1m: 60.00,
    effective_date: '2024-01-01',
  },
  {
    provider: 'ollama',
    model: 'local',
    input_cost_per_1m: 0,
    output_cost_per_1m: 0,
    effective_date: '2024-01-01',
  },
]

export function calculateCost(
  usage: TokenUsage,
  provider: Provider,
  model?: string
): TokenCost {
  const pricing = DEFAULT_PRICING.find(
    (p) => p.provider === provider && (!model || p.model === model)
  ) || DEFAULT_PRICING.find((p) => p.provider === provider)

  if (!pricing) {
    return {
      input_cost_usd: 0,
      output_cost_usd: 0,
      total_cost_usd: 0,
      provider,
      model,
    }
  }

  const input_cost_usd = (usage.input_tokens / 1_000_000) * pricing.input_cost_per_1m
  const output_cost_usd = (usage.output_tokens / 1_000_000) * pricing.output_cost_per_1m

  return {
    input_cost_usd,
    output_cost_usd,
    total_cost_usd: input_cost_usd + output_cost_usd,
    provider,
    model,
  }
}

export function createTokenMeter(
  level: MeterLevel,
  entity_id: string,
  usage: TokenUsage,
  provider: Provider,
  model?: string
): TokenMeter {
  return {
    id: `meter-${level}-${entity_id}-${Date.now()}`,
    level,
    entity_id,
    usage,
    cost: calculateCost(usage, provider, model),
    metadata: {
      provider,
      model,
    },
  }
}

export function aggregateMeters(meters: TokenMeter[]): AggregatedUsage {
  const byProvider: Record<Provider, ProviderUsage> = {
    'claude-code': createEmptyProviderUsage('claude-code'),
    'codex': createEmptyProviderUsage('codex'),
    'ollama': createEmptyProviderUsage('ollama'),
    'unknown': createEmptyProviderUsage('unknown'),
  }

  const byLevel: Record<MeterLevel, LevelUsage> = {
    'message': createEmptyLevelUsage('message'),
    'pane': createEmptyLevelUsage('pane'),
    'agent': createEmptyLevelUsage('agent'),
    'session': createEmptyLevelUsage('session'),
    'worktree': createEmptyLevelUsage('worktree'),
    'global': createEmptyLevelUsage('global'),
  }

  let total_input_tokens = 0
  let total_output_tokens = 0
  let total_cost_usd = 0
  let estimated_count = 0
  let reconciled_count = 0

  for (const meter of meters) {
    const provider = meter.metadata?.provider || 'unknown'

    // Aggregate totals
    total_input_tokens += meter.usage.input_tokens
    total_output_tokens += meter.usage.output_tokens
    total_cost_usd += meter.cost?.total_cost_usd || 0

    if (meter.usage.estimated) {
      estimated_count++
    } else {
      reconciled_count++
    }

    // Aggregate by provider
    const providerUsage = byProvider[provider as Provider]
    if (providerUsage) {
      providerUsage.input_tokens += meter.usage.input_tokens
      providerUsage.output_tokens += meter.usage.output_tokens
      providerUsage.total_tokens += meter.usage.total_tokens
      providerUsage.cost_usd += meter.cost?.total_cost_usd || 0
      providerUsage.request_count++
      providerUsage.last_request = meter.usage.timestamp
    }

    // Aggregate by level
    const levelUsage = byLevel[meter.level]
    if (levelUsage) {
      levelUsage.total_tokens += meter.usage.total_tokens
      levelUsage.cost_usd += meter.cost?.total_cost_usd || 0
      levelUsage.entity_count++
    }
  }

  return {
    total_input_tokens,
    total_output_tokens,
    total_tokens: total_input_tokens + total_output_tokens,
    total_cost_usd,
    by_provider: byProvider,
    by_level: byLevel,
    sample_count: meters.length,
    estimated_count,
    reconciled_count,
    last_updated: new Date().toISOString(),
  }
}

function createEmptyProviderUsage(provider: Provider): ProviderUsage {
  return {
    provider,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    request_count: 0,
    last_request: '',
  }
}

function createEmptyLevelUsage(level: MeterLevel): LevelUsage {
  return {
    level,
    total_tokens: 0,
    cost_usd: 0,
    entity_count: 0,
  }
}

export function formatCost(cost_usd: number): string {
  if (cost_usd === 0) return '$0.00'
  if (cost_usd < 0.01) return `$${cost_usd.toFixed(4)}`
  return `$${cost_usd.toFixed(2)}`
}

export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1_000_000).toFixed(2)}M`
}
