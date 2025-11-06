import { exec } from 'child_process'
import { promisify } from 'util'
import type {
  Worktree,
  WorktreeInfo,
  WorktreeAddOptions,
  WorktreeRemoveOptions,
  WorktreeSafetyCheck,
  WorktreeDiff,
  WorktreeOperation,
  WorktreeMetrics,
} from '@/types/worktree'
import {
  isValidWorktreePath,
  isValidBranchName,
  parseWorktreeList,
} from '@/types/worktree'

const execAsync = promisify(exec)

export class WorktreeService {
  private repoPath: string
  private operations: WorktreeOperation[] = []
  private safetyRefusals: number = 0

  constructor(repoPath: string) {
    this.repoPath = repoPath
  }

  /**
   * List all worktrees
   */
  async list(): Promise<WorktreeInfo> {
    const startTime = Date.now()

    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: this.repoPath,
      })

      const worktrees = parseWorktreeList(stdout)
      const mainWorktree = worktrees.find((w) => !w.branch || w.branch.includes('main') || w.branch.includes('master'))

      const operation: WorktreeOperation = {
        operation: 'list',
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)

      return {
        worktrees,
        mainWorktree: mainWorktree || worktrees[0] || null,
        count: worktrees.length,
      }
    } catch (error) {
      const operation: WorktreeOperation = {
        operation: 'list',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
      throw error
    }
  }

  /**
   * Add a new worktree
   */
  async add(
    path: string,
    commitish?: string,
    options: WorktreeAddOptions = {}
  ): Promise<Worktree> {
    const startTime = Date.now()

    // Validate path
    const pathValidation = isValidWorktreePath(path)
    if (!pathValidation.valid) {
      this.safetyRefusals++
      throw new Error(`Invalid worktree path: ${pathValidation.reason}`)
    }

    // Validate branch if provided
    if (options.branch) {
      const branchValidation = isValidBranchName(options.branch)
      if (!branchValidation.valid) {
        this.safetyRefusals++
        throw new Error(`Invalid branch name: ${branchValidation.reason}`)
      }
    }

    try {
      const args = ['git', 'worktree', 'add']

      if (options.force) args.push('--force')
      if (options.detach) args.push('--detach')
      if (options.checkout === false) args.push('--no-checkout')
      if (options.lock) args.push('--lock')
      if (options.lockReason) args.push('--reason', `"${options.lockReason}"`)
      if (options.newBranch && options.branch) {
        args.push('-b', options.branch)
      } else if (options.branch) {
        args.push('-B', options.branch)
      }

      args.push(path)
      if (commitish) args.push(commitish)

      const command = args.join(' ')
      await execAsync(command, { cwd: this.repoPath })

      // Get worktree info
      const info = await this.list()
      const worktree = info.worktrees.find((w) => w.path.includes(path))

      if (!worktree) {
        throw new Error('Failed to create worktree')
      }

      const operation: WorktreeOperation = {
        operation: 'add',
        path,
        branch: options.branch || commitish,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)

      return worktree
    } catch (error) {
      const operation: WorktreeOperation = {
        operation: 'add',
        path,
        branch: options.branch,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
      throw error
    }
  }

  /**
   * Check if worktree can be safely removed
   */
  async checkSafety(path: string): Promise<WorktreeSafetyCheck> {
    try {
      // Check for uncommitted changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: path,
      })

      const hasUntrackedFiles = statusOutput.includes('??')
      const hasStagedChanges = /^[MADRC]/m.test(statusOutput)
      const hasUncommittedChanges = statusOutput.trim().length > 0

      // Check if branch is up to date with remote
      let branchUpToDate = true
      try {
        const { stdout: revListOutput } = await execAsync(
          'git rev-list --count @{u}..HEAD',
          { cwd: path }
        )
        branchUpToDate = revListOutput.trim() === '0'
      } catch {
        // If remote doesn't exist, consider it up to date
        branchUpToDate = true
      }

      const warnings: string[] = []
      if (hasUncommittedChanges) warnings.push('Has uncommitted changes')
      if (hasUntrackedFiles) warnings.push('Has untracked files')
      if (hasStagedChanges) warnings.push('Has staged changes')
      if (!branchUpToDate) warnings.push('Branch has unpushed commits')

      const canRemoveSafely = warnings.length === 0

      return {
        hasUncommittedChanges,
        hasUntrackedFiles,
        hasStagedChanges,
        branchUpToDate,
        canRemoveSafely,
        warnings,
      }
    } catch (error) {
      return {
        hasUncommittedChanges: false,
        hasUntrackedFiles: false,
        hasStagedChanges: false,
        branchUpToDate: true,
        canRemoveSafely: true,
        warnings: ['Unable to check status'],
      }
    }
  }

  /**
   * Get diff preview before removing
   */
  async getDiff(path: string): Promise<WorktreeDiff> {
    try {
      const { stdout: diffStat } = await execAsync('git diff --stat', {
        cwd: path,
      })

      const { stdout: diffOutput } = await execAsync('git diff', {
        cwd: path,
      })

      const files: WorktreeDiff['files'] = []
      let added = 0
      let deleted = 0
      let modified = 0

      // Parse diff stat
      const statLines = diffStat.split('\n')
      for (const line of statLines) {
        if (line.includes('|')) {
          const match = line.match(/^\s*(.+?)\s+\|/)
          if (match) {
            const filePath = match[1].trim()
            const status: 'added' | 'deleted' | 'modified' = line.includes('+')
              ? 'added'
              : line.includes('-')
              ? 'deleted'
              : 'modified'

            if (status === 'added') added++
            else if (status === 'deleted') deleted++
            else modified++

            files.push({
              path: filePath,
              status,
              changes: line,
            })
          }
        }
      }

      return {
        path,
        added,
        deleted,
        modified,
        files,
      }
    } catch (error) {
      return {
        path,
        added: 0,
        deleted: 0,
        modified: 0,
        files: [],
      }
    }
  }

  /**
   * Remove a worktree
   */
  async remove(path: string, options: WorktreeRemoveOptions = {}): Promise<void> {
    const startTime = Date.now()

    // Safety check unless force is specified
    if (!options.force) {
      const safety = await this.checkSafety(path)
      if (!safety.canRemoveSafely) {
        this.safetyRefusals++
        throw new Error(
          `Cannot safely remove worktree: ${safety.warnings.join(', ')}. Use force option to override.`
        )
      }
    }

    // Preview diff if requested
    if (options.preview) {
      const diff = await this.getDiff(path)
      if (diff.files.length > 0) {
        throw new Error(
          `Worktree has ${diff.modified + diff.added + diff.deleted} changed files. Review diff before removing.`
        )
      }
    }

    try {
      const args = ['git', 'worktree', 'remove']
      if (options.force) args.push('--force')
      args.push(path)

      const command = args.join(' ')
      await execAsync(command, { cwd: this.repoPath })

      const operation: WorktreeOperation = {
        operation: 'remove',
        path,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
    } catch (error) {
      const operation: WorktreeOperation = {
        operation: 'remove',
        path,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
      throw error
    }
  }

  /**
   * Lock a worktree
   */
  async lock(path: string, reason?: string): Promise<void> {
    const startTime = Date.now()

    try {
      const args = ['git', 'worktree', 'lock']
      if (reason) args.push('--reason', `"${reason}"`)
      args.push(path)

      const command = args.join(' ')
      await execAsync(command, { cwd: this.repoPath })

      const operation: WorktreeOperation = {
        operation: 'lock',
        path,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
    } catch (error) {
      const operation: WorktreeOperation = {
        operation: 'lock',
        path,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
      throw error
    }
  }

  /**
   * Unlock a worktree
   */
  async unlock(path: string): Promise<void> {
    const startTime = Date.now()

    try {
      await execAsync(`git worktree unlock ${path}`, { cwd: this.repoPath })

      const operation: WorktreeOperation = {
        operation: 'unlock',
        path,
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
    } catch (error) {
      const operation: WorktreeOperation = {
        operation: 'unlock',
        path,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
      throw error
    }
  }

  /**
   * Prune stale worktree administrative files
   */
  async prune(): Promise<void> {
    const startTime = Date.now()

    try {
      await execAsync('git worktree prune', { cwd: this.repoPath })

      const operation: WorktreeOperation = {
        operation: 'prune',
        duration: Date.now() - startTime,
        success: true,
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
    } catch (error) {
      const operation: WorktreeOperation = {
        operation: 'prune',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }
      this.operations.push(operation)
      throw error
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): WorktreeMetrics {
    const totalOperations = this.operations.length
    const successfulOperations = this.operations.filter((o) => o.success).length
    const failedOperations = totalOperations - successfulOperations
    const averageDuration =
      totalOperations > 0
        ? this.operations.reduce((sum, o) => sum + o.duration, 0) / totalOperations
        : 0

    const operationsByType: Record<string, number> = {}
    for (const op of this.operations) {
      operationsByType[op.operation] = (operationsByType[op.operation] || 0) + 1
    }

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      safetyRefusals: this.safetyRefusals,
      averageDuration,
      operationsByType,
      lastOperation: this.operations[this.operations.length - 1],
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.operations = []
    this.safetyRefusals = 0
  }
}
