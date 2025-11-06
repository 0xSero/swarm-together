/**
 * Task 120: Connector Health Component
 * Displays health status of components and connectors
 */

import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, Activity, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HealthCheck, ConnectorHealth, HealthStatus } from '@/types/telemetry'
import { getHealthColor } from '@/types/telemetry'

interface ConnectorHealthViewProps {
  health: HealthCheck[]
  connectors: ConnectorHealth[]
}

export function ConnectorHealthView({ health, connectors }: ConnectorHealthViewProps) {
  const [selectedComponent, setSelectedComponent] = useState<HealthCheck | ConnectorHealth | null>(null)

  // Get status icon
  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-success" />
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-warning" />
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-danger" />
      case 'unknown':
        return <HelpCircle className="w-5 h-5 text-text-muted" />
    }
  }

  // Get status badge color
  const getStatusBadgeClass = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return 'bg-success/20 text-success'
      case 'degraded':
        return 'bg-warning/20 text-warning'
      case 'unhealthy':
        return 'bg-danger/20 text-danger'
      case 'unknown':
        return 'bg-elevated text-text-muted'
    }
  }

  // Calculate overall health
  const allComponents = [...health, ...connectors]
  const healthyCount = allComponents.filter((c) => c.status === 'healthy').length
  const degradedCount = allComponents.filter((c) => c.status === 'degraded').length
  const unhealthyCount = allComponents.filter((c) => c.status === 'unhealthy').length

  return (
    <div className="flex h-full">
      {/* Component list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Summary */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-text-high">System Health</h3>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-sm text-text-high">{allComponents.length} components</span>
            </div>
          </div>

          {/* Status summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-success/10 p-3 rounded">
              <div className="text-2xl font-bold text-success">{healthyCount}</div>
              <div className="text-xs text-text-muted">Healthy</div>
            </div>
            <div className="bg-warning/10 p-3 rounded">
              <div className="text-2xl font-bold text-warning">{degradedCount}</div>
              <div className="text-xs text-text-muted">Degraded</div>
            </div>
            <div className="bg-danger/10 p-3 rounded">
              <div className="text-2xl font-bold text-danger">{unhealthyCount}</div>
              <div className="text-xs text-text-muted">Unhealthy</div>
            </div>
          </div>
        </div>

        {/* General components */}
        {health.length > 0 && (
          <div className="border-b border-border">
            <div className="p-3 bg-elevated/50">
              <h4 className="text-sm font-semibold text-text-high">Components</h4>
            </div>
            <div className="p-2 space-y-1">
              {health.map((check) => (
                <button
                  key={check.component}
                  onClick={() => setSelectedComponent(check)}
                  className={cn(
                    'w-full p-3 rounded border transition-colors text-left',
                    selectedComponent === check
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getStatusIcon(check.status)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-high">{check.component}</div>
                        {check.message && (
                          <div className="text-xs text-text-muted mt-1">{check.message}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={cn('text-xs px-2 py-0.5 rounded capitalize', getStatusBadgeClass(check.status))}>
                        {check.status}
                      </div>
                      <div className="text-xs text-text-muted">
                        {check.response_time_ms.toFixed(0)}ms
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connectors */}
        {connectors.length > 0 && (
          <div>
            <div className="p-3 bg-elevated/50">
              <h4 className="text-sm font-semibold text-text-high">Connectors</h4>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto">
              {connectors.map((connector) => (
                <button
                  key={connector.component}
                  onClick={() => setSelectedComponent(connector)}
                  className={cn(
                    'w-full p-3 rounded border transition-colors text-left',
                    selectedComponent === connector
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getStatusIcon(connector.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-text-high">{connector.component}</div>
                          <div className="text-xs px-1.5 py-0.5 bg-elevated rounded">
                            {connector.connector_type}
                          </div>
                        </div>
                        {connector.message && (
                          <div className="text-xs text-text-muted mt-1">{connector.message}</div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                          <span>Requests: {connector.request_count}</span>
                          <span>Errors: {connector.error_count}</span>
                          <span>Error rate: {(connector.error_rate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={cn('text-xs px-2 py-0.5 rounded capitalize', getStatusBadgeClass(connector.status))}>
                        {connector.status}
                      </div>
                      <div className={cn(
                        'text-xs px-2 py-0.5 rounded',
                        connector.connected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                      )}>
                        {connector.connected ? 'Connected' : 'Disconnected'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {allComponents.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted">
            No health checks available
          </div>
        )}
      </div>

      {/* Details panel */}
      {selectedComponent && (
        <div className="w-96 border-l border-border overflow-y-auto">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-high">Health Details</h3>
            <button
              onClick={() => setSelectedComponent(null)}
              className="text-xs text-text-muted hover:text-text-high"
            >
              Close
            </button>
          </div>

          <div className="p-3 space-y-4">
            {/* Component name */}
            <div>
              <div className="text-xs text-text-muted mb-1">Component</div>
              <div className="text-sm font-medium text-text-high">{selectedComponent.component}</div>
            </div>

            {/* Status */}
            <div>
              <div className="text-xs text-text-muted mb-1">Status</div>
              <div className="flex items-center gap-2">
                {getStatusIcon(selectedComponent.status)}
                <span className={cn('text-sm capitalize', getHealthColor(selectedComponent.status))}>
                  {selectedComponent.status}
                </span>
              </div>
            </div>

            {/* Message */}
            {selectedComponent.message && (
              <div>
                <div className="text-xs text-text-muted mb-1">Message</div>
                <div className="text-sm text-text-high">{selectedComponent.message}</div>
              </div>
            )}

            {/* Connector-specific */}
            {'connector_type' in selectedComponent && (
              <>
                <div>
                  <div className="text-xs text-text-muted mb-1">Connector Type</div>
                  <div className="text-sm text-text-high">{selectedComponent.connector_type}</div>
                </div>

                <div>
                  <div className="text-xs text-text-muted mb-1">Connection Status</div>
                  <div className={cn(
                    'text-sm',
                    selectedComponent.connected ? 'text-success' : 'text-danger'
                  )}>
                    {selectedComponent.connected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-text-muted mb-1">Statistics</div>
                  <div className="bg-elevated p-2 rounded space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Total Requests:</span>
                      <span className="text-text-high">{selectedComponent.request_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Total Errors:</span>
                      <span className="text-danger">{selectedComponent.error_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Error Rate:</span>
                      <span className="text-warning">{(selectedComponent.error_rate * 100).toFixed(2)}%</span>
                    </div>
                    {selectedComponent.last_request && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Last Request:</span>
                        <span className="text-text-high">
                          {new Date(selectedComponent.last_request).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Detailed checks */}
            {selectedComponent.checks.length > 0 && (
              <div>
                <div className="text-xs text-text-muted mb-1">Detailed Checks</div>
                <div className="space-y-2">
                  {selectedComponent.checks.map((check, index) => (
                    <div key={index} className="bg-elevated p-2 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-text-high">{check.name}</div>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(check.status)}
                        </div>
                      </div>
                      {check.message && (
                        <div className="text-xs text-text-muted">{check.message}</div>
                      )}
                      {check.value !== undefined && (
                        <div className="text-xs text-text-muted mt-1">
                          Value: {JSON.stringify(check.value)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Response time */}
            <div>
              <div className="text-xs text-text-muted mb-1">Response Time</div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm text-text-high">{selectedComponent.response_time_ms.toFixed(2)}ms</span>
              </div>
            </div>

            {/* Last check */}
            <div>
              <div className="text-xs text-text-muted mb-1">Last Check</div>
              <div className="text-sm text-text-high">
                {new Date(selectedComponent.last_check).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
