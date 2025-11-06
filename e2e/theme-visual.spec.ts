import { test, expect } from '@playwright/test'

test.describe('Theme Visual Regression - Task 130', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')
  })

  test('should render dark neumorphic theme correctly', async ({ page }) => {
    // Take full page screenshot
    await expect(page).toHaveScreenshot('dark-neumorphic-full.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should render buttons with neumorphic shadows', async ({ page }) => {
    // Create test buttons
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'theme-test'
      container.className = 'p-8 bg-surface space-y-4'
      container.innerHTML = `
        <button class="px-4 py-2 rounded-md bg-primary text-white shadow-neu-md hover:shadow-neu-lg">
          Primary Button
        </button>
        <button class="px-4 py-2 rounded-md bg-secondary text-white shadow-neu-md hover:shadow-neu-lg">
          Secondary Button
        </button>
        <button class="px-4 py-2 rounded-md bg-danger text-white shadow-neu-md hover:shadow-neu-lg">
          Danger Button
        </button>
      `
      document.body.appendChild(container)
    })

    await page.waitForTimeout(100)

    const container = page.locator('#theme-test')
    await expect(container).toHaveScreenshot('buttons-neumorphic.png')
  })

  test('should render cards with elevated surface', async ({ page }) => {
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'theme-test'
      container.className = 'p-8 bg-background space-y-4'
      container.innerHTML = `
        <div class="p-6 rounded-lg bg-surface shadow-neu-md">
          <h3 class="text-lg font-semibold text-text-high mb-2">Surface Card</h3>
          <p class="text-text-medium">Card content with medium text</p>
        </div>
        <div class="p-6 rounded-lg bg-elevated shadow-neu-lg">
          <h3 class="text-lg font-semibold text-text-high mb-2">Elevated Card</h3>
          <p class="text-text-medium">Card content with elevated background</p>
        </div>
      `
      document.body.appendChild(container)
    })

    await page.waitForTimeout(100)

    const container = page.locator('#theme-test')
    await expect(container).toHaveScreenshot('cards-neumorphic.png')
  })

  test('should render input fields with inset shadows', async ({ page }) => {
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'theme-test'
      container.className = 'p-8 bg-surface space-y-4'
      container.innerHTML = `
        <input
          type="text"
          placeholder="Text input"
          class="w-full px-3 py-2 bg-background border border-border rounded-md shadow-neu-inset text-text-high"
        />
        <textarea
          placeholder="Textarea"
          class="w-full px-3 py-2 bg-background border border-border rounded-md shadow-neu-inset text-text-high"
          rows="3"
        ></textarea>
      `
      document.body.appendChild(container)
    })

    await page.waitForTimeout(100)

    const container = page.locator('#theme-test')
    await expect(container).toHaveScreenshot('inputs-neumorphic.png')
  })

  test('should render semantic colors with proper contrast', async ({ page }) => {
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'theme-test'
      container.className = 'p-8 bg-surface space-y-3'
      container.innerHTML = `
        <div class="p-3 rounded-md bg-success/10 border border-success/20">
          <p class="text-success font-medium">Success message</p>
        </div>
        <div class="p-3 rounded-md bg-warning/10 border border-warning/20">
          <p class="text-warning font-medium">Warning message</p>
        </div>
        <div class="p-3 rounded-md bg-danger/10 border border-danger/20">
          <p class="text-danger font-medium">Danger message</p>
        </div>
        <div class="p-3 rounded-md bg-info/10 border border-info/20">
          <p class="text-info font-medium">Info message</p>
        </div>
      `
      document.body.appendChild(container)
    })

    await page.waitForTimeout(100)

    const container = page.locator('#theme-test')
    await expect(container).toHaveScreenshot('semantic-colors.png')
  })

  test('should render text hierarchy', async ({ page }) => {
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'theme-test'
      container.className = 'p-8 bg-surface space-y-2'
      container.innerHTML = `
        <p class="text-text-high text-lg">High emphasis text</p>
        <p class="text-text-medium">Medium emphasis text</p>
        <p class="text-text-low">Low emphasis text</p>
        <p class="text-text-muted text-sm">Muted text</p>
      `
      document.body.appendChild(container)
    })

    await page.waitForTimeout(100)

    const container = page.locator('#theme-test')
    await expect(container).toHaveScreenshot('text-hierarchy.png')
  })

  test('should render glow effects on hover', async ({ page }) => {
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'theme-test'
      container.className = 'p-8 bg-surface flex gap-4'
      container.innerHTML = `
        <button class="px-4 py-2 rounded-md bg-primary text-white shadow-neu-md hover:shadow-glow-primary">
          Hover me
        </button>
      `
      document.body.appendChild(container)
    })

    const button = page.locator('#theme-test button')
    await button.hover()
    await page.waitForTimeout(200)

    const container = page.locator('#theme-test')
    await expect(container).toHaveScreenshot('glow-hover.png')
  })

  test('should render terminal pane with theme', async ({ page }) => {
    // Navigate to terminal page
    await page.goto('http://localhost:1420/terminal')
    await page.waitForLoadState('networkidle')

    await page.waitForTimeout(500)

    // Take screenshot of terminal
    await expect(page).toHaveScreenshot('terminal-themed.png', {
      fullPage: true,
      animations: 'disabled',
    })
  })

  test('should render command palette with theme', async ({ page }) => {
    // Open command palette (Cmd+K)
    await page.keyboard.press('Meta+K')
    await page.waitForTimeout(200)

    // Verify palette is visible
    await expect(page.getByPlaceholder(/command/i)).toBeVisible()

    // Take screenshot
    await expect(page).toHaveScreenshot('command-palette-themed.png', {
      animations: 'disabled',
    })
  })

  test('should render debug panel with theme', async ({ page }) => {
    // Open debug panel (Ctrl+Shift+D)
    await page.keyboard.press('Control+Shift+D')
    await page.waitForTimeout(200)

    // Verify panel is visible
    await expect(page.getByText('Debug Panel')).toBeVisible()

    // Take screenshot
    await expect(page).toHaveScreenshot('debug-panel-themed.png', {
      animations: 'disabled',
    })
  })

  test('should render token HUD with theme', async ({ page }) => {
    await page.goto('http://localhost:1420/terminal')
    await page.waitForLoadState('networkidle')

    // Wait for HUD to appear
    await page.waitForTimeout(500)

    // Find HUD
    const hud = page.locator('[class*="fixed"][class*="bottom"]').first()
    if ((await hud.count()) > 0) {
      await expect(hud).toHaveScreenshot('token-hud-themed.png')
    }
  })
})

test.describe('Theme Contrast Checks', () => {
  test('should verify WCAG contrast ratios', async ({ page }) => {
    await page.goto('http://localhost:1420')
    await page.waitForLoadState('networkidle')

    // Check contrast programmatically
    const contrastResults = await page.evaluate(() => {
      const { darkNeumorphicTheme, validateThemeContrast } =
        require('@/types/theme') as typeof import('@/types/theme')

      return validateThemeContrast(darkNeumorphicTheme)
    })

    // Log results
    console.log('Contrast check results:')
    contrastResults.forEach((result) => {
      console.log(`  ${result.pair}: ${result.ratio}:1 (${result.level}) - ${result.passes ? 'PASS' : 'FAIL'}`)
    })

    // Verify all critical pairs pass
    const failures = contrastResults.filter((r) => !r.passes)
    expect(failures.length).toBe(0)
  })

  test('should verify text-high contrast on all backgrounds', async ({ page }) => {
    await page.goto('http://localhost:1420')

    const checks = await page.evaluate(() => {
      const { darkNeumorphicTheme, checkContrast } =
        require('@/types/theme') as typeof import('@/types/theme')

      const textHigh = darkNeumorphicTheme.colors.text.high
      return [
        {
          name: 'background',
          result: checkContrast(textHigh, darkNeumorphicTheme.colors.background),
        },
        {
          name: 'surface',
          result: checkContrast(textHigh, darkNeumorphicTheme.colors.surface),
        },
        {
          name: 'elevated',
          result: checkContrast(textHigh, darkNeumorphicTheme.colors.elevated),
        },
      ]
    })

    checks.forEach((check) => {
      console.log(`text-high on ${check.name}: ${check.result.ratio}:1 (${check.result.level})`)
      expect(check.result.passes).toBe(true)
    })
  })

  test('should verify semantic colors are distinguishable', async ({ page }) => {
    await page.goto('http://localhost:1420')

    const checks = await page.evaluate(() => {
      const { darkNeumorphicTheme, checkContrast } =
        require('@/types/theme') as typeof import('@/types/theme')

      const bg = darkNeumorphicTheme.colors.background
      return [
        {
          name: 'success',
          result: checkContrast(darkNeumorphicTheme.colors.success.DEFAULT, bg),
        },
        {
          name: 'warning',
          result: checkContrast(darkNeumorphicTheme.colors.warning.DEFAULT, bg),
        },
        {
          name: 'danger',
          result: checkContrast(darkNeumorphicTheme.colors.danger.DEFAULT, bg),
        },
      ]
    })

    checks.forEach((check) => {
      console.log(`${check.name} on background: ${check.result.ratio}:1`)
      // Semantic colors should have at least 3:1 contrast for visibility
      expect(check.result.ratio).toBeGreaterThan(3)
    })
  })
})
