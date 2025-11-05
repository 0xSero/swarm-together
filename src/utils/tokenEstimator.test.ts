import { describe, it, expect } from 'vitest'
import {
  estimateByChars,
  estimateByWords,
  estimateTiktoken,
  estimateTokens,
  estimateConversationTokens,
  estimateCodeTokens,
  calculateBudgetRemaining,
  validateEstimate,
} from './tokenEstimator'

describe('Token Estimator', () => {
  describe('estimateByChars', () => {
    it('should estimate tokens from character count', () => {
      const text = 'Hello, world!'
      const estimate = estimateByChars(text)

      expect(estimate.tokens).toBeGreaterThan(0)
      expect(estimate.method).toBe('char-based')
      expect(estimate.confidence).toBe(0.7)
    })

    it('should handle empty string', () => {
      const estimate = estimateByChars('')
      expect(estimate.tokens).toBe(0)
    })

    it('should scale with text length', () => {
      const short = estimateByChars('Hi')
      const long = estimateByChars('Hi'.repeat(100))

      expect(long.tokens).toBeGreaterThan(short.tokens)
    })
  })

  describe('estimateByWords', () => {
    it('should estimate tokens from word count', () => {
      const text = 'The quick brown fox jumps over the lazy dog'
      const estimate = estimateByWords(text)

      expect(estimate.tokens).toBeGreaterThan(0)
      expect(estimate.method).toBe('word-based')
      expect(estimate.confidence).toBe(0.85)
    })

    it('should handle multiple spaces', () => {
      const text = 'word1    word2     word3'
      const estimate = estimateByWords(text)

      expect(estimate.tokens).toBe(4) // 3 words / 0.75 words per token
    })

    it('should handle empty string', () => {
      const estimate = estimateByWords('')
      expect(estimate.tokens).toBe(0)
    })
  })

  describe('estimateTiktoken', () => {
    it('should provide better estimates than char-based', () => {
      const text = 'function test() { return 42; }'
      const estimate = estimateTiktoken(text)

      expect(estimate.tokens).toBeGreaterThan(0)
      expect(estimate.method).toBe('tiktoken')
      expect(estimate.confidence).toBe(0.92)
    })

    it('should count punctuation separately', () => {
      const withPunct = estimateTiktoken('Hello, world!')
      const withoutPunct = estimateTiktoken('Hello world')

      expect(withPunct.tokens).toBeGreaterThanOrEqual(withoutPunct.tokens)
    })

    it('should handle code with symbols', () => {
      const code = 'const x = { a: 1, b: 2 };'
      const estimate = estimateTiktoken(code)

      expect(estimate.tokens).toBeGreaterThan(5)
    })
  })

  describe('estimateTokens', () => {
    it('should use appropriate method based on text length', () => {
      const short = 'Hi'
      const medium = 'This is a medium length text with several words'
      const long = 'This is a much longer text that spans multiple sentences. ' +
                   'It contains various punctuation marks, numbers like 123, ' +
                   'and different types of words. This should trigger the ' +
                   'tiktoken-like estimation method for better accuracy.'

      const shortEstimate = estimateTokens(short)
      const mediumEstimate = estimateTokens(medium)
      const longEstimate = estimateTokens(long)

      expect(shortEstimate.method).toBe('char-based')
      expect(mediumEstimate.method).toBe('word-based')
      expect(longEstimate.method).toBe('tiktoken')
    })

    it('should handle empty text', () => {
      const estimate = estimateTokens('')

      expect(estimate.tokens).toBe(0)
      expect(estimate.method).toBe('exact')
      expect(estimate.confidence).toBe(1.0)
    })
  })

  describe('estimateConversationTokens', () => {
    it('should estimate tokens for conversation', () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' },
        { role: 'assistant', content: 'I am doing well, thank you!' },
        { role: 'user', content: 'Great to hear!' },
      ]

      const estimate = estimateConversationTokens(messages)

      expect(estimate.tokens).toBeGreaterThan(0)
      expect(estimate.method).toBe('tiktoken')
      expect(estimate.confidence).toBe(0.88)
    })

    it('should add overhead per message', () => {
      const single = estimateConversationTokens([
        { role: 'user', content: 'Hi' }
      ])

      const double = estimateConversationTokens([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hi' },
      ])

      // Double should be more than 2x single due to overhead
      expect(double.tokens).toBeGreaterThan(single.tokens * 2)
    })

    it('should handle empty conversation', () => {
      const estimate = estimateConversationTokens([])
      expect(estimate.tokens).toBe(0)
    })
  })

  describe('estimateCodeTokens', () => {
    it('should add overhead for code symbols', () => {
      const code = 'function test() { return 42; }'
      const codeEstimate = estimateCodeTokens(code)
      const textEstimate = estimateTokens(code)

      // Code estimate should be higher due to 10% symbol overhead
      expect(codeEstimate.tokens).toBeGreaterThan(textEstimate.tokens)
    })

    it('should handle different languages', () => {
      const js = 'const x = 1;'
      const py = 'x = 1'

      const jsEstimate = estimateCodeTokens(js, 'javascript')
      const pyEstimate = estimateCodeTokens(py, 'python')

      expect(jsEstimate.tokens).toBeGreaterThan(0)
      expect(pyEstimate.tokens).toBeGreaterThan(0)
    })
  })

  describe('calculateBudgetRemaining', () => {
    it('should calculate healthy budget', () => {
      const result = calculateBudgetRemaining(5000, 10000)

      expect(result.remaining).toBe(5000)
      expect(result.percentage).toBe(50)
      expect(result.status).toBe('healthy')
    })

    it('should show warning status', () => {
      const result = calculateBudgetRemaining(8000, 10000)

      expect(result.remaining).toBe(2000)
      expect(result.percentage).toBe(20)
      expect(result.status).toBe('warning')
    })

    it('should show critical status', () => {
      const result = calculateBudgetRemaining(9500, 10000)

      expect(result.remaining).toBe(500)
      expect(result.percentage).toBe(5)
      expect(result.status).toBe('critical')
    })

    it('should handle overflow', () => {
      const result = calculateBudgetRemaining(15000, 10000)

      expect(result.remaining).toBe(0)
      expect(result.percentage).toBeLessThan(0)
      expect(result.status).toBe('critical')
    })
  })

  describe('validateEstimate', () => {
    it('should validate good estimate', () => {
      const result = validateEstimate(100, 105)

      expect(result.error).toBe(5)
      expect(result.errorPercent).toBeCloseTo(4.76, 1)
      expect(result.acceptable).toBe(true)
    })

    it('should reject poor estimate', () => {
      const result = validateEstimate(100, 150)

      expect(result.error).toBe(50)
      expect(result.errorPercent).toBeCloseTo(33.33, 1)
      expect(result.acceptable).toBe(false)
    })

    it('should handle exact match', () => {
      const result = validateEstimate(100, 100)

      expect(result.error).toBe(0)
      expect(result.errorPercent).toBe(0)
      expect(result.acceptable).toBe(true)
    })

    it('should handle underestimate and overestimate equally', () => {
      const under = validateEstimate(90, 100)
      const over = validateEstimate(110, 100)

      expect(under.error).toBe(over.error)
    })
  })

  describe('Golden Fixtures', () => {
    const fixtures = [
      {
        name: 'simple greeting',
        text: 'Hello, how are you today?',
        expected: 7,
        tolerance: 2,
      },
      {
        name: 'code snippet',
        text: 'function add(a, b) { return a + b; }',
        expected: 15,
        tolerance: 3,
      },
      {
        name: 'markdown text',
        text: '# Heading\n\nThis is a paragraph with **bold** and *italic* text.',
        expected: 20,
        tolerance: 4,
      },
      {
        name: 'json data',
        text: '{"name": "John", "age": 30, "city": "New York"}',
        expected: 20,
        tolerance: 5,
      },
    ]

    fixtures.forEach((fixture) => {
      it(`should estimate ${fixture.name} within tolerance`, () => {
        const estimate = estimateTokens(fixture.text)

        expect(Math.abs(estimate.tokens - fixture.expected)).toBeLessThanOrEqual(
          fixture.tolerance
        )
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long text', () => {
      const longText = 'word '.repeat(10000)
      const estimate = estimateTokens(longText)

      expect(estimate.tokens).toBeGreaterThan(10000)
      expect(estimate.tokens).toBeLessThan(20000)
    })

    it('should handle special characters', () => {
      const special = '😀 🎉 ✨ 🚀 💻'
      const estimate = estimateTokens(special)

      expect(estimate.tokens).toBeGreaterThan(0)
    })

    it('should handle unicode text', () => {
      const unicode = '你好世界'
      const estimate = estimateTokens(unicode)

      expect(estimate.tokens).toBeGreaterThan(0)
    })

    it('should handle newlines and whitespace', () => {
      const text = 'Line 1\n\nLine 2\n\n\nLine 3'
      const estimate = estimateTokens(text)

      expect(estimate.tokens).toBeGreaterThan(0)
    })
  })
})
