import { useEffect, useState } from 'react'
import { Activity, DollarSign, Zap, TrendingUp, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AggregatedUsage, Provider } from '@/types/tokens'
import { formatCost, formatTokenCount } from '@/types/tokens'
import { getTokenService } from '@/services/TokenService'

interface TokenHUDProps {
  refreshInterval?: number // ms
  compact?: boolean
  position?: 'top' | 'bottom'
}

export function TokenHUD({ refreshInterval = 1000, compact = false, position = 'bottom' }: TokenHUDProps) {
  const [usage, setUsage] = useState<AggregatedUsage | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const updateUsage = () => {
      const tokenService = getTokenService()
      const aggregated = tokenService.getAggregatedUsage()
      setUsage(aggregated)
    }

    // Initial update
    updateUsage()

    // Set up interval
    const interval = setInterval(updateUsage, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval])

  if (!usage) return null

  const hasUsage = usage.total_tokens > 0

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40 bg-surface border-border shadow-lg transition-all',
        position === 'top' ? 'top-0 border-b' : 'bottom-0 border-t',
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-4">
          {/* Compact View */}
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Activity className="w-4 h-4" />
              <span className="font-semibold text-sm">Token Usage</span>
            </button>

            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-primary" />
                <span className="font-mono">{formatTokenCount(usage.total_tokens)}</span>
                <span className="text-text-muted">tokens</span>
              </div>

              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-success" />
                <span className="font-mono">{formatCost(usage.total_cost_usd)}</span>
              </div>

              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-accent" />
                <span className="text-text-muted text-xs">
                  {usage.sample_count} requests
                </span>
              </div>

              {usage.estimated_count > 0 && (
                <div className="flex items-center gap-1 text-warning">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-xs">
                    {usage.estimated_count} estimated
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Provider Pills */}
          <div className="flex items-center gap-2">
            {Object.entries(usage.by_provider).map(([provider, providerUsage]) => {
              if (providerUsage.request_count === 0) return null

              return (
                <ProviderPill
                  key={provider}
                  provider={provider as Provider}
                  usage={providerUsage}
                />
              )
            })}
          </div>
        </div>

        {/* Expanded View */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* By Provider */}
              <div>
                <h4 className="text-xs font-semibold text-text-muted mb-2">By Provider</h4>
                <div className="space-y-1">
                  {Object.entries(usage.by_provider).map(([provider, pu]) => {
                    if (pu.request_count === 0) return null

                    return (
                      <div key={provider} className="flex justify-between text-sm">
                        <span className="capitalize">{provider}</span>
                        <span className="font-mono">{formatTokenCount(pu.total_tokens)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By Level */}
              <div>
                <h4 className="text-xs font-semibold text-text-muted mb-2">By Level</h4>
                <div className="space-y-1">
                  {Object.entries(usage.by_level).map(([level, lu]) => {
                    if (lu.entity_count === 0) return null

                    return (
                      <div key={level} className="flex justify-between text-sm">
                        <span className="capitalize">{level}</span>
                        <span className="font-mono">{formatTokenCount(lu.total_tokens)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-text-muted mb-2">Cost Breakdown</h4>
                <div className="space-y-1">
                  {Object.entries(usage.by_provider).map(([provider, pu]) => {
                    if (pu.cost_usd === 0) return null

                    return (
                      <div key={provider} className="flex justify-between text-sm">
                        <span className="capitalize">{provider}</span>
                        <span className="font-mono">{formatCost(pu.cost_usd)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Statistics */}
              <div>
                <h4 className="text-xs font-semibold text-text-muted mb-2">Statistics</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Input</span>
                    <span className="font-mono">{formatTokenCount(usage.total_input_tokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output</span>
                    <span className="font-mono">{formatTokenCount(usage.total_output_tokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reconciled</span>
                    <span className="font-mono">{usage.reconciled_count}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ProviderPillProps {
  provider: Provider
  usage: {
    total_tokens: number
    cost_usd: number
    request_count: number
  }
}

function ProviderPill({ provider, usage }: ProviderPillProps) {
  const providerColors = {
    'claude-code': 'bg-primary/20 text-primary',
    'codex': 'bg-accent/20 text-accent',
    'ollama': 'bg-success/20 text-success',
    'unknown': 'bg-text-muted/20 text-text-muted',
  }

  const color = providerColors[provider] || providerColors.unknown

  return (
    <div className={cn('px-2 py-1 rounded text-xs font-medium', color)}>
      <div className="flex items-center gap-1">
        <span className="capitalize">{provider}</span>
        <span className="opacity-70">·</span>
        <span className="font-mono">{formatTokenCount(usage.total_tokens)}</span>
        {usage.cost_usd > 0 && (
          <>
            <span className="opacity-70">·</span>
            <span className="font-mono">{formatCost(usage.cost_usd)}</span>
          </>
        )}
      </div>
    </div>
  )
}
