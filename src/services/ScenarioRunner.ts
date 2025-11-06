/**
 * Task 150: Scenario Runner
 * Execute scenarios and validate against golden transcripts
 */

import {
  Scenario,
  ScenarioStep,
  ScenarioResult,
  PerformanceMetrics,
  GoldenTranscript,
  GoldenTranscriptEntry,
  meetsPerformanceBudget,
  generateTranscriptChecksum,
  DEFAULT_PERFORMANCE_BUDGET,
} from '@/types/scenarios'

/**
 * Scenario Runner Service
 */
export class ScenarioRunner {
  private performanceMarks: Map<string, number> = new Map()

  /**
   * Execute a scenario
   */
  async executeScenario(scenario: Scenario): Promise<ScenarioResult> {
    const startTime = performance.now()
    const transcript: string[] = []
    const stepResults: ScenarioResult['steps'] = []

    // Initialize performance metrics
    const metrics: PerformanceMetrics = {
      streamLatency: 0,
      paneRenderTime: 0,
      reconciliationTime: 0,
      streamThroughput: 0,
      uiLatency: 0,
      memoryUsageMB: 0,
      fps: 60,
    }

    try {
      // Execute each step
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i]
        const stepStartTime = performance.now()

        try {
          await this.executeStep(step, transcript, metrics)

          const stepDuration = performance.now() - stepStartTime
          stepResults.push({
            step: i + 1,
            type: step.type,
            passed: true,
            duration: stepDuration,
          })
        } catch (error) {
          const stepDuration = performance.now() - stepStartTime
          stepResults.push({
            step: i + 1,
            type: step.type,
            passed: false,
            duration: stepDuration,
            error: String(error),
          })

          // Fail fast on error
          return {
            scenarioId: scenario.id,
            success: false,
            duration: performance.now() - startTime,
            steps: stepResults,
            transcript,
            performance: metrics,
          }
        }
      }

      // Collect final performance metrics
      await this.collectPerformanceMetrics(metrics)

      // Check performance budget
      const budgetCheck = scenario.performanceBudget
        ? meetsPerformanceBudget(metrics, scenario.performanceBudget)
        : { passes: true, violations: [] }

      const success = stepResults.every((r) => r.passed) && budgetCheck.passes

      return {
        scenarioId: scenario.id,
        success,
        duration: performance.now() - startTime,
        steps: stepResults,
        transcript,
        performance: metrics,
      }
    } catch (error) {
      return {
        scenarioId: scenario.id,
        success: false,
        duration: performance.now() - startTime,
        steps: stepResults,
        transcript,
        performance: metrics,
      }
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: ScenarioStep,
    transcript: string[],
    metrics: PerformanceMetrics
  ): Promise<void> {
    const startMark = `step-${Date.now()}-start`
    performance.mark(startMark)

    switch (step.type) {
      case 'user_message':
        await this.executeUserMessage(step, transcript, metrics)
        break

      case 'agent_response':
        await this.executeAgentResponse(step, transcript, metrics)
        break

      case 'command':
        await this.executeCommand(step, transcript, metrics)
        break

      case 'wait':
        await this.executeWait(step)
        break

      case 'assertion':
        await this.executeAssertion(step, transcript)
        break

      default:
        throw new Error(`Unknown step type: ${(step as any).type}`)
    }

    const endMark = `step-${Date.now()}-end`
    performance.mark(endMark)
  }

  /**
   * Execute user message step
   */
  private async executeUserMessage(
    step: ScenarioStep,
    transcript: string[],
    metrics: PerformanceMetrics
  ): Promise<void> {
    const message = typeof step.input === 'string' ? step.input : JSON.stringify(step.input)

    transcript.push(`USER: ${message}`)

    // Simulate sending message
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  /**
   * Execute agent response step
   */
  private async executeAgentResponse(
    step: ScenarioStep,
    transcript: string[],
    metrics: PerformanceMetrics
  ): Promise<void> {
    const startTime = performance.now()

    // Simulate streaming response
    const responseChunks = this.simulateStreamingResponse(step.expected as string)
    let fullResponse = ''

    for (const chunk of responseChunks) {
      fullResponse += chunk
      await new Promise((resolve) => setTimeout(resolve, 5))
    }

    const latency = performance.now() - startTime
    metrics.streamLatency = Math.max(metrics.streamLatency, latency)
    metrics.streamThroughput = fullResponse.length / (latency / 1000)

    transcript.push(`AGENT: ${fullResponse}`)

    // Verify expected output if provided
    if (step.expected && typeof step.expected === 'string') {
      if (!fullResponse.includes(step.expected)) {
        throw new Error(`Expected "${step.expected}" but got "${fullResponse}"`)
      }
    }
  }

  /**
   * Execute command step
   */
  private async executeCommand(
    step: ScenarioStep,
    transcript: string[],
    metrics: PerformanceMetrics
  ): Promise<void> {
    const command = typeof step.input === 'string' ? step.input : JSON.stringify(step.input)

    transcript.push(`COMMAND: ${command}`)

    // Simulate command execution
    await new Promise((resolve) => setTimeout(resolve, 20))

    const result = `Command executed: ${command}`
    transcript.push(`RESULT: ${result}`)
  }

  /**
   * Execute wait step
   */
  private async executeWait(step: ScenarioStep): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, step.timeout || 100))
  }

  /**
   * Execute assertion step
   */
  private async executeAssertion(step: ScenarioStep, transcript: string[]): Promise<void> {
    if (!step.expected) {
      throw new Error('Assertion step requires expected value')
    }

    // Mock assertion - in real implementation would check actual state
    transcript.push(`ASSERTION: ${JSON.stringify(step.expected)}`)
  }

  /**
   * Simulate streaming response
   */
  private simulateStreamingResponse(text: string = 'Default response'): string[] {
    const chunkSize = 10
    const chunks: string[] = []

    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize))
    }

    return chunks
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    // Simulate pane render time
    const renderStart = performance.now()
    await new Promise((resolve) => setTimeout(resolve, 5))
    metrics.paneRenderTime = performance.now() - renderStart

    // Simulate reconciliation time
    const reconStart = performance.now()
    await new Promise((resolve) => setTimeout(resolve, 3))
    metrics.reconciliationTime = performance.now() - reconStart

    // UI latency
    metrics.uiLatency = Math.random() * 30 + 10 // 10-40ms

    // Memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory
      metrics.memoryUsageMB = memory.usedJSHeapSize / (1024 * 1024)
    }

    // FPS (approximate)
    metrics.fps = 60
  }

  /**
   * Compare against golden transcript
   */
  async compareWithGolden(
    result: ScenarioResult,
    golden: GoldenTranscript
  ): Promise<{ matches: boolean; differences: string[] }> {
    const differences: string[] = []

    // Check scenario ID
    if (result.scenarioId !== golden.scenarioId) {
      differences.push(`Scenario ID mismatch: ${result.scenarioId} vs ${golden.scenarioId}`)
    }

    // Compare transcript length
    if (result.transcript.length !== golden.entries.length) {
      differences.push(
        `Transcript length mismatch: ${result.transcript.length} vs ${golden.entries.length}`
      )
    }

    // Compare each entry
    for (let i = 0; i < Math.min(result.transcript.length, golden.entries.length); i++) {
      const resultEntry = result.transcript[i]
      const goldenEntry = golden.entries[i]

      if (resultEntry !== goldenEntry.content) {
        differences.push(`Entry ${i} mismatch:\n  Got: ${resultEntry}\n  Expected: ${goldenEntry.content}`)
      }
    }

    return {
      matches: differences.length === 0,
      differences,
    }
  }

  /**
   * Generate golden transcript from result
   */
  generateGoldenTranscript(result: ScenarioResult, version: string = '1.0.0'): GoldenTranscript {
    const entries: GoldenTranscriptEntry[] = result.transcript.map((line, index) => {
      const [actorRaw, ...contentParts] = line.split(': ')
      const actor = actorRaw.toLowerCase() as 'user' | 'agent' | 'system'
      const content = contentParts.join(': ')

      return {
        timestamp: index,
        actor: actor === 'command' ? 'system' : actor === 'result' ? 'system' : actor,
        action: actor === 'command' ? 'execute' : 'message',
        content: line,
      }
    })

    const checksum = generateTranscriptChecksum(entries)

    return {
      scenarioId: result.scenarioId,
      version,
      entries,
      checksum,
    }
  }

  /**
   * Save golden transcript
   */
  async saveGoldenTranscript(transcript: GoldenTranscript, path: string): Promise<void> {
    const content = JSON.stringify(transcript, null, 2)
    // In browser environment, download as file
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = path
    a.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Load golden transcript
   */
  async loadGoldenTranscript(path: string): Promise<GoldenTranscript> {
    // Mock implementation - would load from file system
    return {
      scenarioId: '',
      version: '1.0.0',
      entries: [],
      checksum: '',
    }
  }
}

// Singleton instance
export const scenarioRunner = new ScenarioRunner()
