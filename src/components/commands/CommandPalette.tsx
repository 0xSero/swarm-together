import { useState, useEffect, useRef } from 'react'
import { Command } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseCommand, getAllCommands, type CommandDefinition } from '@/types/commands'
import { CommandDispatcher } from '@/services/CommandDispatcher'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onExecute?: (command: string, result: any) => void
}

export function CommandPalette({ isOpen, onClose, onExecute }: CommandPaletteProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<CommandDefinition[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dispatcher = useRef(new CommandDispatcher())

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!input.startsWith('/')) {
      setSuggestions([])
      return
    }

    const commands = getAllCommands()
    const query = input.substring(1).toLowerCase()

    if (!query) {
      setSuggestions(commands)
      return
    }

    const filtered = commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
    )

    setSuggestions(filtered)
    setSelectedIndex(0)
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Tab' && suggestions.length > 0) {
      e.preventDefault()
      const selected = suggestions[selectedIndex]
      setInput(`/${selected.name} `)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
    }
  }

  const handleExecute = async () => {
    if (!input.trim()) return

    const parsed = parseCommand(input)

    if (!parsed.isValid) {
      setResult({
        success: false,
        error: parsed.error,
      })
      return
    }

    try {
      const cmdResult = await dispatcher.current.execute(parsed)
      setResult(cmdResult)
      onExecute?.(input, cmdResult)

      if (cmdResult.success) {
        setTimeout(() => {
          setInput('')
          setResult(null)
          onClose()
        }, 1500)
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Command className="w-5 h-5 text-primary" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command... (e.g. /help)"
            className="flex-1 bg-transparent text-text-high placeholder:text-text-muted outline-none"
          />
        </div>

        {/* Result */}
        {result && (
          <div
            className={cn(
              'p-4 border-b border-border',
              result.success ? 'text-success' : 'text-danger'
            )}
          >
            {result.success ? result.message : result.error}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !result && (
          <div className="max-h-96 overflow-y-auto">
            {suggestions.map((cmd, index) => (
              <button
                key={cmd.name}
                onClick={() => setInput(`/${cmd.name} `)}
                className={cn(
                  'w-full text-left p-4 transition-colors border-b border-border/50 last:border-b-0',
                  index === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-elevated text-text-high'
                )}
              >
                <div className="font-semibold">/{cmd.name}</div>
                <div className="text-sm text-text-muted mt-1">{cmd.description}</div>
                <div className="text-xs text-text-muted mt-1 font-mono">{cmd.usage}</div>
              </button>
            ))}
          </div>
        )}

        {/* Help Text */}
        {!input && !result && (
          <div className="p-4 text-sm text-text-muted">
            <div className="mb-2">**Quick Tips:**</div>
            <div>- Press <kbd className="px-1 py-0.5 bg-elevated rounded text-xs">Tab</kbd> to autocomplete</div>
            <div>- Press <kbd className="px-1 py-0.5 bg-elevated rounded text-xs">↑</kbd> / <kbd className="px-1 py-0.5 bg-elevated rounded text-xs">↓</kbd> to navigate</div>
            <div>- Press <kbd className="px-1 py-0.5 bg-elevated rounded text-xs">Enter</kbd> to execute</div>
            <div>- Type <code className="px-1 py-0.5 bg-elevated rounded text-xs">/help</code> for all commands</div>
          </div>
        )}
      </div>
    </div>
  )
}
