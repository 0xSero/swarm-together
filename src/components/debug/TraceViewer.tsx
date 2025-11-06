/**
 * Task 120: Trace Viewer Component
 * Visualizes trace spans in tree structure
 */

import { useState } from 'react'
import { ChevronRight, ChevronDown, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TraceSpan, TraceNode, SpanStatus } from '@/types/telemetry'
import { buildTraceTree, formatDuration } from '@/types/telemetry'

interface TraceViewerProps {
  spans: TraceSpan[]
}

export function TraceViewer({ spans }: TraceViewerProps) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null)
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set())
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null)

  // Group spans by trace ID
  const traceGroups = spans.reduce((acc, span) => {
    if (!acc[span.trace_id]) {
      acc[span.trace_id] = []
    }
    acc[span.trace_id].push(span)
    return acc
  }, {} as Record<string, TraceSpan[]>)

  const traceIds = Object.keys(traceGroups)
  const activeTraceId = selectedTraceId || traceIds[0]
  const activeSpans = activeTraceId ? traceGroups[activeTraceId] || [] : []
  const traceTree = buildTraceTree(activeSpans)

  // Toggle span expansion
  const toggleSpan = (spanId: string) => {
    const newExpanded = new Set(expandedSpans)
    if (newExpanded.has(spanId)) {
      newExpanded.delete(spanId)
    } else {
      newExpanded.add(spanId)
    }
    setExpandedSpans(newExpanded)
  }

  // Get status icon
  const getStatusIcon = (status: SpanStatus) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-4 h-4 text-success" />
      case 'error':
        return <XCircle className="w-4 h-4 text-danger" />
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-warning" />
    }
  }

  // Render span tree node
  const renderSpanNode = (node: TraceNode) => {
    const { span, children, depth } = node
    const isExpanded = expandedSpans.has(span.span_id)
    const isSelected = selectedSpan?.span_id === span.span_id
    const hasChildren = children.length > 0

    return (
      <div key={span.span_id}>
        <div
          style={{ paddingLeft: `${depth * 20}px` }}
          className={cn(
            'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
            isSelected ? 'bg-primary/20 text-primary' : 'hover:bg-elevated'
          )}
          onClick={() => setSelectedSpan(span)}
        >
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSpan(span.span_id)
              }}
              className="p-0.5 hover:bg-elevated rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Status icon */}
          {getStatusIcon(span.status)}

          {/* Span name */}
          <div className="flex-1 text-sm font-mono">{span.name}</div>

          {/* Duration */}
          {span.duration_ms !== undefined && (
            <div className="text-xs text-text-muted font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(span.duration_ms)}
            </div>
          )}

          {/* Event count */}
          {span.events.length > 0 && (
            <div className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {span.events.length} events
            </div>
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {children.map((child) => renderSpanNode(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Trace list */}
      <div className="w-64 border-r border-border overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-high">Traces</h3>
          <div className="text-xs text-text-muted">{traceIds.length} traces</div>
        </div>
        <div className="p-2 space-y-1">
          {traceIds.map((traceId) => {
            const traceSpans = traceGroups[traceId]
            const rootSpan = traceSpans.find((s) => !s.parent_span_id)
            const hasErrors = traceSpans.some((s) => s.status === 'error')

            return (
              <button
                key={traceId}
                onClick={() => setSelectedTraceId(traceId)}
                className={cn(
                  'w-full text-left p-2 rounded transition-colors',
                  activeTraceId === traceId
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-elevated text-text-high'
                )}
              >
                <div className="text-sm font-mono truncate">{rootSpan?.name || 'Unknown'}</div>
                <div className="text-xs text-text-muted mt-1 flex items-center justify-between">
                  <span>{traceSpans.length} spans</span>
                  {hasErrors && <XCircle className="w-3 h-3 text-danger" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Span tree */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-high">Span Tree</h3>
            <div className="text-xs text-text-muted">{activeSpans.length} spans</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const allSpanIds = activeSpans.map((s) => s.span_id)
                setExpandedSpans(new Set(allSpanIds))
              }}
              className="px-2 py-1 text-xs bg-elevated hover:bg-elevated/80 rounded transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={() => setExpandedSpans(new Set())}
              className="px-2 py-1 text-xs bg-elevated hover:bg-elevated/80 rounded transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Tree view */}
        <div className="flex-1 overflow-y-auto p-2">
          {traceTree.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-muted">
              No spans to display
            </div>
          ) : (
            <div className="space-y-1">
              {traceTree.map((node) => renderSpanNode(node))}
            </div>
          )}
        </div>
      </div>

      {/* Span details */}
      {selectedSpan && (
        <div className="w-96 border-l border-border overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-high">Span Details</h3>
          </div>
          <div className="p-3 space-y-4">
            {/* Basic info */}
            <div>
              <div className="text-xs text-text-muted mb-1">Name</div>
              <div className="text-sm font-mono text-text-high">{selectedSpan.name}</div>
            </div>

            <div>
              <div className="text-xs text-text-muted mb-1">Status</div>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedSpan.status)}
                <span className="text-sm capitalize">{selectedSpan.status}</span>
              </div>
            </div>

            {/* Timing */}
            <div>
              <div className="text-xs text-text-muted mb-1">Timing</div>
              <div className="text-sm space-y-1">
                <div>Start: {new Date(selectedSpan.start_time).toLocaleTimeString()}</div>
                {selectedSpan.end_time && (
                  <div>End: {new Date(selectedSpan.end_time).toLocaleTimeString()}</div>
                )}
                {selectedSpan.duration_ms !== undefined && (
                  <div className="font-semibold">Duration: {formatDuration(selectedSpan.duration_ms)}</div>
                )}
              </div>
            </div>

            {/* Attributes */}
            {Object.keys(selectedSpan.attributes).length > 0 && (
              <div>
                <div className="text-xs text-text-muted mb-1">Attributes</div>
                <pre className="text-xs bg-elevated p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedSpan.attributes, null, 2)}
                </pre>
              </div>
            )}

            {/* Events */}
            {selectedSpan.events.length > 0 && (
              <div>
                <div className="text-xs text-text-muted mb-1">Events ({selectedSpan.events.length})</div>
                <div className="space-y-2">
                  {selectedSpan.events.map((event, index) => (
                    <div key={index} className="bg-elevated p-2 rounded">
                      <div className="text-sm font-mono">{event.name}</div>
                      <div className="text-xs text-text-muted">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      {event.attributes && (
                        <pre className="text-xs mt-1 overflow-x-auto">
                          {JSON.stringify(event.attributes, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IDs */}
            <div>
              <div className="text-xs text-text-muted mb-1">IDs</div>
              <div className="text-xs font-mono space-y-1">
                <div>Span: {selectedSpan.span_id}</div>
                <div>Trace: {selectedSpan.trace_id}</div>
                {selectedSpan.parent_span_id && <div>Parent: {selectedSpan.parent_span_id}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
