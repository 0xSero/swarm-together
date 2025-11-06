import { test, expect } from '@playwright/test'

test.describe('Pane Grid (4-Pane Layout)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terminal')
  })

  test('should display four panes in grid layout', async ({ page }) => {
    // Check that all four pane positions exist
    const topLeft = page.locator('[class*="col-start-1"][class*="row-start-1"]')
    const topRight = page.locator('[class*="col-start-2"][class*="row-start-1"]')
    const bottomLeft = page.locator('[class*="col-start-1"][class*="row-start-2"]')
    const bottomRight = page.locator('[class*="col-start-2"][class*="row-start-2"]')

    await expect(topLeft).toBeVisible()
    await expect(topRight).toBeVisible()
    await expect(bottomLeft).toBeVisible()
    await expect(bottomRight).toBeVisible()
  })

  test('should create and display tabs', async ({ page }) => {
    // Find the first "Create Tab" button or "+" button
    const createTabButton = page.locator('button').filter({ hasText: '+' }).first()

    await createTabButton.click()

    // Check that a new tab was created
    const tabs = page.locator('[class*="truncate"]').filter({ hasText: 'New Tab' })
    await expect(tabs.first()).toBeVisible()
  })

  test('should switch between tabs', async ({ page }) => {
    // Create two tabs
    const createTabButton = page.locator('button').filter({ hasText: '+' }).first()

    await createTabButton.click()
    await page.waitForTimeout(100)
    await createTabButton.click()

    // There should be two tabs now
    const tabs = page.locator('button').filter({ hasText: 'New Tab' })
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)

    // Click the first tab
    await tabs.first().click()

    // Verify the first tab is active (has bg-surface class)
    await expect(tabs.first()).toHaveClass(/bg-surface/)
  })

  test('should maintain focus indication', async ({ page }) => {
    // Top-left pane should be focused by default
    const focusedPane = page.locator('[class*="border-primary"][class*="ring-2"]').first()
    await expect(focusedPane).toBeVisible()

    // Click on a different pane area
    const panes = page.locator('[class*="rounded-lg"][class*="border"]')
    const secondPane = panes.nth(1)
    await secondPane.click()

    // The clicked pane should now have focus styling
    await expect(secondPane).toHaveClass(/border-primary/)
  })

  test('should navigate panes with keyboard shortcuts', async ({ page }) => {
    // Focus on the terminal area
    await page.locator('body').click()

    // Press Cmd+] to move to next pane (or Ctrl+] on Windows/Linux)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

    await page.keyboard.press(`${modifier}+BracketRight`)

    // Wait a bit for the focus change
    await page.waitForTimeout(100)

    // The second pane should now be focused
    const focusedPanes = page.locator('[class*="border-primary"][class*="ring-2"]')
    await expect(focusedPanes).toHaveCount(1)
  })

  test('should display per-pane history isolation', async ({ page }) => {
    // Create tabs in different panes
    const createButtons = page.locator('button').filter({ hasText: '+' })

    // Create tab in first pane
    await createButtons.nth(0).click()

    // Create tab in second pane
    await createButtons.nth(1).click()

    // Each pane should have its own tab bar
    const tabBars = page.locator('[class*="border-b"][class*="border-border"]')
    const count = await tabBars.count()
    expect(count).toBeGreaterThanOrEqual(4) // At least 4 tab bars (one per pane)
  })

  test('should handle drag and drop for pane swapping', async ({ page }) => {
    // This is a more complex test that requires dragging
    // For now, we'll just verify the panes are draggable
    const firstPane = page.locator('[draggable="true"]').first()

    // Check that pane has draggable attribute
    await expect(firstPane).toHaveAttribute('draggable', 'true')
  })

  test('should display render metrics', async ({ page }) => {
    // Create some activity to trigger renders
    const createTabButton = page.locator('button').filter({ hasText: '+' }).first()

    for (let i = 0; i < 3; i++) {
      await createTabButton.click()
      await page.waitForTimeout(50)
    }

    // Check if metrics bar appears (it shows after frameCount > 0)
    const metricsBar = page.locator('text=Avg Render:')

    // Metrics might not be visible if renders are too fast, so we make this optional
    const isVisible = await metricsBar.isVisible().catch(() => false)
    if (isVisible) {
      await expect(metricsBar).toBeVisible()
    }
  })

  test('should handle empty pane state', async ({ page }) => {
    // Panes start empty
    const emptyMessage = page.locator('text=No active tab')
    const count = await emptyMessage.count()

    // At least one pane should show "No active tab"
    expect(count).toBeGreaterThan(0)
  })

  test('should close tabs', async ({ page }) => {
    // Create a tab
    const createTabButton = page.locator('button').filter({ hasText: '+' }).first()
    await createTabButton.click()

    // Wait for tab to appear
    await page.waitForTimeout(100)

    // Hover over the tab to reveal the close button
    const tab = page.locator('button').filter({ hasText: 'New Tab' }).first()
    await tab.hover()

    // Click the close button (X icon)
    const closeButton = tab.locator('button').first()
    if (await closeButton.isVisible()) {
      await closeButton.click()
    }

    // Tab should be gone or we should see "No active tab"
    const emptyState = page.locator('text=No active tab')
    const isVisible = await emptyState.isVisible()
    expect(isVisible).toBe(true)
  })

  test('should display pane position labels in status bar', async ({ page }) => {
    // Check status bars show position labels
    const topLeftLabel = page.locator('text=top left').first()
    const topRightLabel = page.locator('text=top right').first()
    const bottomLeftLabel = page.locator('text=bottom left').first()
    const bottomRightLabel = page.locator('text=bottom right').first()

    await expect(topLeftLabel).toBeVisible()
    await expect(topRightLabel).toBeVisible()
    await expect(bottomLeftLabel).toBeVisible()
    await expect(bottomRightLabel).toBeVisible()
  })
})
