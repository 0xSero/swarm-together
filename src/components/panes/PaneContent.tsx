import { useEffect, useRef } from 'react'
import { usePaneStore, type Tab, type PanePosition, type PaneHistory } from '@/stores/paneStore'
import { cn } from '@/lib/utils'

interface PaneContentProps {
  tab: Tab
  position: PanePosition
  history: PaneHistory | undefined
}

export function PaneContent({ tab, position, history }: PaneContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const { updateScrollPosition, recordRenderTime } = usePaneStore()

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
      className="h-full overflow-y-auto p-4 space-y-2"
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
        blocks.map((block, index) => (
          <HistoryBlock key={block.id || index} block={block} />
        ))
      )}
    </div>
  )
}

interface HistoryBlockProps {
  block: any // TODO: Type this properly with Block from session types
}

function HistoryBlock({ block }: HistoryBlockProps) {
  const blockType = block.block_type || block.type || 'output'

  const typeStyles = {
    command: 'bg-primary/10 border-primary/30 text-primary',
    output: 'bg-surface border-border text-text-high',
    error: 'bg-danger/10 border-danger/30 text-danger',
    conversation: 'bg-accent/10 border-accent/30 text-text-high',
    artifact: 'bg-warning/10 border-warning/30 text-text-high',
  }

  const style = typeStyles[blockType as keyof typeof typeStyles] || typeStyles.output

  return (
    <div className={cn('rounded-md border p-3 font-mono text-sm', style)}>
      {block.title && (
        <div className="font-semibold mb-2 flex items-center justify-between">
          <span>{block.title}</span>
          <span className="text-xs opacity-70 capitalize">{blockType}</span>
        </div>
      )}
      <pre className="whitespace-pre-wrap break-words">{block.content}</pre>
      {block.bookmarked && (
        <div className="mt-2 text-xs opacity-70">📌 Bookmarked</div>
      )}
    </div>
  )
}
