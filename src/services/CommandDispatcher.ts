import type { ParsedCommand, CommandResult, CommandMetrics } from '@/types/commands'
import { getCommandHelp } from '@/types/commands'
import { getTokenService } from './TokenService'

export class CommandDispatcher {
  private metrics: CommandMetrics[] = []

  async execute(parsed: ParsedCommand): Promise<CommandResult> {
    if (!parsed.isValid) {
      return {
        success: false,
        error: parsed.error,
      }
    }

    const startTime = Date.now()

    try {
      let result: CommandResult

      switch (parsed.command) {
        case 'new':
          result = await this.handleNew(parsed)
          break
        case 'agent':
          result = await this.handleAgent(parsed)
          break
        case 'model':
          result = await this.handleModel(parsed)
          break
        case 'tokens':
          result = await this.handleTokens(parsed)
          break
        case 'history':
          result = await this.handleHistory(parsed)
          break
        case 'progress':
          result = await this.handleProgress(parsed)
          break
        case 'worktree':
          result = await this.handleWorktree(parsed)
          break
        case 'branch':
          result = await this.handleBranch(parsed)
          break
        case 'memory':
          result = await this.handleMemory(parsed)
          break
        case 'help':
          result = this.handleHelp(parsed)
          break
        default:
          result = {
            success: false,
            error: `Command not implemented: ${parsed.command}`,
          }
      }

      const metric: CommandMetrics = {
        commandName: parsed.command,
        subcommand: parsed.subcommand,
        duration: Date.now() - startTime,
        success: result.success,
        timestamp: new Date().toISOString(),
      }
      this.metrics.push(metric)

      return result
    } catch (error) {
      const metric: CommandMetrics = {
        commandName: parsed.command,
        subcommand: parsed.subcommand,
        duration: Date.now() - startTime,
        success: false,
        timestamp: new Date().toISOString(),
      }
      this.metrics.push(metric)

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async handleNew(parsed: ParsedCommand): Promise<CommandResult> {
    const sessionName = parsed.args[0] || `Session ${Date.now()}`

    return {
      success: true,
      message: `Created new session: ${sessionName}`,
      data: { sessionName },
    }
  }

  private async handleAgent(parsed: ParsedCommand): Promise<CommandResult> {
    switch (parsed.subcommand) {
      case 'add':
        const role = parsed.args[0]
        const name = parsed.args[1] || `agent-${Date.now()}`
        return {
          success: true,
          message: `Added agent "${name}" with role: ${role}`,
          data: { role, name },
        }

      case 'cfg':
        const agentName = parsed.args[0]
        const key = parsed.args[1]
        const value = parsed.args[2]
        return {
          success: true,
          message: `Configured ${agentName}: ${key} = ${value}`,
          data: { agentName, key, value },
        }

      case 'list':
        return {
          success: true,
          message: 'Listing agents...',
          data: { agents: [] },
        }

      default:
        return {
          success: false,
          error: `Unknown agent subcommand: ${parsed.subcommand}`,
        }
    }
  }

  private async handleModel(parsed: ParsedCommand): Promise<CommandResult> {
    switch (parsed.subcommand) {
      case 'set':
        const modelName = parsed.args[0]
        return {
          success: true,
          message: `Set active model to: ${modelName}`,
          data: { modelName },
        }

      case 'list':
        const models = ['claude-sonnet-4', 'claude-sonnet-3.5', 'gpt-5', 'gpt-4', 'ollama/local']
        return {
          success: true,
          message: 'Available models:',
          data: { models },
        }

      default:
        return {
          success: false,
          error: `Unknown model subcommand: ${parsed.subcommand}`,
        }
    }
  }

  private async handleTokens(parsed: ParsedCommand): Promise<CommandResult> {
    const tokenService = getTokenService()
    const aggregated = tokenService.getAggregatedUsage()

    const scope = parsed.args[0] || 'all'

    return {
      success: true,
      message: `Token usage (${scope}):`,
      data: aggregated,
    }
  }

  private async handleHistory(parsed: ParsedCommand): Promise<CommandResult> {
    const limit = parseInt(parsed.args[0]) || 50

    return {
      success: true,
      message: `Showing last ${limit} history items...`,
      data: { limit },
    }
  }

  private async handleProgress(parsed: ParsedCommand): Promise<CommandResult> {
    return {
      success: true,
      message: 'Progress timeline:',
      data: { events: [] },
    }
  }

  private async handleWorktree(parsed: ParsedCommand): Promise<CommandResult> {
    switch (parsed.subcommand) {
      case 'add':
        const path = parsed.args[0]
        const branch = parsed.args[1]
        return {
          success: true,
          message: `Added worktree at ${path}${branch ? ` for branch ${branch}` : ''}`,
          data: { path, branch },
        }

      case 'list':
        return {
          success: true,
          message: 'Worktrees:',
          data: { worktrees: [] },
        }

      case 'remove':
        const removePath = parsed.args[0]
        return {
          success: true,
          message: `Removed worktree at ${removePath}`,
          data: { path: removePath },
        }

      default:
        return {
          success: false,
          error: `Unknown worktree subcommand: ${parsed.subcommand}`,
        }
    }
  }

  private async handleBranch(parsed: ParsedCommand): Promise<CommandResult> {
    switch (parsed.subcommand) {
      case 'create':
        const newBranch = parsed.args[0]
        return {
          success: true,
          message: `Created branch: ${newBranch}`,
          data: { branch: newBranch },
        }

      case 'switch':
        const targetBranch = parsed.args[0]
        return {
          success: true,
          message: `Switched to branch: ${targetBranch}`,
          data: { branch: targetBranch },
        }

      case 'list':
        return {
          success: true,
          message: 'Branches:',
          data: { branches: ['main', 'develop'] },
        }

      default:
        return {
          success: false,
          error: `Unknown branch subcommand: ${parsed.subcommand}`,
        }
    }
  }

  private async handleMemory(parsed: ParsedCommand): Promise<CommandResult> {
    switch (parsed.subcommand) {
      case 'add':
        const content = parsed.args.join(' ')
        return {
          success: true,
          message: `Added to memory: ${content}`,
          data: { content },
        }

      case 'pin':
        const id = parsed.args[0]
        return {
          success: true,
          message: `Pinned memory entry: ${id}`,
          data: { id },
        }

      case 'clear':
        const type = parsed.args[0] || 'all'
        return {
          success: true,
          message: `Cleared ${type} memory`,
          data: { type },
        }

      case 'recall':
        const query = parsed.args.join(' ')
        return {
          success: true,
          message: `Recall results for: ${query}`,
          data: { query, results: [] },
        }

      default:
        return {
          success: false,
          error: `Unknown memory subcommand: ${parsed.subcommand}`,
        }
    }
  }

  private handleHelp(parsed: ParsedCommand): CommandResult {
    const commandName = parsed.args[0]
    const helpText = getCommandHelp(commandName)

    return {
      success: true,
      message: helpText,
    }
  }

  getMetrics(): {
    totalCommands: number
    successRate: number
    averageLatency: number
    commandCounts: Record<string, number>
    recentCommands: CommandMetrics[]
  } {
    const totalCommands = this.metrics.length
    const successfulCommands = this.metrics.filter((m) => m.success).length
    const successRate = totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0
    const averageLatency =
      totalCommands > 0
        ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalCommands
        : 0

    const commandCounts: Record<string, number> = {}
    for (const metric of this.metrics) {
      const key = metric.subcommand
        ? `${metric.commandName}:${metric.subcommand}`
        : metric.commandName
      commandCounts[key] = (commandCounts[key] || 0) + 1
    }

    return {
      totalCommands,
      successRate,
      averageLatency,
      commandCounts,
      recentCommands: this.metrics.slice(-10),
    }
  }
}
