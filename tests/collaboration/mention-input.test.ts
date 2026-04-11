import { describe, it, expect } from 'vitest'
import { detectMentionTrigger, insertMention, parseMentions } from '@/lib/utils/mentions'

describe('MentionInput logic', () => {
  describe('detectMentionTrigger', () => {
    it('detects @ at start of string', () => {
      expect(detectMentionTrigger('@', 1)).toBe('')
    })

    it('detects @ with partial text', () => {
      expect(detectMentionTrigger('@dan', 4)).toBe('dan')
    })

    it('detects @ after space', () => {
      expect(detectMentionTrigger('hello @ja', 9)).toBe('ja')
    })

    it('returns null when no trigger', () => {
      expect(detectMentionTrigger('hello world', 11)).toBeNull()
    })

    it('returns null for email addresses', () => {
      expect(detectMentionTrigger('user@example', 12)).toBeNull()
    })
  })

  describe('insertMention', () => {
    it('inserts mention at @ trigger position', () => {
      const result = insertMention('@dan', 4, 'Daniel Smith', 'user-123')
      expect(result.text).toBe('@[Daniel Smith](user:user-123) ')
      expect(result.cursorPos).toBe(31)
    })

    it('inserts mention in middle of text', () => {
      const result = insertMention('hello @ja world', 9, 'Jane Doe', 'user-456')
      expect(result.text).toBe('hello @[Jane Doe](user:user-456)  world')
    })

    it('preserves text after cursor', () => {
      const result = insertMention('hey @d more text', 6, 'Dan', 'user-1')
      expect(result.text).toContain('more text')
      expect(result.text).toContain('@[Dan](user:user-1)')
    })
  })

  describe('parseMentions for rendering', () => {
    it('parses mention into segments', () => {
      const segments = parseMentions('Hello @[Jane](user:u1) how are you?')
      expect(segments).toHaveLength(3)
      expect(segments[0]).toEqual({ type: 'text', value: 'Hello ' })
      expect(segments[1]).toEqual({ type: 'mention', name: 'Jane', userId: 'u1' })
      expect(segments[2]).toEqual({ type: 'text', value: ' how are you?' })
    })

    it('handles multiple mentions', () => {
      const segments = parseMentions('@[A](user:1) and @[B](user:2)')
      const mentions = segments.filter(s => s.type === 'mention')
      expect(mentions).toHaveLength(2)
    })

    it('handles text with no mentions', () => {
      const segments = parseMentions('Just plain text')
      expect(segments).toHaveLength(1)
      expect(segments[0]).toEqual({ type: 'text', value: 'Just plain text' })
    })

    it('handles empty string', () => {
      expect(parseMentions('')).toEqual([])
    })
  })
})
