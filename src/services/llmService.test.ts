import { describe, it, expect } from 'vitest'
import { estimateTokens, LlmError } from './llmService'

describe('estimateTokens', () => {
  it('estimates tokens as ceiling of chars / 4', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('hello world')).toBe(3) // 11 chars -> ceil(11/4) = 3
  })

  it('handles long text correctly', () => {
    const longText = 'a'.repeat(10000)
    expect(estimateTokens(longText)).toBe(2500)
  })

  it('handles text with special characters', () => {
    const xmlText = '<agentSystem xmlns="https://agent-diagram.app/schema/v1">'
    expect(estimateTokens(xmlText)).toBe(Math.ceil(xmlText.length / 4))
  })

  it('handles unicode characters', () => {
    // Unicode chars may be multi-byte but .length in JS counts UTF-16 code units
    const unicodeText = 'Hello 世界'
    expect(estimateTokens(unicodeText)).toBe(Math.ceil(unicodeText.length / 4))
  })
})

describe('LlmError', () => {
  it('creates error with code', () => {
    const err = new LlmError('Monthly limit', 'MONTHLY_LIMIT_EXCEEDED')
    expect(err.message).toBe('Monthly limit')
    expect(err.code).toBe('MONTHLY_LIMIT_EXCEEDED')
    expect(err.name).toBe('LlmError')
    expect(err.usage).toBeUndefined()
  })

  it('creates error with usage info', () => {
    const usage = {
      monthlyUsed: 300,
      monthlyLimit: 300,
      dailyUsed: 50,
      dailyLimit: 250,
    }
    const err = new LlmError('Quota exceeded', 'MONTHLY_LIMIT_EXCEEDED', usage)
    expect(err.usage).toEqual(usage)
    expect(err.usage?.monthlyUsed).toBe(300)
  })

  it('is an instance of Error', () => {
    const err = new LlmError('test', 'GENERATION_FAILED')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(LlmError)
  })
})
