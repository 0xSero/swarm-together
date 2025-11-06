import type { TokenEstimate } from '@/types/tokens'

/**
 * Token estimation utilities
 *
 * Provides multiple methods for estimating token counts:
 * 1. Character-based (fast, least accurate)
 * 2. Word-based (medium speed, medium accuracy)
 * 3. Tiktoken-like (slower, more accurate)
 */

// Average characters per token for different models
const CHARS_PER_TOKEN = {
  'claude': 3.5,
  'gpt': 4.0,
  'default': 3.8,
}

// Average words per token
const WORDS_PER_TOKEN = {
  'claude': 0.75,
  'gpt': 0.75,
  'default': 0.75,
}

/**
 * Estimate tokens using character count (fastest, least accurate)
 */
export function estimateByChars(text: string, model: string = 'default'): TokenEstimate {
  const charsPerToken = CHARS_PER_TOKEN[model as keyof typeof CHARS_PER_TOKEN] || CHARS_PER_TOKEN.default
  const tokens = Math.ceil(text.length / charsPerToken)

  return {
    tokens,
    method: 'char-based',
    confidence: 0.7,
  }
}

/**
 * Estimate tokens using word count (medium accuracy)
 */
export function estimateByWords(text: string, model: string = 'default'): TokenEstimate {
  const words = text.split(/\s+/).filter(w => w.length > 0).length
  const wordsPerToken = WORDS_PER_TOKEN[model as keyof typeof WORDS_PER_TOKEN] || WORDS_PER_TOKEN.default
  const tokens = Math.ceil(words / wordsPerToken)

  return {
    tokens,
    method: 'word-based',
    confidence: 0.85,
  }
}

/**
 * Simplified tiktoken-like estimation (better accuracy)
 * This is a simplified version - in production you'd use actual tiktoken library
 */
export function estimateTiktoken(text: string, model: string = 'default'): TokenEstimate {
  let tokenCount = 0

  // Split on common token boundaries
  const segments = text.split(/(\s+|[,.:;!?'"()\[\]{}])/g).filter(s => s.length > 0)

  for (const segment of segments) {
    if (segment.match(/^\s+$/)) {
      // Whitespace is typically merged with adjacent tokens
      continue
    } else if (segment.match(/^[,.:;!?'"()\[\]{}]$/)) {
      // Single punctuation is usually 1 token
      tokenCount += 1
    } else if (segment.length <= 4) {
      // Short words are typically 1 token
      tokenCount += 1
    } else {
      // Longer words may be multiple tokens
      // Rough estimate: 1 token per 4 chars for longer words
      tokenCount += Math.ceil(segment.length / 4)
    }
  }

  return {
    tokens: tokenCount,
    method: 'tiktoken',
    confidence: 0.92,
  }
}

/**
 * Best-effort token estimation (uses multiple methods)
 */
export function estimateTokens(text: string, model: string = 'default'): TokenEstimate {
  if (text.length === 0) {
    return {
      tokens: 0,
      method: 'exact',
      confidence: 1.0,
    }
  }

  // For short texts, use simple char-based
  if (text.length < 100) {
    return estimateByChars(text, model)
  }

  // For medium texts, use word-based
  if (text.length < 1000) {
    return estimateByWords(text, model)
  }

  // For longer texts, use tiktoken-like estimation
  return estimateTiktoken(text, model)
}

/**
 * Estimate tokens for a conversation (array of messages)
 */
export function estimateConversationTokens(
  messages: Array<{ role: string; content: string }>,
  model: string = 'default'
): TokenEstimate {
  let totalTokens = 0

  // Add base tokens per message (format overhead)
  const messageOverhead = 4 // Approximate overhead per message for role, delimiters, etc.

  for (const message of messages) {
    const contentEstimate = estimateTokens(message.content, model)
    totalTokens += contentEstimate.tokens + messageOverhead
  }

  return {
    tokens: totalTokens,
    method: 'tiktoken',
    confidence: 0.88,
  }
}

/**
 * Estimate tokens for code (slightly different patterns)
 */
export function estimateCodeTokens(code: string, language: string = 'unknown'): TokenEstimate {
  // Code tends to have more tokens per character due to symbols
  const estimate = estimateTiktoken(code)

  // Add 10% for code symbol overhead
  const adjustedTokens = Math.ceil(estimate.tokens * 1.1)

  return {
    tokens: adjustedTokens,
    method: 'tiktoken',
    confidence: 0.85,
  }
}

/**
 * Calculate token budget remaining
 */
export function calculateBudgetRemaining(
  used: number,
  limit: number
): {
  remaining: number
  percentage: number
  status: 'healthy' | 'warning' | 'critical'
} {
  const remaining = Math.max(0, limit - used)
  const percentage = (remaining / limit) * 100

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (percentage < 10) {
    status = 'critical'
  } else if (percentage < 30) {
    status = 'warning'
  }

  return {
    remaining,
    percentage,
    status,
  }
}

/**
 * Validate token estimate against actual usage (for testing)
 */
export function validateEstimate(
  estimated: number,
  actual: number
): {
  error: number
  errorPercent: number
  acceptable: boolean
} {
  const error = Math.abs(estimated - actual)
  const errorPercent = (error / actual) * 100

  // Consider estimate acceptable if within 15% of actual
  const acceptable = errorPercent <= 15

  return {
    error,
    errorPercent,
    acceptable,
  }
}
