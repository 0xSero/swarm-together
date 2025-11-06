/**
 * Task 120: Event Stream Component
 * Displays streaming log entries with filtering
 */

import { useState, useRef, useEffect } from 'react'
import { Search, Filter, Trash2, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LogEntry, LogLevel, LogFilter } from '@/types/telemetry'
import { getLogLevelColor } from '@/types/telemetry'

interface EventStreamProps {
  logs: LogEntry[]
}

export function EventStream({ logs }: EventStreamProps) {
  const [filter, setFilter] = useState<LogFilter>({})
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all')
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (selectedLevel !== 'all' && log.level !== selectedLevel) return false
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Copy log to clipboard
  const handleCopy = async (log: LogEntry) => {
    const text = JSON.stringify(log, null, 2)
    await navigator.clipboard.writeText(text)
    setCopiedId(log.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Level colors
  const levelColors: Record<LogLevel, string> = {
    debug: 'bg-text-muted/10 text-text-muted',
    info: 'bg-primary/10 text-primary',
    warn: 'bg-warning/10 text-warning',
    error: 'bg-danger/10 text-danger',
    fatal: 'bg-danger/20 text-danger',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="w-full pl-10 pr-3 py-1.5 bg-elevated border border-border rounded text-sm text-text-high placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Level filter */}
        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value as LogLevel | 'all')}
          className="px-3 py-1.5 bg-elevated border border-border rounded text-sm text-text-high focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
          <option value="fatal">Fatal</option>
        </select>

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            'px-3 py-1.5 rounded text-sm transition-colors',
            autoScroll ? 'bg-primary text-white' : 'bg-elevated text-text-high'
          )}
        >
          Auto-scroll
        </button>

        {/* Stats */}
        <div className="text-sm text-text-muted">
          {filteredLogs.length} / {logs.length} logs
        </div>
      </div>

      {/* Log entries */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={cn(
                'p-2 rounded border border-border/50 hover:border-border transition-colors',
                expandedLog === log.id ? 'bg-elevated' : 'bg-surface'
              )}
            >
              <div
                className="flex items-start gap-2 cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                {/* Level badge */}
                <div
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-mono uppercase flex-shrink-0',
                    levelColors[log.level]
                  )}
                >
                  {log.level}
                </div>

                {/* Timestamp */}
                <div className="text-xs text-text-muted font-mono flex-shrink-0 w-20">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>

                {/* Component */}
                <div className="text-xs text-primary font-mono flex-shrink-0 max-w-[150px] truncate">
                  {log.component}
                </div>

                {/* Message */}
                <div className={cn('flex-1 text-sm', getLogLevelColor(log.level))}>
                  {log.message}
                  {log.redacted && (
                    <span className="ml-2 text-xs text-warning">[REDACTED]</span>
                  )}
                </div>

                {/* Copy button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy(log)
                  }}
                  className="p-1 hover:bg-elevated rounded transition-colors flex-shrink-0"
                  title="Copy log"
                >
                  {copiedId === log.id ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-text-muted" />
                  )}
                </button>
              </div>

              {/* Expanded details */}
              {expandedLog === log.id && (
                <div className="mt-2 pt-2 border-t border-border space-y-2">
                  {/* Context */}
                  {log.context && Object.keys(log.context).length > 0 && (
                    <div>
                      <div className="text-xs text-text-muted mb-1">Context:</div>
                      <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.context, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {log.error && (
                    <div>
                      <div className="text-xs text-danger mb-1">Error:</div>
                      <div className="text-xs bg-danger/10 p-2 rounded">
                        <div className="font-mono">{log.error.name}: {log.error.message}</div>
                        {log.error.stack && (
                          <pre className="mt-1 text-text-muted overflow-x-auto">
                            {log.error.stack}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="text-xs text-text-muted space-x-4">
                    <span>ID: {log.id}</span>
                    {log.span_id && <span>Span: {log.span_id}</span>}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
