import { useState, useEffect, useRef } from 'react'
import { Copy, Play, Bookmark, Paperclip, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Block, BlockAction, BlockRenderMetrics } from '@/types/blocks'
import { formatBlockTimestamp, extractCodeFromBlock } from '@/types/blocks'
import { AttachmentViewer } from './AttachmentViewer'
import { CodeBlock } from './CodeBlock'

interface BlockRendererProps {
  block: Block
  onCopy?: (content: string) => void
  onReRun?: (content: string) => Promise<void>
  onToggleBookmark?: (blockId: string) => Promise<void>
  onMetrics?: (metrics: BlockRenderMetrics) => void
  showActions?: boolean
  compact?: boolean
}

export function BlockRenderer({
  block,
  onCopy,
  onReRun,
  onToggleBookmark,
  onMetrics,
  showActions = true,
  compact = false,
}: BlockRendererProps) {
  const [copied, setCopied] = useState(false)
  const [reRunning, setReRunning] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const renderStartRef = useRef(performance.now())

  useEffect(() => {
    // Record render metrics
    const renderTime = performance.now() - renderStartRef.current
    onMetrics?.({
      blockId: block.id,
      renderTime,
      contentSize: block.content.length,
      hasAttachments: (block.metadata?.attachments?.length || 0) > 0,
      timestamp: Date.now(),
    })
  }, [block.id, block.content.length, block.metadata?.attachments, onMetrics])

  const handleCopy = async () => {
    try {
      const content = extractCodeFromBlock(block)
      await navigator.clipboard.writeText(content)
      onCopy?.(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      setError(null)
    } catch (err) {
      setError('Failed to copy to clipboard')
      console.error('Copy error:', err)
    }
  }

  const handleReRun = async () => {
    if (!onReRun || reRunning) return

    try {
      setReRunning(true)
      setError(null)
      const content = extractCodeFromBlock(block)
      await onReRun(content)
    } catch (err) {
      setError('Failed to re-run command')
      console.error('Re-run error:', err)
    } finally {
      setReRunning(false)
    }
  }

  const handleToggleBookmark = async () => {
    if (!onToggleBookmark) return

    try {
      setError(null)
      await onToggleBookmark(block.id)
    } catch (err) {
      setError('Failed to toggle bookmark')
      console.error('Bookmark error:', err)
    }
  }

  const typeStyles = {
    command: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
      icon: '›',
    },
    output: {
      bg: 'bg-surface',
      border: 'border-border',
      text: 'text-text-high',
      icon: '○',
    },
    error: {
      bg: 'bg-danger/10',
      border: 'border-danger/30',
      text: 'text-danger',
      icon: '✕',
    },
    conversation: {
      bg: 'bg-accent/10',
      border: 'border-accent/30',
      text: 'text-text-high',
      icon: '💬',
    },
    artifact: {
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      text: 'text-text-high',
      icon: '📎',
    },
  }

  const style = typeStyles[block.block_type] || typeStyles.output
  const hasAttachments = (block.metadata?.attachments?.length || 0) > 0

  return (
    <div
      className={cn(
        'rounded-md border transition-all',
        style.bg,
        style.border,
        block.bookmarked && 'ring-2 ring-warning/50',
        compact ? 'p-2' : 'p-3'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm opacity-70">{style.icon}</span>
          {block.title && (
            <h4 className="font-semibold text-sm truncate">{block.title}</h4>
          )}
          <span className={cn('text-xs capitalize opacity-70', style.text)}>
            {block.block_type}
          </span>
          {block.metadata?.duration_ms && (
            <span className="text-xs opacity-50">
              {block.metadata.duration_ms}ms
            </span>
          )}
          {block.metadata?.exit_code !== undefined && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                block.metadata.exit_code === 0
                  ? 'bg-success/20 text-success'
                  : 'bg-danger/20 text-danger'
              )}
            >
              exit {block.metadata.exit_code}
            </span>
          )}
        </div>

        {showActions && (
          <div className="flex items-center gap-1">
            {hasAttachments && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAttachments(!showAttachments)}
                className="h-6 w-6 p-0"
                title={`${block.metadata?.attachments?.length} attachment(s)`}
              >
                <Paperclip className="w-3 h-3" />
              </Button>
            )}

            {onCopy && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                disabled={copied}
                className="h-6 w-6 p-0"
                title="Copy content"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            )}

            {onReRun && block.block_type === 'command' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReRun}
                disabled={reRunning}
                className="h-6 w-6 p-0"
                title="Re-run command"
              >
                <Play
                  className={cn('w-3 h-3', reRunning && 'animate-spin')}
                />
              </Button>
            )}

            {onToggleBookmark && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleToggleBookmark}
                className="h-6 w-6 p-0"
                title={block.bookmarked ? 'Remove bookmark' : 'Add bookmark'}
              >
                <Bookmark
                  className={cn(
                    'w-3 h-3',
                    block.bookmarked && 'fill-warning text-warning'
                  )}
                />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 px-2 py-1 mb-2 text-xs bg-danger/20 text-danger rounded">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      <div className="relative">
        {block.block_type === 'command' || block.metadata?.language ? (
          <CodeBlock
            content={block.content}
            language={block.metadata?.language || detectLanguageFromContent(block.content)}
            wrap={block.metadata?.wrapLines}
          />
        ) : (
          <pre
            className={cn(
              'whitespace-pre-wrap break-words font-mono text-sm',
              style.text
            )}
          >
            {block.content}
          </pre>
        )}
      </div>

      {/* Attachments */}
      {showAttachments && hasAttachments && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <AttachmentViewer attachments={block.metadata!.attachments!} />
        </div>
      )}

      {/* Footer */}
      {!compact && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30 text-xs opacity-70">
          <span>{formatBlockTimestamp(block.created_at)}</span>
          {block.metadata?.working_dir && (
            <span className="truncate max-w-xs" title={block.metadata.working_dir}>
              {block.metadata.working_dir}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function detectLanguageFromContent(content: string): string {
  if (content.startsWith('$') || content.startsWith('>')) return 'bash'
  if (content.includes('```')) return 'markdown'
  return 'text'
}
