import { describe, it, expect } from 'vitest'
import { parseCommand, getCommandHelp, getAllCommands } from './commands'

describe('Command Parser', () => {
  describe('parseCommand', () => {
    it('should parse simple command', () => {
      const parsed = parseCommand('/help')

      expect(parsed.isValid).toBe(true)
      expect(parsed.command).toBe('help')
      expect(parsed.subcommand).toBeUndefined()
      expect(parsed.args).toHaveLength(0)
    })

    it('should parse command with subcommand', () => {
      const parsed = parseCommand('/agent add coordinator')

      expect(parsed.isValid).toBe(true)
      expect(parsed.command).toBe('agent')
      expect(parsed.subcommand).toBe('add')
      expect(parsed.args).toEqual(['coordinator'])
    })

    it('should parse command with multiple args', () => {
      const parsed = parseCommand('/agent cfg myagent max_tokens 1000')

      expect(parsed.isValid).toBe(true)
      expect(parsed.command).toBe('agent')
      expect(parsed.subcommand).toBe('cfg')
      expect(parsed.args).toEqual(['myagent', 'max_tokens', '1000'])
    })

    it('should reject command without /', () => {
      const parsed = parseCommand('help')

      expect(parsed.isValid).toBe(false)
      expect(parsed.error).toContain('must start with /')
    })

    it('should reject unknown command', () => {
      const parsed = parseCommand('/unknown')

      expect(parsed.isValid).toBe(false)
      expect(parsed.error).toContain('Unknown command')
    })

    it('should reject unknown subcommand', () => {
      const parsed = parseCommand('/agent unknown')

      expect(parsed.isValid).toBe(false)
      expect(parsed.error).toContain('Unknown subcommand')
    })

    it('should require subcommand when needed', () => {
      const parsed = parseCommand('/agent')

      expect(parsed.isValid).toBe(false)
      expect(parsed.error).toContain('Subcommand required')
    })

    it('should require args when needed', () => {
      const parsed = parseCommand('/agent add')

      expect(parsed.isValid).toBe(false)
      expect(parsed.error).toContain('Arguments required')
    })

    it('should handle extra whitespace', () => {
      const parsed = parseCommand('/help    command')

      expect(parsed.isValid).toBe(true)
      expect(parsed.args).toEqual(['command'])
    })

    it('should be case insensitive', () => {
      const parsed = parseCommand('/HELP')

      expect(parsed.isValid).toBe(true)
      expect(parsed.command).toBe('help')
    })
  })

  describe('getCommandHelp', () => {
    it('should return general help when no command specified', () => {
      const help = getCommandHelp()

      expect(help).toContain('Available Commands')
      expect(help).toContain('/new')
      expect(help).toContain('/agent')
      expect(help).toContain('/help')
    })

    it('should return specific command help', () => {
      const help = getCommandHelp('agent')

      expect(help).toContain('/agent')
      expect(help).toContain('Manage agents')
      expect(help).toContain('Subcommands')
      expect(help).toContain('add')
      expect(help).toContain('cfg')
    })

    it('should return error for unknown command', () => {
      const help = getCommandHelp('unknown')

      expect(help).toContain('Unknown command')
    })
  })

  describe('getAllCommands', () => {
    it('should return all command definitions', () => {
      const commands = getAllCommands()

      expect(commands.length).toBeGreaterThan(0)
      expect(commands.some((c) => c.name === 'help')).toBe(true)
      expect(commands.some((c) => c.name === 'agent')).toBe(true)
    })
  })

  describe('Ambiguous Input', () => {
    it('should handle partial commands', () => {
      const parsed = parseCommand('/hel')

      expect(parsed.isValid).toBe(false)
      expect(parsed.error).toContain('Unknown command')
    })

    it('should handle special characters', () => {
      const parsed = parseCommand('/memory add special chars!@#')

      expect(parsed.isValid).toBe(true)
      expect(parsed.args).toContain('chars!@#')
    })

    it('should handle quoted args', () => {
      const parsed = parseCommand('/memory add "quoted string"')

      // Note: Current implementation doesn't preserve quotes
      // This test documents the behavior
      expect(parsed.isValid).toBe(true)
      expect(parsed.args).toContain('"quoted')
    })
  })
})
