export interface ParsedCommand {
  command: string
  subcommand?: string
  args: string[]
  rawInput: string
  isValid: boolean
  error?: string
}

export interface CommandDefinition {
  name: string
  description: string
  usage: string
  aliases?: string[]
  subcommands?: SubcommandDefinition[]
  requiresArgs?: boolean
  examples?: string[]
}

export interface SubcommandDefinition {
  name: string
  description: string
  usage: string
  requiresArgs?: boolean
}

export interface CommandResult {
  success: boolean
  message?: string
  data?: any
  error?: string
}

export interface CommandMetrics {
  commandName: string
  subcommand?: string
  duration: number
  success: boolean
  timestamp: string
}

export const COMMAND_DEFINITIONS: Record<string, CommandDefinition> = {
  new: {
    name: 'new',
    description: 'Create a new session',
    usage: '/new [session-name]',
    examples: ['/new my-project', '/new'],
  },
  agent: {
    name: 'agent',
    description: 'Manage agents',
    usage: '/agent <subcommand> [args]',
    subcommands: [
      {
        name: 'add',
        description: 'Add a new agent',
        usage: '/agent add <role> [name]',
        requiresArgs: true,
      },
      {
        name: 'cfg',
        description: 'Configure an agent',
        usage: '/agent cfg <name> <key> <value>',
        requiresArgs: true,
      },
      {
        name: 'list',
        description: 'List all agents',
        usage: '/agent list',
      },
    ],
    requiresArgs: true,
    examples: ['/agent add coordinator', '/agent cfg my-agent max_tokens 1000'],
  },
  model: {
    name: 'model',
    description: 'Manage AI models',
    usage: '/model <subcommand> [args]',
    subcommands: [
      {
        name: 'set',
        description: 'Set the active model',
        usage: '/model set <model-name>',
        requiresArgs: true,
      },
      {
        name: 'list',
        description: 'List available models',
        usage: '/model list',
      },
    ],
    requiresArgs: true,
    examples: ['/model set claude-sonnet-4', '/model list'],
  },
  tokens: {
    name: 'tokens',
    description: 'Show token usage statistics',
    usage: '/tokens [scope]',
    examples: ['/tokens', '/tokens session', '/tokens global'],
  },
  history: {
    name: 'history',
    description: 'Show session history',
    usage: '/history [limit]',
    examples: ['/history', '/history 20'],
  },
  progress: {
    name: 'progress',
    description: 'Show progress timeline',
    usage: '/progress',
    examples: ['/progress'],
  },
  worktree: {
    name: 'worktree',
    description: 'Manage git worktrees',
    usage: '/worktree <subcommand> [args]',
    subcommands: [
      {
        name: 'add',
        description: 'Add a new worktree',
        usage: '/worktree add <path> [branch]',
        requiresArgs: true,
      },
      {
        name: 'list',
        description: 'List all worktrees',
        usage: '/worktree list',
      },
      {
        name: 'remove',
        description: 'Remove a worktree',
        usage: '/worktree remove <path>',
        requiresArgs: true,
      },
    ],
    requiresArgs: true,
    examples: ['/worktree add ./wt feature-branch', '/worktree list'],
  },
  branch: {
    name: 'branch',
    description: 'Manage git branches',
    usage: '/branch <subcommand> [args]',
    subcommands: [
      {
        name: 'create',
        description: 'Create a new branch',
        usage: '/branch create <name>',
        requiresArgs: true,
      },
      {
        name: 'switch',
        description: 'Switch to a branch',
        usage: '/branch switch <name>',
        requiresArgs: true,
      },
      {
        name: 'list',
        description: 'List all branches',
        usage: '/branch list',
      },
    ],
    requiresArgs: true,
    examples: ['/branch create feature-x', '/branch switch main'],
  },
  memory: {
    name: 'memory',
    description: 'Manage memory and blackboard',
    usage: '/memory <subcommand> [args]',
    subcommands: [
      {
        name: 'add',
        description: 'Add to memory',
        usage: '/memory add <content>',
        requiresArgs: true,
      },
      {
        name: 'pin',
        description: 'Pin a memory entry',
        usage: '/memory pin <id>',
        requiresArgs: true,
      },
      {
        name: 'clear',
        description: 'Clear memory',
        usage: '/memory clear [type]',
      },
      {
        name: 'recall',
        description: 'Semantic recall',
        usage: '/memory recall <query>',
        requiresArgs: true,
      },
    ],
    requiresArgs: true,
    examples: ['/memory add Important note', '/memory recall authentication'],
  },
  help: {
    name: 'help',
    description: 'Show help information',
    usage: '/help [command]',
    examples: ['/help', '/help agent', '/help worktree'],
  },
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim()

  // Must start with /
  if (!trimmed.startsWith('/')) {
    return {
      command: '',
      args: [],
      rawInput: input,
      isValid: false,
      error: 'Command must start with /',
    }
  }

  // Remove leading /
  const withoutSlash = trimmed.substring(1)

  // Split by whitespace
  const parts = withoutSlash.split(/\s+/).filter((p) => p.length > 0)

  if (parts.length === 0) {
    return {
      command: '',
      args: [],
      rawInput: input,
      isValid: false,
      error: 'No command specified',
    }
  }

  const [command, subcommand, ...args] = parts

  // Check if command exists
  const definition = COMMAND_DEFINITIONS[command.toLowerCase()]
  if (!definition) {
    return {
      command: command.toLowerCase(),
      args,
      rawInput: input,
      isValid: false,
      error: `Unknown command: ${command}`,
    }
  }

  // Check if subcommand is required
  if (definition.subcommands && definition.requiresArgs && !subcommand) {
    return {
      command: command.toLowerCase(),
      args,
      rawInput: input,
      isValid: false,
      error: `Subcommand required for /${command}`,
    }
  }

  // Validate subcommand
  if (definition.subcommands && subcommand) {
    const subdef = definition.subcommands.find((s) => s.name === subcommand.toLowerCase())
    if (!subdef) {
      return {
        command: command.toLowerCase(),
        subcommand: subcommand.toLowerCase(),
        args,
        rawInput: input,
        isValid: false,
        error: `Unknown subcommand: ${subcommand}`,
      }
    }

    // Check if args are required
    if (subdef.requiresArgs && args.length === 0) {
      return {
        command: command.toLowerCase(),
        subcommand: subcommand.toLowerCase(),
        args,
        rawInput: input,
        isValid: false,
        error: `Arguments required for /${command} ${subcommand}`,
      }
    }
  }

  return {
    command: command.toLowerCase(),
    subcommand: subcommand?.toLowerCase(),
    args,
    rawInput: input,
    isValid: true,
  }
}

export function getAllCommands(): CommandDefinition[] {
  return Object.values(COMMAND_DEFINITIONS)
}

export function getCommandHelp(commandName?: string): string {
  if (!commandName) {
    // Show all commands
    const commands = getAllCommands()
    let help = '**Available Commands:**\n\n'

    for (const cmd of commands) {
      help += `**/${cmd.name}** - ${cmd.description}\n`
      help += `  Usage: \`${cmd.usage}\`\n\n`
    }

    help += '\nType `/help <command>` for detailed information about a specific command.'
    return help
  }

  const definition = COMMAND_DEFINITIONS[commandName.toLowerCase()]
  if (!definition) {
    return `Unknown command: ${commandName}\n\nType \`/help\` to see all available commands.`
  }

  let help = `**/${definition.name}** - ${definition.description}\n\n`
  help += `**Usage:** \`${definition.usage}\`\n\n`

  if (definition.subcommands) {
    help += '**Subcommands:**\n\n'
    for (const sub of definition.subcommands) {
      help += `  **${sub.name}** - ${sub.description}\n`
      help += `    Usage: \`${sub.usage}\`\n\n`
    }
  }

  if (definition.examples && definition.examples.length > 0) {
    help += '**Examples:**\n\n'
    for (const example of definition.examples) {
      help += `  \`${example}\`\n`
    }
  }

  return help
}
