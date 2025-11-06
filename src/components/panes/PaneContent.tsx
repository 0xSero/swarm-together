import { useEffect, useRef } from 'react'
import { usePaneStore, type Tab, type PanePosition, type PaneHistory } from '@/stores/paneStore'
import { BlockRenderer } from '@/components/blocks/BlockRenderer'
import { useBlockOperations } from '@/hooks/useBlockOperations'
import type { Block } from '@/types/blocks'

interface PaneContentProps {
  tab: Tab
  position: PanePosition
  history: PaneHistory | undefined
}

export function PaneContent({ tab, position, history }: PaneContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const { updateScrollPosition, recordRenderTime } = usePaneStore()
  const { handleCopy, handleReRun, handleToggleBookmark, recordMetrics } = useBlockOperations(tab.sessionId)

  // Restore scroll position when tab becomes active
  useEffect(() => {
    if (contentRef.current && history) {
      contentRef.current.scrollTop = history.scrollPosition
    }
  }, [tab.id, history])

  // Track render performance
  useEffect(() => {
    const renderStart = performance.now()
    return () => {
      const renderEnd = performance.now()
      const renderTime = renderEnd - renderStart
      recordRenderTime(renderTime)
    }
  })

  const handleScroll = () => {
    if (contentRef.current) {
      updateScrollPosition(position, tab.id, contentRef.current.scrollTop)
    }
  }

  const blocks = history?.blocks || []

  return (
    <div
      ref={contentRef}
      className="h-full overflow-y-auto p-4 space-y-3"
      onScroll={handleScroll}
    >
      {blocks.length === 0 ? (
        <div className="flex items-center justify-center h-full text-text-muted">
          <div className="text-center space-y-2">
            <p className="text-lg">No history yet</p>
            <p className="text-sm">
              Blocks will appear here as you interact with the session
            </p>
          </div>
        </div>
      ) : (
        blocks.map((block: Block, index: number) => (
          <BlockRenderer
            key={block.id || index}
            block={block}
            onCopy={handleCopy}
            onReRun={handleReRun}
            onToggleBookmark={handleToggleBookmark}
            onMetrics={recordMetrics}
            showActions={true}
          />
        ))
      )}
    </div>
  )
}
