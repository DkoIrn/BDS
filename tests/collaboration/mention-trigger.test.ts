import { describe, it, expect } from 'vitest'
import { detectMentionTrigger, insertMention } from '@/lib/utils/mentions'

describe('detectMentionTrigger', () => {
  it('returns filter text after @ with preceding whitespace', () => {
    const result = detectMentionTrigger('Hello @dan', 10)
    expect(result).toBe('dan')
  })

  it('returns empty string when @ is at cursor with no filter', () => {
    const result = detectMentionTrigger('Hello @', 7)
    expect(result).toBe('')
  })

  it('returns null when no @ trigger', () => {
    const result = detectMentionTrigger('Hello world', 11)
    expect(result).toBeNull()
  })

  it('returns null when @ is preceded by non-whitespace (email)', () => {
    const result = detectMentionTrigger('email@test', 10)
    expect(result).toBeNull()
  })

  it('returns filter when @ is at start of string', () => {
    const result = detectMentionTrigger('@dan', 4)
    expect(result).toBe('dan')
  })

  it('returns empty string when @ is at very start with no filter', () => {
    const result = detectMentionTrigger('@', 1)
    expect(result).toBe('')
  })

  it('returns null when cursor is before the @', () => {
    const result = detectMentionTrigger('Hello @dan', 3)
    expect(result).toBeNull()
  })
})

describe('insertMention', () => {
  it('replaces @filtertext with mention markup', () => {
    const result = insertMention('Hello @dan', 10, 'Daniel', 'uuid-123')
    expect(result.text).toBe('Hello @[Daniel](user:uuid-123) ')
    expect(result.cursorPos).toBe(31)
  })

  it('replaces @filtertext at start of string', () => {
    const result = insertMention('@dan hello', 4, 'Daniel', 'uuid-123')
    expect(result.text).toBe('@[Daniel](user:uuid-123)  hello')
    expect(result.cursorPos).toBe(25)
  })

  it('replaces empty @ trigger', () => {
    const result = insertMention('Hello @', 7, 'Daniel', 'uuid-123')
    expect(result.text).toBe('Hello @[Daniel](user:uuid-123) ')
    expect(result.cursorPos).toBe(31)
  })
})
