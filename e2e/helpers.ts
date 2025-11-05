import { spawn, ChildProcess } from 'child_process'
import { Page } from '@playwright/test'

/**
 * Helper utilities for Tauri E2E testing
 */

export interface TauriApp {
  process: ChildProcess
  cleanup: () => Promise<void>
}

/**
 * Launches the Tauri application in dev mode for testing.
 * Returns a cleanup function to terminate the app.
 */
export async function launchTauriApp(): Promise<TauriApp> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'tauri', 'dev'], {
      env: { ...process.env, TAURI_SKIP_DEVTOOLS: '1' },
      stdio: 'pipe',
    })

    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        proc.kill()
        reject(new Error('Tauri app failed to start within timeout'))
      }
    }, 60000)

    proc.stdout?.on('data', (data) => {
      const output = data.toString()
      // Look for the dev server ready signal
      if (output.includes('Dev server') || output.includes('http://localhost')) {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          resolve({
            process: proc,
            cleanup: async () => {
              proc.kill()
              await new Promise((r) => setTimeout(r, 1000))
            },
          })
        }
      }
    })

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeout)
        reject(err)
      }
    })
  })
}

/**
 * Waits for an element to be visible on the page.
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout = 10000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout })
}
