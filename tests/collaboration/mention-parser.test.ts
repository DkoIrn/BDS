import { describe, it, expect } from 'vitest'
import { parseMentions, extractMentionedUserIds, MENTION_REGEX } from '@/lib/utils/mentions'

describe('MENTION_REGEX', () => {
  it('matches @[Name](user:uuid) pattern', () => {
    const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
    const match = regex.exec('@[Daniel](user:abc-123)')
    expect(match).not.toBeNull()
    expect(match![1]).toBe('Daniel')
    expect(match![2]).toBe('abc-123')
  })

  it('matches multiple mentions in a string', () => {
    const content = '@[A](user:1) and @[B](user:2)'
    const matches = [...content.matchAll(new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags))]
    expect(matches).toHaveLength(2)
  })
})

describe('parseMentions', () => {
  it('returns text and mention segments for mixed content', () => {
    const result = parseMentions('Hey @[Daniel](user:abc-123), check this')
    expect(result).toEqual([
      { type: 'text', value: 'Hey ' },
      { type: 'mention', name: 'Daniel', userId: 'abc-123' },
      { type: 'text', value: ', check this' },
    ])
  })

  it('returns single text segment when no mentions', () => {
    const result = parseMentions('No mentions here')
    expect(result).toEqual([
      { type: 'text', value: 'No mentions here' },
    ])
  })

  it('handles multiple mentions with text between', () => {
    const result = parseMentions('@[A](user:1) and @[B](user:2)')
    expect(result).toEqual([
      { type: 'mention', name: 'A', userId: '1' },
      { type: 'text', value: ' and ' },
      { type: 'mention', name: 'B', userId: '2' },
    ])
  })

  it('returns empty array for empty string', () => {
    const result = parseMentions('')
    expect(result).toEqual([])
  })

  it('handles mention at start of string', () => {
    const result = parseMentions('@[Alice](user:uuid-1) hello')
    expect(result).toEqual([
      { type: 'mention', name: 'Alice', userId: 'uuid-1' },
      { type: 'text', value: ' hello' },
    ])
  })

  it('handles mention at end of string', () => {
    const result = parseMentions('hello @[Bob](user:uuid-2)')
    expect(result).toEqual([
      { type: 'text', value: 'hello ' },
      { type: 'mention', name: 'Bob', userId: 'uuid-2' },
    ])
  })
})

describe('extractMentionedUserIds', () => {
  it('extracts unique user IDs from mentions', () => {
    const result = extractMentionedUserIds('@[A](user:id1) @[A](user:id1) @[B](user:id2)')
    expect(result).toEqual(['id1', 'id2'])
  })

  it('returns empty array when no mentions', () => {
    const result = extractMentionedUserIds('No mentions')
    expect(result).toEqual([])
  })

  it('extracts single user ID', () => {
    const result = extractMentionedUserIds('Hey @[Daniel](user:abc-123)')
    expect(result).toEqual(['abc-123'])
  })
})
