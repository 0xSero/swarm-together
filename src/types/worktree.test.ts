import { describe, it, expect } from 'vitest'
import {
  isValidWorktreePath,
  isValidBranchName,
  generateWorktreePath,
  parseWorktreeList,
} from './worktree'

describe('Worktree Type Guards', () => {
  describe('isValidWorktreePath', () => {
    it('should accept valid paths', () => {
      const validPaths = [
        '/home/user/projects/worktree1',
        './worktrees/feature',
        '../worktrees/fix',
        'worktrees/test',
      ]

      for (const path of validPaths) {
        const result = isValidWorktreePath(path)
        expect(result.valid).toBe(true)
      }
    })

    it('should reject empty path', () => {
      const result = isValidWorktreePath('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('empty')
    })

    it('should reject directory traversal', () => {
      const result = isValidWorktreePath('../../etc/passwd')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('traversal')
    })

    it('should reject root directory', () => {
      expect(isValidWorktreePath('/').valid).toBe(false)
      expect(isValidWorktreePath('\\').valid).toBe(false)
    })
  })

  describe('isValidBranchName', () => {
    it('should accept valid branch names', () => {
      const validNames = [
        'feature/new-feature',
        'bugfix-123',
        'release-1.0',
        'user/name/branch',
        'CamelCase',
      ]

      for (const name of validNames) {
        const result = isValidBranchName(name)
        expect(result.valid).toBe(true)
      }
    })

    it('should reject empty branch name', () => {
      const result = isValidBranchName('')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('empty')
    })

    it('should reject branch starting with dash', () => {
      const result = isValidBranchName('-invalid')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('start')
    })

    it('should reject invalid characters', () => {
      const invalidNames = [
        'branch with spaces',
        'branch~1',
        'branch^2',
        'branch:test',
        'branch?',
        'branch*',
        'branch[1]',
        'branch\\test',
      ]

      for (const name of invalidNames) {
        const result = isValidBranchName(name)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('invalid characters')
      }
    })

    it('should reject branch ending with .lock', () => {
      const result = isValidBranchName('branch.lock')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('.lock')
    })

    it('should reject branch with ..', () => {
      const result = isValidBranchName('branch..name')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('..')
    })

    it('should reject branch starting or ending with /', () => {
      expect(isValidBranchName('/branch').valid).toBe(false)
      expect(isValidBranchName('branch/').valid).toBe(false)
    })

    it('should reject consecutive slashes', () => {
      const result = isValidBranchName('branch//name')
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('consecutive')
    })
  })

  describe('generateWorktreePath', () => {
    it('should generate safe path from branch name', () => {
      const path = generateWorktreePath('/base', 'feature/new-feature')
      expect(path).toBe('/base/worktrees/feature-new-feature')
    })

    it('should sanitize special characters', () => {
      const path = generateWorktreePath('/base', 'bug#123@fix!')
      expect(path).toMatch(/^\/base\/worktrees\/bug-123-fix-?$/)
    })

    it('should handle multiple consecutive special chars', () => {
      const path = generateWorktreePath('/base', 'branch###name')
      expect(path).toBe('/base/worktrees/branch-name')
    })

    it('should remove leading/trailing dashes', () => {
      const path = generateWorktreePath('/base', '---branch---')
      expect(path).toBe('/base/worktrees/branch')
    })
  })

  describe('parseWorktreeList', () => {
    it('should parse simple worktree list', () => {
      const output = `
worktree /home/user/project
HEAD abc123
branch refs/heads/main

worktree /home/user/project/worktrees/feature
HEAD def456
branch refs/heads/feature/test
      `.trim()

      const worktrees = parseWorktreeList(output)

      expect(worktrees).toHaveLength(2)
      expect(worktrees[0].path).toBe('/home/user/project')
      expect(worktrees[0].head).toBe('abc123')
      expect(worktrees[0].branch).toBe('refs/heads/main')
      expect(worktrees[0].detached).toBe(false)
    })

    it('should parse locked worktree', () => {
      const output = `
worktree /home/user/project/locked
HEAD abc123
branch refs/heads/test
locked: work in progress
      `.trim()

      const worktrees = parseWorktreeList(output)

      expect(worktrees).toHaveLength(1)
      expect(worktrees[0].locked).toBe(true)
      expect(worktrees[0].lockReason).toBe('work in progress')
    })

    it('should parse detached worktree', () => {
      const output = `
worktree /home/user/project/detached
HEAD def456
detached
      `.trim()

      const worktrees = parseWorktreeList(output)

      expect(worktrees).toHaveLength(1)
      expect(worktrees[0].detached).toBe(true)
      expect(worktrees[0].branch).toBeUndefined()
    })

    it('should parse bare worktree', () => {
      const output = `
worktree /home/user/project/.git
bare
      `.trim()

      const worktrees = parseWorktreeList(output)

      expect(worktrees).toHaveLength(1)
      expect(worktrees[0].bare).toBe(true)
    })

    it('should handle empty output', () => {
      const worktrees = parseWorktreeList('')
      expect(worktrees).toHaveLength(0)
    })

    it('should parse multiple worktrees with various states', () => {
      const output = `
worktree /home/user/project
HEAD abc123
branch refs/heads/main

worktree /home/user/project/feature1
HEAD def456
branch refs/heads/feature1
locked

worktree /home/user/project/detached
HEAD 789ghi
detached
      `.trim()

      const worktrees = parseWorktreeList(output)

      expect(worktrees).toHaveLength(3)
      expect(worktrees[0].locked).toBeUndefined()
      expect(worktrees[1].locked).toBe(true)
      expect(worktrees[2].detached).toBe(true)
    })
  })
})
