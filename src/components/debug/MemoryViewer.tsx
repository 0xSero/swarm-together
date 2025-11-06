/**
 * Task 120: Memory Viewer Component
 * Displays memory/blackboard state
 */

import { useState, useEffect } from 'react'
import { Database, RefreshCw, Trash2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { invoke } from '@tauri-apps/api/tauri'

interface MemoryEntry {
  key: string
  value: string
  scope: string
  created_at: string
  accessed_at: string
  access_count: number
  ttl_seconds?: number
}

interface MemoryStats {
  total_entries: number
  total_size_bytes: number
  scopes: Record<string, number>
  oldest_entry?: string
  newest_entry?: string
}

export function MemoryViewer() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [search, setSearch] = useState('')
  const [selectedScope, setSelectedScope] = useState<string>('all')
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null)
  const [loading, setLoading] = useState(false)

  // Load memory data
  const loadMemory = async () => {
    setLoading(true)
    try {
      // This would connect to the Tauri backend memory service
      // For now, we'll show a mock implementation
      const mockEntries: MemoryEntry[] = [
        {
          key: 'user:preferences',
          value: JSON.stringify({ theme: 'dark', language: 'en' }),
          scope: 'global',
          created_at: new Date().toISOString(),
          accessed_at: new Date().toISOString(),
          access_count: 42,
        },
        {
          key: 'session:abc123:context',
          value: 'Current task: Implementing telemetry system',
          scope: 'session',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          accessed_at: new Date().toISOString(),
          access_count: 15,
          ttl_seconds: 3600,
        },
        {
          key: 'agent:coordinator:state',
          value: JSON.stringify({ status: 'active', tasks: 3 }),
          scope: 'agent',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          accessed_at: new Date().toISOString(),
          access_count: 8,
        },
      ]

      const mockStats: MemoryStats = {
        total_entries: mockEntries.length,
        total_size_bytes: mockEntries.reduce((sum, e) => sum + e.value.length, 0),
        scopes: mockEntries.reduce((acc, e) => {
          acc[e.scope] = (acc[e.scope] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        oldest_entry: mockEntries[0]?.created_at,
        newest_entry: mockEntries[mockEntries.length - 1]?.created_at,
      }

      setEntries(mockEntries)
      setStats(mockStats)
    } catch (error) {
      console.error('Failed to load memory:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMemory()
  }, [])

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    if (selectedScope !== 'all' && entry.scope !== selectedScope) return false
    if (search && !entry.key.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="flex h-full">
      {/* Memory list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search keys..."
                className="w-full pl-10 pr-3 py-1.5 bg-elevated border border-border rounded text-sm text-text-high placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="px-3 py-1.5 bg-elevated border border-border rounded text-sm text-text-high focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Scopes</option>
              {stats &&
                Object.keys(stats.scopes).map((scope) => (
                  <option key={scope} value={scope}>
                    {scope} ({stats.scopes[scope]})
                  </option>
                ))}
            </select>

            <button
              onClick={loadMemory}
              disabled={loading}
              className="p-2 hover:bg-elevated rounded transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>{stats.total_entries} entries</span>
              <span>{formatBytes(stats.total_size_bytes)}</span>
              <span>{filteredEntries.length} / {stats.total_entries} shown</span>
            </div>
          )}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-muted">
              No memory entries to display
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.key}
                onClick={() => setSelectedEntry(entry)}
                className={cn(
                  'p-2 rounded border border-border/50 hover:border-border cursor-pointer transition-colors',
                  selectedEntry?.key === entry.key ? 'bg-primary/10 border-primary' : 'bg-surface'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono text-text-high truncate">{entry.key}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                      <span className="px-1.5 py-0.5 bg-elevated rounded">{entry.scope}</span>
                      <span>{formatBytes(entry.value.length)}</span>
                      <span>Accessed {entry.access_count}x</span>
                    </div>
                  </div>
                  {entry.ttl_seconds && (
                    <div className="text-xs text-warning">TTL: {entry.ttl_seconds}s</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Entry details */}
      {selectedEntry && (
        <div className="w-96 border-l border-border overflow-y-auto">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-high">Entry Details</h3>
            <button
              onClick={() => setSelectedEntry(null)}
              className="text-xs text-text-muted hover:text-text-high"
            >
              Close
            </button>
          </div>

          <div className="p-3 space-y-4">
            {/* Key */}
            <div>
              <div className="text-xs text-text-muted mb-1">Key</div>
              <div className="text-sm font-mono text-text-high break-all">{selectedEntry.key}</div>
            </div>

            {/* Scope */}
            <div>
              <div className="text-xs text-text-muted mb-1">Scope</div>
              <div className="text-sm">{selectedEntry.scope}</div>
            </div>

            {/* Value */}
            <div>
              <div className="text-xs text-text-muted mb-1">Value</div>
              <div className="bg-elevated p-2 rounded">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                  {selectedEntry.value}
                </pre>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <div className="text-xs text-text-muted mb-1">Metadata</div>
              <div className="text-sm space-y-1">
                <div>Size: {formatBytes(selectedEntry.value.length)}</div>
                <div>Access count: {selectedEntry.access_count}</div>
                <div>Created: {new Date(selectedEntry.created_at).toLocaleString()}</div>
                <div>Last accessed: {new Date(selectedEntry.accessed_at).toLocaleString()}</div>
                {selectedEntry.ttl_seconds && <div>TTL: {selectedEntry.ttl_seconds} seconds</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
