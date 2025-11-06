/**
 * Task 120: Debug Panel
 * In-app debug panel showing telemetry data
 */

import { useState, useEffect } from 'react'
import { Bug, Activity, Database, Heart, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { telemetry } from '@/services/TelemetryService'
import type { LogEntry, TraceSpan, HealthCheck, ConnectorHealth } from '@/types/telemetry'
import { EventStream } from './EventStream'
import { MemoryViewer } from './MemoryViewer'
import { ConnectorHealthView } from './ConnectorHealth'
import { TraceViewer } from './TraceViewer'

interface DebugPanelProps {
  isOpen: boolean
  onClose: () => void
}

type DebugTab = 'events' | 'traces' | 'memory' | 'health'

export function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<DebugTab>('events')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [spans, setSpans] = useState<TraceSpan[]>([])
  const [health, setHealth] = useState<HealthCheck[]>([])
  const [connectors, setConnectors] = useState<ConnectorHealth[]>([])
  const [stats, setStats] = useState(telemetry.getStats())
  const [lastUpdate, setLastUpdate] = useState(Date.now())

  // Subscribe to telemetry events
  useEffect(() => {
    if (!isOpen) return

    const unsubscribe = telemetry.subscribe((event) => {
      switch (event.type) {
        case 'log':
          setLogs((prev) => [...prev.slice(-999), event.data])
          break
        case 'span':
          setSpans((prev) => {
            const existing = prev.findIndex((s) => s.span_id === event.data.span_id)
            if (existing >= 0) {
              const updated = [...prev]
              updated[existing] = event.data
              return updated
            }
            return [...prev.slice(-99), event.data]
          })
          break
        case 'health':
          if ('connector_type' in event.data) {
            setConnectors((prev) => {
              const existing = prev.findIndex((c) => c.component === event.data.component)
              if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = event.data as ConnectorHealth
                return updated
              }
              return [...prev, event.data as ConnectorHealth]
            })
          } else {
            setHealth((prev) => {
              const existing = prev.findIndex((h) => h.component === event.data.component)
              if (existing >= 0) {
                const updated = [...prev]
                updated[existing] = event.data
                return updated
              }
              return [...prev, event.data]
            })
          }
          break
      }
      setLastUpdate(Date.now())
    })

    // Initial load
    setLogs(telemetry.getLogs().slice(-1000))
    setSpans(telemetry.getSpans().slice(-100))
    setHealth(telemetry.getHealthChecks())
    setConnectors(telemetry.getConnectorHealth())
    setStats(telemetry.getStats())

    // Periodic stats update
    const interval = setInterval(() => {
      setStats(telemetry.getStats())
    }, 1000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [isOpen])

  if (!isOpen) return null

  const tabs: { id: DebugTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'events', label: 'Events', icon: <Activity className="w-4 h-4" />, count: stats.logs },
    { id: 'traces', label: 'Traces', icon: <Bug className="w-4 h-4" />, count: stats.spans },
    { id: 'memory', label: 'Memory', icon: <Database className="w-4 h-4" /> },
    {
      id: 'health',
      label: 'Health',
      icon: <Heart className="w-4 h-4" />,
      count: stats.health_checks + stats.connectors,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg shadow-2xl w-[95vw] h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Bug className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-text-high">Debug Panel</h2>
            <div className="flex items-center gap-4 text-xs text-text-muted ml-4">
              <span>Logs: {stats.logs}</span>
              <span>Spans: {stats.spans}</span>
              <span>Metrics: {stats.metrics}</span>
              {stats.dropped_events > 0 && (
                <span className="text-warning">Dropped: {stats.dropped_events}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-elevated rounded transition-colors"
            aria-label="Close debug panel"
          >
            <XCircle className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text-high'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded',
                    activeTab === tab.id ? 'bg-primary/20' : 'bg-elevated'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'events' && <EventStream logs={logs} />}
          {activeTab === 'traces' && <TraceViewer spans={spans} />}
          {activeTab === 'memory' && <MemoryViewer />}
          {activeTab === 'health' && <ConnectorHealthView health={health} connectors={connectors} />}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border text-xs text-text-muted flex items-center justify-between">
          <div>Last update: {new Date(lastUpdate).toLocaleTimeString()}</div>
          <div>
            Crashes: {stats.crash_reports} | Health: {telemetry.getSystemHealth()}
          </div>
        </div>
      </div>
    </div>
  )
}
