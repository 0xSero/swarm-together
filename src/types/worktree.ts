export interface Worktree {
  path: string
  branch: string
  head: string
  bare: boolean
  detached: boolean
  locked: boolean
  lockReason?: string
}

export interface WorktreeInfo {
  worktrees: Worktree[]
  mainWorktree: Worktree | null
  count: number
}

export interface WorktreeAddOptions {
  branch?: string
  newBranch?: boolean
  checkout?: boolean
  detach?: boolean
  force?: boolean
  lock?: boolean
  lockReason?: string
}

export interface WorktreeRemoveOptions {
  force?: boolean
  preview?: boolean
}

export interface WorktreeSafetyCheck {
  hasUncommittedChanges: boolean
  hasUntrackedFiles: boolean
  hasStagedChanges: boolean
  branchUpToDate: boolean
  canRemoveSafely: boolean
  warnings: string[]
}

export interface WorktreeDiff {
  path: string
  added: number
  deleted: number
  modified: number
  files: Array<{
    path: string
    status: 'added' | 'deleted' | 'modified'
    changes: string
  }>
}

export interface WorktreeOperation {
  operation: 'add' | 'remove' | 'lock' | 'unlock' | 'prune' | 'list'
  path?: string
  branch?: string
  duration: number
  success: boolean
  error?: string
  timestamp: string
}

export interface WorktreeMetrics {
  totalOperations: number
  successfulOperations: number
  failedOperations: number
  safetyRefusals: number
  averageDuration: number
  operationsByType: Record<string, number>
  lastOperation?: WorktreeOperation
}

export function isValidWorktreePath(path: string): { valid: boolean; reason?: string } {
  // Path must be absolute or relative
  if (!path || path.trim() === '') {
    return { valid: false, reason: 'Path cannot be empty' }
  }

  // Must not contain dangerous characters
  if (path.includes('..') && !path.startsWith('./')) {
    return { valid: false, reason: 'Path cannot contain ".." (directory traversal)' }
  }

  // Must not be root
  if (path === '/' || path === '\\') {
    return { valid: false, reason: 'Cannot use root directory' }
  }

  return { valid: true }
}

export function isValidBranchName(branch: string): { valid: boolean; reason?: string } {
  // Empty check
  if (!branch || branch.trim() === '') {
    return { valid: false, reason: 'Branch name cannot be empty' }
  }

  // Must not start with -
  if (branch.startsWith('-')) {
    return { valid: false, reason: 'Branch name cannot start with "-"' }
  }

  // Must not contain invalid characters
  const invalidChars = /[\s~^:?*\[\\]/
  if (invalidChars.test(branch)) {
    return { valid: false, reason: 'Branch name contains invalid characters' }
  }

  // Must not end with .lock
  if (branch.endsWith('.lock')) {
    return { valid: false, reason: 'Branch name cannot end with ".lock"' }
  }

  // Must not contain ..
  if (branch.includes('..')) {
    return { valid: false, reason: 'Branch name cannot contain ".."' }
  }

  // Must not start or end with /
  if (branch.startsWith('/') || branch.endsWith('/')) {
    return { valid: false, reason: 'Branch name cannot start or end with "/"' }
  }

  // Must not contain consecutive slashes
  if (branch.includes('//')) {
    return { valid: false, reason: 'Branch name cannot contain consecutive slashes' }
  }

  return { valid: true }
}

export function generateWorktreePath(basePath: string, branch: string): string {
  // Sanitize branch name for use in path
  const sanitized = branch
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `${basePath}/worktrees/${sanitized}`
}

export function parseWorktreeList(output: string): Worktree[] {
  const worktrees: Worktree[] = []
  const lines = output.trim().split('\n')

  let current: Partial<Worktree> = {}

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as Worktree)
      }
      current = { path: line.substring(9).trim() }
    } else if (line.startsWith('HEAD ')) {
      current.head = line.substring(5).trim()
    } else if (line.startsWith('branch ')) {
      current.branch = line.substring(7).trim()
      current.detached = false
    } else if (line.startsWith('detached')) {
      current.detached = true
    } else if (line.startsWith('locked')) {
      current.locked = true
      const reasonMatch = line.match(/locked: (.+)/)
      if (reasonMatch) {
        current.lockReason = reasonMatch[1]
      }
    } else if (line.startsWith('bare')) {
      current.bare = true
    }
  }

  if (current.path) {
    worktrees.push(current as Worktree)
  }

  return worktrees
}
