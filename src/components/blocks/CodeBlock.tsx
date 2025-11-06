import { cn } from '@/lib/utils'

interface CodeBlockProps {
  content: string
  language?: string
  wrap?: boolean
  className?: string
}

export function CodeBlock({ content, language = 'text', wrap = true, className }: CodeBlockProps) {
  return (
    <div className={cn('relative group', className)}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs px-2 py-1 rounded bg-elevated/80 text-text-muted">
          {language}
        </span>
      </div>
      <pre
        className={cn(
          'font-mono text-sm p-3 rounded bg-black/20 overflow-x-auto',
          wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
        )}
      >
        <code className={`language-${language}`}>{content}</code>
      </pre>
    </div>
  )
}

// Simple syntax highlighter (can be replaced with a library like Prism or Highlight.js)
export function SyntaxHighlightedCode({ content, language }: { content: string; language: string }) {
  // For now, just return the content wrapped in appropriate classes
  // In a real implementation, you'd use a syntax highlighting library
  return <code className={`language-${language}`}>{content}</code>
}
