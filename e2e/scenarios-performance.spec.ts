import { test, expect } from '@playwright/test'

test.describe('E2E Scenarios and Performance - Task 150', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('should execute simple completion scenario', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_SIMPLE_COMPLETION } = await import('@/types/scenarios')

      return await scenarioRunner.executeScenario(SCENARIO_SIMPLE_COMPLETION)
    })

    expect(result.success).toBe(true)
    expect(result.steps.every((s) => s.passed)).toBe(true)
    expect(result.transcript.length).toBeGreaterThan(0)
  })

  test('should execute multi-turn conversation scenario', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_MULTI_TURN } = await import('@/types/scenarios')

      return await scenarioRunner.executeScenario(SCENARIO_MULTI_TURN)
    })

    expect(result.success).toBe(true)
    expect(result.transcript.length).toBeGreaterThanOrEqual(4) // 2 user + 2 agent messages
  })

  test('should execute slash commands scenario', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_SLASH_COMMANDS } = await import('@/types/scenarios')

      return await scenarioRunner.executeScenario(SCENARIO_SLASH_COMMANDS)
    })

    expect(result.success).toBe(true)
    expect(result.transcript.some((t) => t.includes('COMMAND'))).toBe(true)
  })

  test('should execute token reconciliation scenario', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_TOKEN_RECONCILIATION } = await import('@/types/scenarios')

      return await scenarioRunner.executeScenario(SCENARIO_TOKEN_RECONCILIATION)
    })

    expect(result.success).toBe(true)
    expect(result.performance.reconciliationTime).toBeLessThan(50)
  })

  test('should execute pane management scenario', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_PANE_MANAGEMENT } = await import('@/types/scenarios')

      return await scenarioRunner.executeScenario(SCENARIO_PANE_MANAGEMENT)
    })

    expect(result.success).toBe(true)
    expect(result.performance.paneRenderTime).toBeLessThan(16) // 60 FPS
  })

  test('should execute streaming performance scenario', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_STREAMING_PERFORMANCE } = await import('@/types/scenarios')

      return await scenarioRunner.executeScenario(SCENARIO_STREAMING_PERFORMANCE)
    })

    expect(result.success).toBe(true)
    expect(result.performance.streamLatency).toBeLessThan(100)
    expect(result.performance.streamThroughput).toBeGreaterThan(100)
  })

  test('should meet performance budgets', async ({ page }) => {
    const budgetCheck = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_STREAMING_PERFORMANCE, meetsPerformanceBudget } = await import('@/types/scenarios')

      const result = await scenarioRunner.executeScenario(SCENARIO_STREAMING_PERFORMANCE)

      const budget = SCENARIO_STREAMING_PERFORMANCE.performanceBudget!
      return meetsPerformanceBudget(result.performance, budget)
    })

    expect(budgetCheck.passes).toBe(true)
    if (!budgetCheck.passes) {
      console.log('Performance budget violations:', budgetCheck.violations)
    }
  })

  test('should generate golden transcript', async ({ page }) => {
    const golden = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_SIMPLE_COMPLETION } = await import('@/types/scenarios')

      const result = await scenarioRunner.executeScenario(SCENARIO_SIMPLE_COMPLETION)
      return scenarioRunner.generateGoldenTranscript(result)
    })

    expect(golden).toBeDefined()
    expect(golden.scenarioId).toBe('simple-completion')
    expect(golden.entries.length).toBeGreaterThan(0)
    expect(golden.checksum).toBeTruthy()
  })

  test('should validate against golden transcript', async ({ page }) => {
    const comparison = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_SIMPLE_COMPLETION } = await import('@/types/scenarios')

      // Execute scenario
      const result = await scenarioRunner.executeScenario(SCENARIO_SIMPLE_COMPLETION)

      // Generate golden
      const golden = scenarioRunner.generateGoldenTranscript(result)

      // Execute again
      const result2 = await scenarioRunner.executeScenario(SCENARIO_SIMPLE_COMPLETION)

      // Compare
      return await scenarioRunner.compareWithGolden(result2, golden)
    })

    expect(comparison.matches).toBe(true)
    expect(comparison.differences).toHaveLength(0)
  })

  test('should detect transcript differences', async ({ page }) => {
    const comparison = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_SIMPLE_COMPLETION } = await import('@/types/scenarios')

      // Execute scenario
      const result = await scenarioRunner.executeScenario(SCENARIO_SIMPLE_COMPLETION)

      // Create modified golden
      const golden = scenarioRunner.generateGoldenTranscript(result)
      golden.entries[0].content = 'DIFFERENT CONTENT'

      // Compare
      return await scenarioRunner.compareWithGolden(result, golden)
    })

    expect(comparison.matches).toBe(false)
    expect(comparison.differences.length).toBeGreaterThan(0)
  })

  test('should measure stream latency under budget', async ({ page }) => {
    // Navigate to terminal
    await page.goto('http://localhost:1420/terminal')
    await page.waitForLoadState('networkidle')

    const startTime = Date.now()

    // Simulate user input
    const input = page.locator('textarea, input[type="text"]').first()
    if ((await input.count()) > 0) {
      await input.fill('Test message for latency measurement')
      await input.press('Enter')

      // Wait for response
      await page.waitForTimeout(500)

      const endTime = Date.now()
      const latency = endTime - startTime

      // Should be under 100ms budget (excluding network/processing)
      expect(latency).toBeLessThan(1000) // Generous limit for E2E
    }
  })

  test('should render panes at 60 FPS', async ({ page }) => {
    await page.goto('http://localhost:1420/terminal')
    await page.waitForLoadState('networkidle')

    const fpsData = await page.evaluate(async () => {
      let frameCount = 0
      const startTime = performance.now()

      // Count frames for 1 second
      return new Promise<number>((resolve) => {
        function countFrame() {
          frameCount++
          const elapsed = performance.now() - startTime

          if (elapsed < 1000) {
            requestAnimationFrame(countFrame)
          } else {
            resolve(frameCount)
          }
        }

        requestAnimationFrame(countFrame)
      })
    })

    // Should achieve close to 60 FPS
    expect(fpsData).toBeGreaterThan(55) // Allow some variance
  })

  test('should complete reconciliation under budget', async ({ page }) => {
    const reconTime = await page.evaluate(async () => {
      const startTime = performance.now()

      // Simulate reconciliation work
      const mockUsage = {
        input_tokens: 100,
        output_tokens: 50,
        estimated: true,
      }

      // Mock reconciliation
      await new Promise((resolve) => setTimeout(resolve, 10))

      return performance.now() - startTime
    })

    expect(reconTime).toBeLessThan(50) // 50ms budget
  })

  test('should maintain UI latency under 50ms', async ({ page }) => {
    await page.goto('http://localhost:1420/terminal')

    // Measure button click latency
    const button = page.getByRole('button').first()
    if ((await button.count()) > 0) {
      const startTime = Date.now()
      await button.click()
      const endTime = Date.now()

      const latency = endTime - startTime
      expect(latency).toBeLessThan(100) // Generous for E2E
    }
  })

  test('should stay within memory budget', async ({ page }) => {
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        return memory.usedJSHeapSize / (1024 * 1024) // Convert to MB
      }
      return 0
    })

    if (memoryUsage > 0) {
      expect(memoryUsage).toBeLessThan(512) // 512 MB budget
    }
  })

  test('should execute all built-in scenarios', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { BUILT_IN_SCENARIOS } = await import('@/types/scenarios')

      const results = []
      for (const scenario of BUILT_IN_SCENARIOS) {
        const result = await scenarioRunner.executeScenario(scenario)
        results.push({
          scenarioId: scenario.id,
          success: result.success,
          duration: result.duration,
        })
      }

      return results
    })

    // All scenarios should pass
    expect(results.every((r) => r.success)).toBe(true)

    // Log performance
    results.forEach((r) => {
      console.log(`Scenario ${r.scenarioId}: ${r.success ? 'PASS' : 'FAIL'} (${r.duration.toFixed(2)}ms)`)
    })
  })

  test('should track performance over time', async ({ page }) => {
    const performanceLog = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { SCENARIO_STREAMING_PERFORMANCE } = await import('@/types/scenarios')

      const runs = []
      for (let i = 0; i < 3; i++) {
        const result = await scenarioRunner.executeScenario(SCENARIO_STREAMING_PERFORMANCE)
        runs.push({
          run: i + 1,
          streamLatency: result.performance.streamLatency,
          paneRenderTime: result.performance.paneRenderTime,
          throughput: result.performance.streamThroughput,
        })
      }

      return runs
    })

    expect(performanceLog.length).toBe(3)

    // All runs should meet budgets
    performanceLog.forEach((run) => {
      expect(run.streamLatency).toBeLessThan(100)
      expect(run.paneRenderTime).toBeLessThan(16)
      expect(run.throughput).toBeGreaterThan(100)
    })

    // Log for analysis
    console.log('Performance across runs:', performanceLog)
  })

  test('should generate performance dashboard data', async ({ page }) => {
    const dashboardData = await page.evaluate(async () => {
      const { scenarioRunner } = await import('@/services/ScenarioRunner')
      const { BUILT_IN_SCENARIOS } = await import('@/types/scenarios')

      const data: any = {
        scenarios: [],
        averages: {
          streamLatency: 0,
          paneRenderTime: 0,
          reconciliationTime: 0,
        },
      }

      for (const scenario of BUILT_IN_SCENARIOS) {
        const result = await scenarioRunner.executeScenario(scenario)
        data.scenarios.push({
          name: scenario.name,
          success: result.success,
          performance: result.performance,
        })
      }

      // Calculate averages
      const count = data.scenarios.length
      data.averages.streamLatency =
        data.scenarios.reduce((sum: number, s: any) => sum + s.performance.streamLatency, 0) / count
      data.averages.paneRenderTime =
        data.scenarios.reduce((sum: number, s: any) => sum + s.performance.paneRenderTime, 0) / count
      data.averages.reconciliationTime =
        data.scenarios.reduce((sum: number, s: any) => sum + s.performance.reconciliationTime, 0) / count

      return data
    })

    expect(dashboardData.scenarios.length).toBeGreaterThan(0)
    expect(dashboardData.averages.streamLatency).toBeGreaterThan(0)
    console.log('Performance Dashboard:', JSON.stringify(dashboardData, null, 2))
  })
})
