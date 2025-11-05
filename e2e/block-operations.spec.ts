import { test, expect } from '@playwright/test'

test.describe('Block Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/terminal')

    // Create a tab and add some mock blocks
    const createTabButton = page.locator('button').filter({ hasText: '+' }).first()
    await createTabButton.click()

    // Wait for tab to be created
    await page.waitForTimeout(200)
  })

  test('should render blocks with proper styling', async ({ page }) => {
    // Mock adding a block by directly manipulating store (in real app, this would come from backend)
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-1',
          session_id: 'test-session',
          block_type: 'command',
          content: 'ls -la',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
        })
      }
    })

    // Wait for block to render
    await page.waitForTimeout(200)

    // Check that block is visible with command styling
    const commandBlock = page.locator('text=ls -la')
    await expect(commandBlock).toBeVisible()
  })

  test('should copy block content to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    // Add a block
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-copy',
          session_id: 'test-session',
          block_type: 'output',
          content: 'Test content to copy',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
        })
      }
    })

    await page.waitForTimeout(200)

    // Find and hover over the block to reveal action buttons
    const block = page.locator('text=Test content to copy').locator('..')
    await block.hover()

    // Click the copy button
    const copyButton = block.locator('button[title*="Copy"]')
    await copyButton.click()

    // Wait a bit for clipboard operation
    await page.waitForTimeout(100)

    // Verify copy button shows check mark
    const checkIcon = block.locator('svg.text-success')
    await expect(checkIcon).toBeVisible()

    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardContent).toContain('Test content to copy')
  })

  test('should toggle bookmark on block', async ({ page }) => {
    // Add a block
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-bookmark',
          session_id: 'test-session',
          block_type: 'output',
          content: 'Content to bookmark',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
        })
      }
    })

    await page.waitForTimeout(200)

    // Find the block
    const block = page.locator('text=Content to bookmark').locator('..')
    await block.hover()

    // Click bookmark button
    const bookmarkButton = block.locator('button[title*="bookmark"]')
    await bookmarkButton.click()

    // Wait for UI update
    await page.waitForTimeout(200)

    // Verify bookmark is now filled/active (has fill-warning class or similar)
    const bookmarkedIcon = block.locator('svg.fill-warning')
    await expect(bookmarkedIcon).toBeVisible()

    // Click again to remove bookmark
    await bookmarkButton.click()
    await page.waitForTimeout(200)

    // Icon should no longer be filled
    const unfilledIcon = block.locator('svg:not(.fill-warning)')
    await expect(unfilledIcon).toBeVisible()
  })

  test('should handle re-run command for command blocks', async ({ page }) => {
    // Add a command block
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-rerun',
          session_id: 'test-session',
          block_type: 'command',
          content: 'echo "Hello World"',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
        })
      }
    })

    await page.waitForTimeout(200)

    // Find the command block
    const block = page.locator('text=echo "Hello World"').locator('..')
    await block.hover()

    // Click re-run button
    const rerunButton = block.locator('button[title*="Re-run"]')
    await rerunButton.click()

    // In a real app, this would execute the command
    // For now, just verify the button exists and is clickable
    await expect(rerunButton).toBeVisible()
  })

  test('should display attachments when available', async ({ page }) => {
    // Add a block with attachments
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-attachments',
          session_id: 'test-session',
          block_type: 'output',
          content: 'Command output',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
          metadata: {
            attachments: [
              {
                id: 'attach-1',
                attachment_type: 'file',
                filename: 'test.txt',
                size_bytes: 1024,
                storage_path: '/tmp/test.txt',
                created_at: new Date().toISOString(),
              },
            ],
          },
        })
      }
    })

    await page.waitForTimeout(200)

    // Find the block
    const block = page.locator('text=Command output').locator('..')
    await block.hover()

    // Click attachment button to reveal attachments
    const attachmentButton = block.locator('button[title*="attachment"]')
    await attachmentButton.click()

    await page.waitForTimeout(200)

    // Verify attachment is displayed
    const attachment = page.locator('text=test.txt')
    await expect(attachment).toBeVisible()

    // Verify file size is shown
    const fileSize = page.locator('text=1.0 KB')
    await expect(fileSize).toBeVisible()
  })

  test('should open attachment preview', async ({ page }) => {
    // Add a block with image attachment
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-image',
          session_id: 'test-session',
          block_type: 'output',
          content: 'Screenshot captured',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
          metadata: {
            attachments: [
              {
                id: 'attach-img',
                attachment_type: 'image',
                filename: 'screenshot.png',
                size_bytes: 204800,
                storage_path: '/tmp/screenshot.png',
                created_at: new Date().toISOString(),
              },
            ],
          },
        })
      }
    })

    await page.waitForTimeout(200)

    // Show attachments
    const block = page.locator('text=Screenshot captured').locator('..')
    await block.hover()
    await block.locator('button[title*="attachment"]').click()

    await page.waitForTimeout(200)

    // Click on the attachment to open preview
    const attachment = page.locator('text=screenshot.png').locator('..')
    await attachment.click()

    await page.waitForTimeout(200)

    // Verify preview modal is opened
    const previewModal = page.locator('text=Attachment Preview')
    await expect(previewModal).toBeVisible()

    // Close preview
    const closeButton = page.locator('button').filter({ hasText: '×' })
    await closeButton.click()

    // Modal should be closed
    await expect(previewModal).not.toBeVisible()
  })

  test('should display block metadata (exit code, duration)', async ({ page }) => {
    // Add a block with metadata
    await page.evaluate(() => {
      const { usePaneStore } = window as any
      const store = usePaneStore.getState()
      const pane = store.panes['top-left']
      const activeTabId = pane.activeTabId

      if (activeTabId) {
        store.addToHistory('top-left', activeTabId, {
          id: 'block-metadata',
          session_id: 'test-session',
          block_type: 'command',
          content: 'npm test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sequence_number: 0,
          bookmarked: false,
          metadata: {
            exit_code: 0,
            duration_ms: 1234,
            working_dir: '/home/user/project',
          },
        })
      }
    })

    await page.waitForTimeout(200)

    // Find the block
    const block = page.locator('text=npm test').locator('..')

    // Verify exit code badge is shown
    const exitCodeBadge = block.locator('text=exit 0')
    await expect(exitCodeBadge).toBeVisible()

    // Verify duration is shown
    const duration = block.locator('text=1234ms')
    await expect(duration).toBeVisible()

    // Verify working directory is shown (in footer)
    const workingDir = block.locator('text=/home/user/project')
    await expect(workingDir).toBeVisible()
  })

  test('should handle different block types with appropriate styling', async ({ page }) => {
    const blockTypes = [
      { type: 'command', content: 'ls -la' },
      { type: 'output', content: 'file1.txt\nfile2.txt' },
      { type: 'error', content: 'Error: File not found' },
      { type: 'conversation', content: 'System message' },
    ]

    for (const blockType of blockTypes) {
      await page.evaluate((bt) => {
        const { usePaneStore } = window as any
        const store = usePaneStore.getState()
        const pane = store.panes['top-left']
        const activeTabId = pane.activeTabId

        if (activeTabId) {
          store.addToHistory('top-left', activeTabId, {
            id: `block-${bt.type}`,
            session_id: 'test-session',
            block_type: bt.type,
            content: bt.content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sequence_number: 0,
            bookmarked: false,
          })
        }
      }, blockType)
    }

    await page.waitForTimeout(200)

    // Verify all blocks are rendered
    for (const blockType of blockTypes) {
      const block = page.locator(`text=${blockType.content}`).first()
      await expect(block).toBeVisible()
    }
  })
})
