import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { TokenMeter, Provider } from '@/types/tokens'
import { formatTokenCount, formatCost } from '@/types/tokens'
import { getTokenService } from '@/services/TokenService'

interface DataPoint {
  timestamp: number
  tokens: number
  cost: number
  provider?: Provider
}

interface TokenGraphProps {
  maxDataPoints?: number
  refreshInterval?: number
  height?: number
  showCost?: boolean
  provider?: Provider
}

export function TokenGraph({
  maxDataPoints = 50,
  refreshInterval = 2000,
  height = 100,
  showCost = false,
  provider,
}: TokenGraphProps) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const updateData = () => {
      const tokenService = getTokenService()
      const recentMeters = tokenService.getRecentMeters(maxDataPoints)

      // Filter by provider if specified
      const filteredMeters = provider
        ? recentMeters.filter((m) => m.metadata?.provider === provider)
        : recentMeters

      // Convert to data points
      const points: DataPoint[] = filteredMeters.map((meter) => ({
        timestamp: new Date(meter.usage.timestamp).getTime(),
        tokens: meter.usage.total_tokens,
        cost: meter.cost?.total_cost_usd || 0,
        provider: meter.metadata?.provider as Provider,
      }))

      setDataPoints(points)
    }

    updateData()
    const interval = setInterval(updateData, refreshInterval)

    return () => clearInterval(interval)
  }, [maxDataPoints, refreshInterval, provider])

  // Draw graph on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dataPoints.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height: canvasHeight } = canvas

    // Clear canvas
    ctx.clearRect(0, 0, width, canvasHeight)

    // Find max value for scaling
    const values = dataPoints.map((d) => (showCost ? d.cost : d.tokens))
    const maxValue = Math.max(...values, 1)

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1

    for (let i = 0; i <= 4; i++) {
      const y = (canvasHeight / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw line graph
    if (dataPoints.length > 1) {
      ctx.strokeStyle = showCost ? '#10b981' : '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()

      dataPoints.forEach((point, index) => {
        const x = (width / (dataPoints.length - 1)) * index
        const value = showCost ? point.cost : point.tokens
        const y = canvasHeight - (value / maxValue) * canvasHeight

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Fill area under line
      ctx.lineTo(width, canvasHeight)
      ctx.lineTo(0, canvasHeight)
      ctx.closePath()
      ctx.fillStyle = showCost ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'
      ctx.fill()
    }

    // Draw points
    dataPoints.forEach((point, index) => {
      const x = (width / (dataPoints.length - 1)) * index
      const value = showCost ? point.cost : point.tokens
      const y = canvasHeight - (value / maxValue) * canvasHeight

      ctx.fillStyle = showCost ? '#10b981' : '#3b82f6'
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.fill()
    })
  }, [dataPoints, showCost])

  const latestPoint = dataPoints[dataPoints.length - 1]
  const totalTokens = dataPoints.reduce((sum, d) => sum + d.tokens, 0)
  const totalCost = dataPoints.reduce((sum, d) => sum + d.cost, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {provider ? `${provider} Usage` : 'Token Usage Over Time'}
        </div>
        {latestPoint && (
          <div className="text-xs text-text-muted">
            Latest: {showCost ? formatCost(latestPoint.cost) : formatTokenCount(latestPoint.tokens)}
          </div>
        )}
      </div>

      <div className="relative bg-elevated/50 rounded-lg p-2">
        <canvas
          ref={canvasRef}
          width={600}
          height={height}
          className="w-full"
          style={{ height: `${height}px` }}
        />

        {dataPoints.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
            No data yet
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-text-muted">
        <div>
          Total: {formatTokenCount(totalTokens)} tokens
        </div>
        {totalCost > 0 && (
          <div>
            Cost: {formatCost(totalCost)}
          </div>
        )}
        <div>
          {dataPoints.length} samples
        </div>
      </div>
    </div>
  )
}
