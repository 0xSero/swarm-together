/**
 * Task 150: E2E Scenarios and Performance
 * Types for scenario definitions and performance budgets
 */

// ============================================================================
// Scenario Types
// ============================================================================

/**
 * Agent scenario step
 */
export interface ScenarioStep {
  /** Step type */
  type: 'user_message' | 'agent_response' | 'command' | 'wait' | 'assertion'

  /** Step description */
  description: string

  /** Input data */
  input?: string | Record<string, any>

  /** Expected output (for assertions) */
  expected?: string | Record<string, any>

  /** Timeout in milliseconds */
  timeout?: number

  /** Metadata */
  metadata?: Record<string, any>
}

/**
 * Complete scenario definition
 */
export interface Scenario {
  /** Scenario ID */
  id: string

  /** Scenario name */
  name: string

  /** Description */
  description: string

  /** Tags for categorization */
  tags: string[]

  /** Initial state */
  initialState?: Record<string, any>

  /** Scenario steps */
  steps: ScenarioStep[]

  /** Golden transcript file path */
  goldenTranscript?: string

  /** Performance budget */
  performanceBudget?: PerformanceBudget
}

/**
 * Scenario execution result
 */
export interface ScenarioResult {
  scenarioId: string
  success: boolean
  duration: number
  steps: Array<{
    step: number
    type: string
    passed: boolean
    duration: number
    error?: string
  }>
  transcript: string[]
  performance: PerformanceMetrics
}

// ============================================================================
// Performance Budgets
// ============================================================================

/**
 * Performance budget constraints
 */
export interface PerformanceBudget {
  /** Maximum streaming latency (ms) */
  maxStreamLatency: number

  /** Maximum pane render time (ms) */
  maxPaneRenderTime: number

  /** Maximum reconciliation time (ms) */
  maxReconciliationTime: number

  /** Minimum stream throughput (tokens/sec) */
  minStreamThroughput: number

  /** Maximum UI latency (ms) */
  maxUILatency: number

  /** Maximum memory usage (MB) */
  maxMemoryUsageMB: number
}

/**
 * Performance metrics collected during execution
 */
export interface PerformanceMetrics {
  streamLatency: number
  paneRenderTime: number
  reconciliationTime: number
  streamThroughput: number
  uiLatency: number
  memoryUsageMB: number
  fps: number
}

/**
 * Default performance budgets
 */
export const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = {
  maxStreamLatency: 100, // 100ms
  maxPaneRenderTime: 16, // 60 FPS
  maxReconciliationTime: 50, // 50ms
  minStreamThroughput: 100, // 100 tokens/sec
  maxUILatency: 50, // 50ms
  maxMemoryUsageMB: 512, // 512 MB
}

// ============================================================================
// Golden Transcript
// ============================================================================

/**
 * Golden transcript entry
 */
export interface GoldenTranscriptEntry {
  timestamp: number
  actor: 'user' | 'agent' | 'system'
  action: string
  content: string
  metadata?: Record<string, any>
}

/**
 * Golden transcript
 */
export interface GoldenTranscript {
  scenarioId: string
  version: string
  entries: GoldenTranscriptEntry[]
  checksum: string
}

// ============================================================================
// Built-in Scenarios
// ============================================================================

/**
 * Simple completion scenario
 */
export const SCENARIO_SIMPLE_COMPLETION: Scenario = {
  id: 'simple-completion',
  name: 'Simple Completion',
  description: 'User sends message, agent responds with completion',
  tags: ['basic', 'completion'],
  steps: [
    {
      type: 'user_message',
      description: 'User sends greeting',
      input: 'Hello, can you help me?',
    },
    {
      type: 'agent_response',
      description: 'Agent responds',
      expected: 'Hello! I\'d be happy to help you.',
      timeout: 5000,
    },
  ],
  performanceBudget: DEFAULT_PERFORMANCE_BUDGET,
}

/**
 * Multi-turn conversation scenario
 */
export const SCENARIO_MULTI_TURN: Scenario = {
  id: 'multi-turn-conversation',
  name: 'Multi-Turn Conversation',
  description: 'Multiple back-and-forth exchanges',
  tags: ['conversation', 'multi-turn'],
  steps: [
    {
      type: 'user_message',
      description: 'User asks question',
      input: 'What is 2 + 2?',
    },
    {
      type: 'agent_response',
      description: 'Agent answers',
      expected: '2 + 2 equals 4',
      timeout: 5000,
    },
    {
      type: 'user_message',
      description: 'User asks follow-up',
      input: 'And what about 3 + 3?',
    },
    {
      type: 'agent_response',
      description: 'Agent answers follow-up',
      expected: '3 + 3 equals 6',
      timeout: 5000,
    },
  ],
  performanceBudget: DEFAULT_PERFORMANCE_BUDGET,
}

/**
 * Slash command scenario
 */
export const SCENARIO_SLASH_COMMANDS: Scenario = {
  id: 'slash-commands',
  name: 'Slash Commands',
  description: 'Execute various slash commands',
  tags: ['commands', 'slash'],
  steps: [
    {
      type: 'command',
      description: 'Create new session',
      input: '/new test-session',
    },
    {
      type: 'command',
      description: 'Check token usage',
      input: '/tokens',
    },
    {
      type: 'command',
      description: 'Show memory state',
      input: '/memory',
    },
  ],
  performanceBudget: DEFAULT_PERFORMANCE_BUDGET,
}

/**
 * Token reconciliation scenario
 */
export const SCENARIO_TOKEN_RECONCILIATION: Scenario = {
  id: 'token-reconciliation',
  name: 'Token Reconciliation',
  description: 'Test token estimation and reconciliation',
  tags: ['tokens', 'reconciliation'],
  steps: [
    {
      type: 'user_message',
      description: 'Send message to generate tokens',
      input: 'Write a short poem about code',
    },
    {
      type: 'agent_response',
      description: 'Agent generates response',
      timeout: 5000,
    },
    {
      type: 'assertion',
      description: 'Verify token tracking',
      expected: { hasTokens: true, reconciled: true },
    },
  ],
  performanceBudget: {
    ...DEFAULT_PERFORMANCE_BUDGET,
    maxReconciliationTime: 30, // Faster reconciliation for this scenario
  },
}

/**
 * Pane management scenario
 */
export const SCENARIO_PANE_MANAGEMENT: Scenario = {
  id: 'pane-management',
  name: 'Pane Management',
  description: 'Test pane creation, switching, and layout',
  tags: ['ui', 'panes'],
  steps: [
    {
      type: 'command',
      description: 'Create new tab in pane 1',
      input: { action: 'createTab', pane: 0 },
    },
    {
      type: 'wait',
      description: 'Wait for pane to render',
      timeout: 100,
    },
    {
      type: 'assertion',
      description: 'Verify pane rendered',
      expected: { paneCount: 4 },
    },
    {
      type: 'command',
      description: 'Switch to pane 2',
      input: { action: 'focusPane', pane: 1 },
    },
    {
      type: 'assertion',
      description: 'Verify pane switched',
      expected: { activePaneIndex: 1 },
    },
  ],
  performanceBudget: {
    ...DEFAULT_PERFORMANCE_BUDGET,
    maxPaneRenderTime: 16, // 60 FPS requirement
  },
}

/**
 * Streaming performance scenario
 */
export const SCENARIO_STREAMING_PERFORMANCE: Scenario = {
  id: 'streaming-performance',
  name: 'Streaming Performance',
  description: 'Test streaming latency and throughput',
  tags: ['performance', 'streaming'],
  steps: [
    {
      type: 'user_message',
      description: 'Request long completion',
      input: 'Write a detailed explanation of how computers work',
    },
    {
      type: 'agent_response',
      description: 'Agent streams response',
      timeout: 10000,
    },
    {
      type: 'assertion',
      description: 'Verify streaming performance',
      expected: {
        streamLatency: { max: 100 },
        throughput: { min: 100 },
      },
    },
  ],
  performanceBudget: {
    ...DEFAULT_PERFORMANCE_BUDGET,
    maxStreamLatency: 100,
    minStreamThroughput: 100,
  },
}

/**
 * All built-in scenarios
 */
export const BUILT_IN_SCENARIOS: Scenario[] = [
  SCENARIO_SIMPLE_COMPLETION,
  SCENARIO_MULTI_TURN,
  SCENARIO_SLASH_COMMANDS,
  SCENARIO_TOKEN_RECONCILIATION,
  SCENARIO_PANE_MANAGEMENT,
  SCENARIO_STREAMING_PERFORMANCE,
]

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if performance metrics meet budget
 */
export function meetsPerformanceBudget(
  metrics: PerformanceMetrics,
  budget: PerformanceBudget
): { passes: boolean; violations: string[] } {
  const violations: string[] = []

  if (metrics.streamLatency > budget.maxStreamLatency) {
    violations.push(
      `Stream latency ${metrics.streamLatency}ms exceeds budget ${budget.maxStreamLatency}ms`
    )
  }

  if (metrics.paneRenderTime > budget.maxPaneRenderTime) {
    violations.push(
      `Pane render time ${metrics.paneRenderTime}ms exceeds budget ${budget.maxPaneRenderTime}ms`
    )
  }

  if (metrics.reconciliationTime > budget.maxReconciliationTime) {
    violations.push(
      `Reconciliation time ${metrics.reconciliationTime}ms exceeds budget ${budget.maxReconciliationTime}ms`
    )
  }

  if (metrics.streamThroughput < budget.minStreamThroughput) {
    violations.push(
      `Stream throughput ${metrics.streamThroughput} tokens/s below budget ${budget.minStreamThroughput} tokens/s`
    )
  }

  if (metrics.uiLatency > budget.maxUILatency) {
    violations.push(`UI latency ${metrics.uiLatency}ms exceeds budget ${budget.maxUILatency}ms`)
  }

  if (metrics.memoryUsageMB > budget.maxMemoryUsageMB) {
    violations.push(
      `Memory usage ${metrics.memoryUsageMB}MB exceeds budget ${budget.maxMemoryUsageMB}MB`
    )
  }

  return {
    passes: violations.length === 0,
    violations,
  }
}

/**
 * Generate checksum for transcript
 */
export function generateTranscriptChecksum(entries: GoldenTranscriptEntry[]): string {
  const content = entries.map((e) => `${e.actor}:${e.action}:${e.content}`).join('|')

  // Simple hash (in production would use crypto.subtle)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16)
}
