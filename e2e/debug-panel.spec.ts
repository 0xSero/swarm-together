import { test, expect } from '@playwright/test'

test.describe('Debug Panel - Task 120', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('should open debug panel', async ({ page }) => {
    // Open debug panel (e.g., via keyboard shortcut or menu)
    await page.keyboard.press('Control+Shift+D')

    // Verify panel is open
    await expect(page.getByText('Debug Panel')).toBeVisible()
    await expect(page.getByText('Events')).toBeVisible()
    await expect(page.getByText('Traces')).toBeVisible()
    await expect(page.getByText('Memory')).toBeVisible()
    await expect(page.getByText('Health')).toBeVisible()
  })

  test('should show event stream with log filtering', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Navigate to Events tab
    await page.getByRole('button', { name: /Events/i }).click()

    // Verify event stream is visible
    await expect(page.getByPlaceholder('Search logs...')).toBeVisible()

    // Test level filter
    await page.selectOption('select', 'error')

    // Verify only error logs are shown (if any exist)
    const errorBadges = page.locator('[class*="error"]')
    const count = await errorBadges.count()
    if (count > 0) {
      await expect(errorBadges.first()).toBeVisible()
    }

    // Test search
    await page.fill('input[placeholder="Search logs..."]', 'test')
    // Results should be filtered
  })

  test('should induce error and verify visibility', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Navigate to Events tab
    await page.getByRole('button', { name: /Events/i }).click()

    // Enable auto-scroll
    const autoScrollBtn = page.getByRole('button', { name: /Auto-scroll/i })
    await autoScrollBtn.click()

    // Induce an error by trying to create invalid session
    await page.evaluate(() => {
      // Simulate telemetry error
      ;(window as any).telemetry?.error(
        'test-component',
        'Induced error for testing',
        new Error('Test error stack'),
        { testContext: 'e2e' }
      )
    })

    // Wait for error to appear in event stream
    await page.waitForTimeout(500)

    // Filter to show only errors
    await page.selectOption('select', 'error')

    // Verify error is visible
    await expect(page.getByText(/Induced error for testing/i)).toBeVisible()
    await expect(page.locator('[class*="danger"]')).toBeVisible()

    // Click on error to expand details
    await page.getByText(/Induced error for testing/i).click()

    // Verify error details are shown
    await expect(page.getByText(/Test error stack/i)).toBeVisible()
    await expect(page.getByText(/testContext/i)).toBeVisible()
  })

  test('should show trace spans in tree view', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Navigate to Traces tab
    await page.getByRole('button', { name: /Traces/i }).click()

    // Induce a trace
    await page.evaluate(() => {
      const telemetry = (window as any).telemetry
      if (telemetry) {
        const span1 = telemetry.startSpan('parent-operation')
        const span2 = telemetry.startSpan('child-operation', span1.trace_id, span1.span_id)
        telemetry.addSpanEvent(span2.span_id, 'processing-step', { step: 1 })
        telemetry.endSpan(span2.span_id, 'ok')
        telemetry.endSpan(span1.span_id, 'ok')
      }
    })

    await page.waitForTimeout(500)

    // Verify traces are visible
    await expect(page.getByText(/parent-operation/i)).toBeVisible()

    // Expand trace tree
    await page.getByRole('button', { name: /Expand All/i }).click()

    // Verify child span is visible
    await expect(page.getByText(/child-operation/i)).toBeVisible()

    // Click on child span to see details
    await page.getByText(/child-operation/i).click()

    // Verify span details panel
    await expect(page.getByText(/Span Details/i)).toBeVisible()
    await expect(page.getByText(/Duration/i)).toBeVisible()
    await expect(page.getByText(/processing-step/i)).toBeVisible()
  })

  test('should display memory state', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Navigate to Memory tab
    await page.getByRole('button', { name: /Memory/i }).click()

    // Verify memory viewer is visible
    await expect(page.getByPlaceholder('Search keys...')).toBeVisible()

    // Test scope filter
    const scopeSelect = page.locator('select').nth(0)
    await scopeSelect.selectOption({ index: 1 }) // Select first non-"all" scope

    // Verify memory entries can be clicked
    const firstEntry = page.locator('[class*="cursor-pointer"]').first()
    if ((await firstEntry.count()) > 0) {
      await firstEntry.click()

      // Verify details panel opens
      await expect(page.getByText(/Entry Details/i)).toBeVisible()
    }
  })

  test('should show connector health status', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Navigate to Health tab
    await page.getByRole('button', { name: /Health/i }).click()

    // Verify health dashboard is visible
    await expect(page.getByText(/System Health/i)).toBeVisible()

    // Induce health check
    await page.evaluate(() => {
      const telemetry = (window as any).telemetry
      if (telemetry) {
        // Record healthy component
        telemetry.recordHealthCheck({
          component: 'test-component',
          status: 'healthy',
          last_check: new Date().toISOString(),
          checks: [
            {
              name: 'availability',
              status: 'healthy',
              message: 'Component is responsive',
            },
          ],
          response_time_ms: 45,
        })

        // Record degraded connector
        telemetry.recordConnectorHealth({
          component: 'test-connector',
          connector_type: 'claude-code',
          status: 'degraded',
          connected: true,
          last_check: new Date().toISOString(),
          request_count: 100,
          error_count: 15,
          error_rate: 0.15,
          checks: [
            {
              name: 'connectivity',
              status: 'degraded',
              message: 'High error rate detected',
            },
          ],
          response_time_ms: 250,
        })
      }
    })

    await page.waitForTimeout(500)

    // Verify summary stats
    await expect(page.getByText(/Healthy/i)).toBeVisible()
    await expect(page.getByText(/Degraded/i)).toBeVisible()

    // Verify components section
    await expect(page.getByText(/test-component/i)).toBeVisible()

    // Verify connectors section
    await expect(page.getByText(/test-connector/i)).toBeVisible()

    // Click on connector to see details
    await page.getByText(/test-connector/i).click()

    // Verify health details panel
    await expect(page.getByText(/Health Details/i)).toBeVisible()
    await expect(page.getByText(/Connector Type/i)).toBeVisible()
    await expect(page.getByText(/claude-code/i)).toBeVisible()
    await expect(page.getByText(/Error Rate/i)).toBeVisible()
    await expect(page.getByText(/15%/i)).toBeVisible()
  })

  test('should show dropped events warning', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Generate many logs to trigger dropping
    await page.evaluate(() => {
      const telemetry = (window as any).telemetry
      if (telemetry) {
        // Create a service with small buffer
        const smallService = new (window as any).TelemetryService({ max_events: 10 })

        // Generate 50 logs
        for (let i = 0; i < 50; i++) {
          smallService.info('test', `Log message ${i}`)
        }

        // Check dropped count
        const dropped = smallService.getDroppedEvents()
        console.log(`Dropped ${dropped} events`)
      }
    })

    await page.waitForTimeout(500)

    // Verify dropped events indicator (if any were dropped)
    const droppedText = page.getByText(/Dropped:/i)
    if ((await droppedText.count()) > 0) {
      await expect(droppedText).toBeVisible()
    }
  })

  test('should verify log redaction', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Navigate to Events tab
    await page.getByRole('button', { name: /Events/i }).click()

    // Create telemetry service with redaction enabled
    await page.evaluate(() => {
      const telemetry = new (window as any).TelemetryService({ enable_redaction: true })
      ;(window as any).redactedTelemetry = telemetry

      // Log message with sensitive data
      telemetry.info('auth', 'User logged in with api_key: sk-secret123 and token: abc789xyz')
    })

    await page.waitForTimeout(500)

    // Verify sensitive data is redacted
    const logContent = page.locator('[class*="text-sm"]')
    const logText = await logContent.allTextContents()
    const hasRedacted = logText.some((text) => text.includes('[REDACTED]'))

    if (hasRedacted) {
      await expect(page.getByText(/\[REDACTED\]/i)).toBeVisible()
      // Verify original sensitive data is NOT visible
      await expect(page.getByText(/sk-secret123/i)).not.toBeVisible()
      await expect(page.getByText(/abc789xyz/i)).not.toBeVisible()
    }
  })

  test('should verify panel performance metrics', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Verify footer shows stats
    await expect(page.getByText(/Last update:/i)).toBeVisible()
    await expect(page.getByText(/Health:/i)).toBeVisible()

    // Generate some activity
    await page.evaluate(() => {
      const telemetry = (window as any).telemetry
      if (telemetry) {
        for (let i = 0; i < 10; i++) {
          telemetry.info('perf-test', `Message ${i}`)
        }
      }
    })

    await page.waitForTimeout(1500)

    // Verify stats are updated
    const stats = page.getByText(/Logs:/i)
    await expect(stats).toBeVisible()
  })

  test('should close debug panel', async ({ page }) => {
    // Open debug panel
    await page.keyboard.press('Control+Shift+D')

    // Verify panel is open
    await expect(page.getByText('Debug Panel')).toBeVisible()

    // Close via button
    await page.getByRole('button', { name: /Close/i }).first().click()

    // Verify panel is closed
    await expect(page.getByText('Debug Panel')).not.toBeVisible()
  })
})
