/**
 * @mention parsing and trigger detection utilities.
 *
 * Mention format: @[Display Name](user:uuid)
 * Used in issue comments for collaboration notifications.
 */

/** Regex matching @[Name](user:uuid) mentions */
export const MENTION_REGEX = /@\[([^\]]+)\]\(user:([a-zA-Z0-9-]+)\)/g

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; name: string; userId: string }

/**
 * Parse a content string into an array of text and mention segments.
 * Useful for rendering mentions as styled elements in the UI.
 */
export function parseMentions(content: string): MentionSegment[] {
  if (!content) return []

  const segments: MentionSegment[] = []
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    // Add text before this mention
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'mention', name: match[1], userId: match[2] })
    lastIndex = regex.lastIndex
  }

  // Add remaining text after last mention
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}

/**
 * Extract deduplicated user IDs from all @mentions in a string.
 * Used to determine which users to notify.
 */
export function extractMentionedUserIds(content: string): string[] {
  const regex = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
  const ids = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    ids.add(match[2])
  }

  return Array.from(ids)
}

/**
 * Detect if the user is currently typing an @mention trigger.
 * Returns the filter text after @ (e.g. "dan" for "@dan"), empty string
 * if just "@" typed, or null if no active trigger.
 *
 * Only triggers when @ is preceded by whitespace or is at start of string
 * to avoid false positives on email addresses.
 */
export function detectMentionTrigger(
  value: string,
  cursorPos: number
): string | null {
  // Look at text up to cursor position
  const textBeforeCursor = value.slice(0, cursorPos)
  // Match @ preceded by start-of-string or whitespace, followed by optional word chars
  const triggerMatch = textBeforeCursor.match(/(^|[\s])@(\w*)$/)
  if (!triggerMatch) return null
  return triggerMatch[2]
}

/**
 * Insert a selected mention into the text, replacing the @trigger text.
 * Returns the new text and cursor position after the inserted mention.
 */
export function insertMention(
  value: string,
  cursorPos: number,
  name: string,
  userId: string
): { text: string; cursorPos: number } {
  const textBeforeCursor = value.slice(0, cursorPos)
  const textAfterCursor = value.slice(cursorPos)

  // Find the @ trigger position
  const triggerMatch = textBeforeCursor.match(/(^|[\s])@(\w*)$/)
  if (!triggerMatch) {
    return { text: value, cursorPos }
  }

  // Calculate where the @ starts (account for preceding whitespace/start)
  const prefixChar = triggerMatch[1] // '' or whitespace
  const atStart = textBeforeCursor.length - triggerMatch[0].length + prefixChar.length

  const mention = `@[${name}](user:${userId}) `
  const before = value.slice(0, atStart)
  const newText = before + mention + textAfterCursor
  const newCursorPos = atStart + mention.length

  return { text: newText, cursorPos: newCursorPos }
}
