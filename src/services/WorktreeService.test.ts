import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorktreeService } from './WorktreeService'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

describe('WorktreeService Integration Tests', () => {
  let service: WorktreeService
  let sandboxPath: string

  beforeEach(async () => {
    // Create sandbox repository
    sandboxPath = path.join(os.tmpdir(), `worktree-test-${Date.now()}`)
    await fs.mkdir(sandboxPath, { recursive: true })

    // Initialize git repo
    await execAsync('git init', { cwd: sandboxPath })
    await execAsync('git config user.name "Test User"', { cwd: sandboxPath })
    await execAsync('git config user.email "test@example.com"', { cwd: sandboxPath })

    // Create initial commit
    await fs.writeFile(path.join(sandboxPath, 'README.md'), '# Test Repo')
    await execAsync('git add README.md', { cwd: sandboxPath })
    await execAsync('git commit -m "Initial commit"', { cwd: sandboxPath })

    service = new WorktreeService(sandboxPath)
  })

  afterEach(async () => {
    // Clean up sandbox
    try {
      await fs.rm(sandboxPath, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('list', () => {
    it('should list main worktree', async () => {
      const info = await service.list()

      expect(info.count).toBeGreaterThanOrEqual(1)
      expect(info.mainWorktree).toBeDefined()
      expect(info.worktrees[0].path).toBe(sandboxPath)
    })
  })

  describe('add', () => {
    it('should add a new worktree', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'feature1')

      const worktree = await service.add(worktreePath, 'HEAD', {
        branch: 'feature1',
        newBranch: true,
      })

      expect(worktree.path).toContain('feature1')
      expect(worktree.branch).toContain('feature1')

      // Verify worktree exists
      const info = await service.list()
      expect(info.count).toBe(2)
    })

    it('should reject invalid branch name', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'test')

      await expect(
        service.add(worktreePath, 'HEAD', {
          branch: 'invalid branch name',
          newBranch: true,
        })
      ).rejects.toThrow('Invalid branch name')

      const metrics = service.getMetrics()
      expect(metrics.safetyRefusals).toBe(1)
    })

    it('should reject invalid path', async () => {
      await expect(
        service.add('../../etc/passwd', 'HEAD')
      ).rejects.toThrow('Invalid worktree path')
    })
  })

  describe('checkSafety', () => {
    it('should pass safety check for clean worktree', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'clean')
      await service.add(worktreePath, 'HEAD', { branch: 'clean', newBranch: true })

      const safety = await service.checkSafety(worktreePath)

      expect(safety.canRemoveSafely).toBe(true)
      expect(safety.warnings).toHaveLength(0)
    })

    it('should fail safety check with uncommitted changes', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'dirty')
      await service.add(worktreePath, 'HEAD', { branch: 'dirty', newBranch: true })

      // Make changes
      await fs.writeFile(path.join(worktreePath, 'test.txt'), 'test')

      const safety = await service.checkSafety(worktreePath)

      expect(safety.canRemoveSafely).toBe(false)
      expect(safety.hasUntrackedFiles).toBe(true)
      expect(safety.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('getDiff', () => {
    it('should show diff for modified worktree', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'diff-test')
      await service.add(worktreePath, 'HEAD', { branch: 'diff-test', newBranch: true })

      // Make changes
      await fs.writeFile(path.join(worktreePath, 'README.md'), '# Modified')
      await execAsync('git add README.md', { cwd: worktreePath })

      const diff = await service.getDiff(worktreePath)

      expect(diff.modified).toBeGreaterThan(0)
    })
  })

  describe('remove', () => {
    it('should remove clean worktree', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'removable')
      await service.add(worktreePath, 'HEAD', { branch: 'removable', newBranch: true })

      await service.remove(worktreePath)

      const info = await service.list()
      expect(info.count).toBe(1)
    })

    it('should refuse to remove dirty worktree without force', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'dirty')
      await service.add(worktreePath, 'HEAD', { branch: 'dirty', newBranch: true })

      // Make changes
      await fs.writeFile(path.join(worktreePath, 'test.txt'), 'test')

      await expect(service.remove(worktreePath)).rejects.toThrow(
        'Cannot safely remove'
      )

      const metrics = service.getMetrics()
      expect(metrics.safetyRefusals).toBe(1)
    })

    it('should force remove dirty worktree', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'force-remove')
      await service.add(worktreePath, 'HEAD', { branch: 'force-remove', newBranch: true })

      // Make changes
      await fs.writeFile(path.join(worktreePath, 'test.txt'), 'test')

      await service.remove(worktreePath, { force: true })

      const info = await service.list()
      expect(info.count).toBe(1)
    })
  })

  describe('lock and unlock', () => {
    it('should lock and unlock worktree', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'lockable')
      await service.add(worktreePath, 'HEAD', { branch: 'lockable', newBranch: true })

      await service.lock(worktreePath, 'Testing lock')

      let info = await service.list()
      const locked = info.worktrees.find((w) => w.path.includes('lockable'))
      expect(locked?.locked).toBe(true)

      await service.unlock(worktreePath)

      info = await service.list()
      const unlocked = info.worktrees.find((w) => w.path.includes('lockable'))
      expect(unlocked?.locked).toBeUndefined()
    })
  })

  describe('prune', () => {
    it('should prune without errors', async () => {
      await expect(service.prune()).resolves.not.toThrow()
    })
  })

  describe('metrics', () => {
    it('should track operations', async () => {
      const worktreePath = path.join(sandboxPath, 'worktrees', 'metrics-test')

      await service.add(worktreePath, 'HEAD', { branch: 'metrics-test', newBranch: true })
      await service.list()
      await service.remove(worktreePath, { force: true })

      const metrics = service.getMetrics()

      expect(metrics.totalOperations).toBeGreaterThanOrEqual(3)
      expect(metrics.successfulOperations).toBeGreaterThan(0)
      expect(metrics.operationsByType).toHaveProperty('add')
      expect(metrics.operationsByType).toHaveProperty('list')
      expect(metrics.operationsByType).toHaveProperty('remove')
      expect(metrics.lastOperation).toBeDefined()
    })

    it('should track failed operations', async () => {
      try {
        await service.add('/invalid/path', 'HEAD')
      } catch {
        // Expected to fail
      }

      const metrics = service.getMetrics()
      expect(metrics.failedOperations).toBeGreaterThan(0)
    })

    it('should reset metrics', () => {
      service.resetMetrics()

      const metrics = service.getMetrics()
      expect(metrics.totalOperations).toBe(0)
      expect(metrics.safetyRefusals).toBe(0)
    })
  })
})
