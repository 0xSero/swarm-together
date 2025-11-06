import { test, expect } from '@playwright/test'

test.describe('Token Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terminal')
  })

  test('should display TokenHUD', async ({ page }) => {
    // TokenHUD should be visible at the bottom
    const hud = page.locator('text=Token Usage')
    await expect(hud).toBeVisible()
  })

  test('should show zero usage initially', async ({ page }) => {
    // Check for 0 tokens display
    const tokenDisplay = page.locator('text=/0.*tokens/')
    await expect(tokenDisplay).toBeVisible()
  })

  test('should expand HUD to show details', async ({ page }) => {
    // Click to expand HUD
    const expandButton = page.locator('text=Token Usage')
    await expandButton.click()

    await page.waitForTimeout(200)

    // Should show breakdown sections
    await expect(page.locator('text=By Provider')).toBeVisible()
    await expect(page.locator('text=By Level')).toBeVisible()
    await expect(page.locator('text=Cost Breakdown')).toBeVisible()
    await expect(page.locator('text=Statistics')).toBeVisible()
  })

  test('should update in real-time (simulated)', async ({ page }) => {
    // Simulate token usage
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      // Record some usage
      service.recordUsage(
        'message',
        'test-msg-1',
        100,
        50,
        'claude-code',
        'claude-sonnet-4'
      )
    })

    // Wait for UI to update
    await page.waitForTimeout(1500)

    // Should show non-zero usage
    const tokenDisplay = page.locator('text=/[1-9].*tokens/')
    await expect(tokenDisplay).toBeVisible()
  })

  test('should display provider pills', async ({ page }) => {
    // Add usage for multiple providers
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')
      service.recordUsage('message', 'msg-3', 150, 75, 'ollama')
    })

    await page.waitForTimeout(1500)

    // Should show provider pills
    const claudePill = page.locator('text=claude-code')
    const codexPill = page.locator('text=codex')
    const ollamaPill = page.locator('text=ollama')

    await expect(claudePill).toBeVisible()
    await expect(codexPill).toBeVisible()
    await expect(ollamaPill).toBeVisible()
  })

  test('should show cost when available', async ({ page }) => {
    // Add usage with cost
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      service.recordUsage('message', 'msg-1', 1_000_000, 500_000, 'claude-code', 'claude-sonnet-4')
    })

    await page.waitForTimeout(1500)

    // Should display cost
    const cost = page.locator('text=/\\$[0-9.]+/')
    await expect(cost).toBeVisible()
  })

  test('should display estimated usage warning', async ({ page }) => {
    // Add estimated usage
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code', 'claude-sonnet-4', true)
    })

    await page.waitForTimeout(1500)

    // Should show estimated indicator
    const estimated = page.locator('text=/[0-9]+ estimated/')
    await expect(estimated).toBeVisible()
  })

  test('should handle reconciliation', async ({ page }) => {
    // Add estimated usage and reconcile
    const meterId = await page.evaluate(async () => {
      const { getTokenService } = window as any
      const service = getTokenService()

      const meter = service.recordUsage(
        'message',
        'msg-1',
        100,
        50,
        'claude-code',
        'claude-sonnet-4',
        true // estimated
      )

      // Reconcile with actual usage
      await service.reconcileUsage(meter.id, 110, 55)

      return meter.id
    })

    await page.waitForTimeout(1500)

    // Estimated count should be 0 after reconciliation
    const estimated = page.locator('text=/[1-9]+ estimated/')
    await expect(estimated).not.toBeVisible()
  })

  test('should show aggregation by level', async ({ page }) => {
    // Add usage at different levels
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('session', 'session-1', 200, 100, 'claude-code')
      service.recordUsage('pane', 'pane-1', 150, 75, 'codex')
    })

    await page.waitForTimeout(1500)

    // Expand HUD
    await page.locator('text=Token Usage').click()
    await page.waitForTimeout(200)

    // Check level breakdown
    const messageLevel = page.locator('text=message').first()
    const sessionLevel = page.locator('text=session').first()
    const paneLevel = page.locator('text=pane').first()

    await expect(messageLevel).toBeVisible()
    await expect(sessionLevel).toBeVisible()
    await expect(paneLevel).toBeVisible()
  })

  test('should handle counter reset', async ({ page }) => {
    // Add some usage
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      service.recordUsage('message', 'msg-1', 100, 50, 'claude-code')
      service.recordUsage('message', 'msg-2', 200, 100, 'codex')
    })

    await page.waitForTimeout(1500)

    // Verify non-zero
    let tokenDisplay = page.locator('text=/[1-9].*tokens/')
    await expect(tokenDisplay).toBeVisible()

    // Reset
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()
      service.reset()
    })

    await page.waitForTimeout(1500)

    // Should show zero again
    tokenDisplay = page.locator('text=/0.*tokens/')
    await expect(tokenDisplay).toBeVisible()
  })

  test('should display request count', async ({ page }) => {
    // Add multiple requests
    await page.evaluate(() => {
      const { getTokenService } = window as any
      const service = getTokenService()

      for (let i = 0; i < 5; i++) {
        service.recordUsage('message', `msg-${i}`, 100, 50, 'claude-code')
      }
    })

    await page.waitForTimeout(1500)

    // Should show 5 requests
    const requests = page.locator('text=/5 requests/')
    await expect(requests).toBeVisible()
  })
})
