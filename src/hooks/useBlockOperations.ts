import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import type { Block, BlockRenderMetrics } from '@/types/blocks'

export function useBlockOperations(sessionId: string) {
  const [metrics, setMetrics] = useState<BlockRenderMetrics[]>([])
  const [operationCount, setOperationCount] = useState({
    copy: 0,
    rerun: 0,
    bookmark: 0,
    failures: 0,
  })

  const handleCopy = useCallback((content: string) => {
    setOperationCount((prev) => ({ ...prev, copy: prev.copy + 1 }))
  }, [])

  const handleReRun = useCallback(async (content: string) => {
    try {
      // This would send the command to the active pane/session
      // For now, just log it
      console.log('Re-running command:', content)

      // In a real implementation, this would invoke a Tauri command
      // await invoke('execute_command', { sessionId, command: content })

      setOperationCount((prev) => ({ ...prev, rerun: prev.rerun + 1 }))
    } catch (error) {
      console.error('Failed to re-run command:', error)
      setOperationCount((prev) => ({ ...prev, failures: prev.failures + 1 }))
      throw error
    }
  }, [sessionId])

  const handleToggleBookmark = useCallback(async (blockId: string) => {
    try {
      await invoke('toggle_bookmark', { blockId })
      setOperationCount((prev) => ({ ...prev, bookmark: prev.bookmark + 1 }))
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      setOperationCount((prev) => ({ ...prev, failures: prev.failures + 1 }))
      throw error
    }
  }, [])

  const recordMetrics = useCallback((metric: BlockRenderMetrics) => {
    setMetrics((prev) => [...prev.slice(-99), metric]) // Keep last 100
  }, [])

  const getAverageRenderTime = useCallback(() => {
    if (metrics.length === 0) return 0
    const sum = metrics.reduce((acc, m) => acc + m.renderTime, 0)
    return sum / metrics.length
  }, [metrics])

  const getMetricsSummary = useCallback(() => {
    return {
      totalBlocks: metrics.length,
      averageRenderTime: getAverageRenderTime(),
      slowestBlock: metrics.reduce(
        (slowest, m) => (m.renderTime > slowest.renderTime ? m : slowest),
        metrics[0] || { blockId: '', renderTime: 0, contentSize: 0, hasAttachments: false, timestamp: 0 }
      ),
      operations: operationCount,
    }
  }, [metrics, operationCount, getAverageRenderTime])

  return {
    handleCopy,
    handleReRun,
    handleToggleBookmark,
    recordMetrics,
    getMetricsSummary,
    metrics,
    operationCount,
  }
}
