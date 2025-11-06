import { useEffect, useState } from 'react'
import { usePaneStore, type PanePosition } from '@/stores/paneStore'
import { Pane } from './Pane'
import { cn } from '@/lib/utils'

const PANE_POSITIONS: PanePosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export function PaneManager() {
  const { panes, focusedPane, swapPanes, focusNextPane, focusPreviousPane, renderMetrics } =
    usePaneStore()

  const [draggedPane, setDraggedPane] = useState<PanePosition | null>(null)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + [ or ] for pane navigation
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault()
        focusPreviousPane()
      } else if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault()
        focusNextPane()
      }

      // Cmd/Ctrl + 1-4 for direct pane selection
      if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        const position = PANE_POSITIONS[index]
        usePaneStore.getState().focusPane(position)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusNextPane, focusPreviousPane])

  const handleDragStart = (position: PanePosition) => {
    setDraggedPane(position)
  }

  const handleDrop = (targetPosition: PanePosition) => {
    if (draggedPane && draggedPane !== targetPosition) {
      swapPanes(draggedPane, targetPosition)
    }
    setDraggedPane(null)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Grid Container */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 p-4">
        {PANE_POSITIONS.map((position) => (
          <div
            key={position}
            className={cn(
              'min-h-0', // Critical for proper overflow handling
              position === 'top-left' && 'col-start-1 row-start-1',
              position === 'top-right' && 'col-start-2 row-start-1',
              position === 'bottom-left' && 'col-start-1 row-start-2',
              position === 'bottom-right' && 'col-start-2 row-start-2'
            )}
          >
            <Pane
              pane={panes[position]}
              position={position}
              isFocused={focusedPane === position}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          </div>
        ))}
      </div>

      {/* Performance Metrics Bar */}
      {renderMetrics.frameCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-muted border-t border-border bg-elevated/30">
          <span>
            Avg Render: {renderMetrics.averageRenderTime.toFixed(2)}ms
          </span>
          <span>
            Last Render: {renderMetrics.lastRenderTime.toFixed(2)}ms
          </span>
          <span>Frames: {renderMetrics.frameCount}</span>
        </div>
      )}
    </div>
  )
}
