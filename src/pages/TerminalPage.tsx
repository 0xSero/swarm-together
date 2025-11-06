import { useState, useEffect } from 'react'
import { PaneManager } from '@/components/panes/PaneManager'
import { TokenHUD } from '@/components/tokens/TokenHUD'
import { DebugPanel } from '@/components/debug/DebugPanel'
import { telemetry } from '@/services/TelemetryService'

export default function TerminalPage() {
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)

  // Keyboard shortcut: Ctrl+Shift+D to open debug panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDebugPanelOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Expose telemetry to window for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).telemetry = telemetry
      ;(window as any).TelemetryService = require('@/services/TelemetryService').TelemetryService
    }
  }, [])

  return (
    <div className="relative h-[calc(100vh-8rem)]">
      <PaneManager />
      <TokenHUD position="bottom" compact={false} />
      <DebugPanel isOpen={debugPanelOpen} onClose={() => setDebugPanelOpen(false)} />
    </div>
  )
}
