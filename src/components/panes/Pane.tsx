import { useEffect, useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Pane as PaneType, PanePosition } from '@/stores/paneStore'
import { usePaneStore } from '@/stores/paneStore'
import { Button } from '@/components/ui/button'
import { PaneContent } from './PaneContent'

interface PaneProps {
  pane: PaneType
  position: PanePosition
  isFocused: boolean
  onDragStart?: (position: PanePosition) => void
  onDrop?: (position: PanePosition) => void
}

export function Pane({ pane, position, isFocused, onDragStart, onDrop }: PaneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    createTab,
    removeTab,
    setActiveTab,
    focusPane,
  } = usePaneStore()

  const handleCreateTab = () => {
    // Create a new tab with a temporary session
    createTab(position, `session-${Date.now()}`, `pane-${position}`, 'New Tab')
  }

  const handleRemoveTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeTab(position, tabId)
  }

  const handleTabClick = (tabId: string) => {
    setActiveTab(position, tabId)
    focusPane(position)
  }

  const handlePaneClick = () => {
    if (!isFocused) {
      focusPane(position)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('panePosition', position)
    onDragStart?.(position)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    onDrop?.(position)
  }

  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId)

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col h-full bg-surface border rounded-lg transition-all',
        isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        isDragOver && 'ring-2 ring-accent/50'
      )}
      onClick={handlePaneClick}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-elevated/50">
        <div className="flex-1 flex items-center gap-1 overflow-x-auto">
          {pane.tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                'whitespace-nowrap min-w-0',
                tab.id === pane.activeTabId
                  ? 'bg-surface text-text-high'
                  : 'text-text-muted hover:bg-surface/50 hover:text-text-high'
              )}
            >
              <span className="truncate">{tab.title}</span>
              <button
                onClick={(e) => handleRemoveTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-danger transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleCreateTab}
          className="h-7 w-7 p-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <PaneContent
            tab={activeTab}
            position={position}
            history={pane.history[activeTab.id]}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted">
            <div className="text-center space-y-2">
              <p>No active tab</p>
              <Button size="sm" onClick={handleCreateTab}>
                Create Tab
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 text-xs text-text-muted border-t border-border bg-elevated/30">
        <span className="capitalize">{position.replace('-', ' ')}</span>
        <span>{pane.tabs.length} tab{pane.tabs.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
