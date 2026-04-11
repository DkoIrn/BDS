"use client"

import { useCallback, useRef, useState } from "react"
import { detectMentionTrigger, insertMention } from "@/lib/utils/mentions"
import { MentionAutocomplete } from "./mention-autocomplete"
import type { OrgMember } from "@/lib/types/organisations"

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  members: OrgMember[]
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Add a comment...",
  disabled = false,
  members,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [filterText, setFilterText] = useState("")

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      const cursorPos = e.target.selectionStart ?? newValue.length
      onChange(newValue)

      const trigger = detectMentionTrigger(newValue, cursorPos)
      if (trigger !== null) {
        setShowAutocomplete(true)
        setFilterText(trigger)
      } else {
        setShowAutocomplete(false)
        setFilterText("")
      }
    },
    [onChange]
  )

  const handleSelect = useCallback(
    (member: OrgMember) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const cursorPos = textarea.selectionStart ?? value.length
      const name = member.profiles?.full_name || "Unknown"
      const result = insertMention(value, cursorPos, name, member.user_id)

      onChange(result.text)
      setShowAutocomplete(false)
      setFilterText("")

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(result.cursorPos, result.cursorPos)
      })
    },
    [value, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // When autocomplete visible, let it handle arrow/enter/escape
      if (showAutocomplete) {
        if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
          return // handled by MentionAutocomplete's global listener
        }
      }

      // Submit on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSubmit()
      }
    },
    [showAutocomplete, onSubmit]
  )

  return (
    <div className="relative flex-1">
      <MentionAutocomplete
        members={members}
        filterText={filterText}
        onSelect={handleSelect}
        visible={showAutocomplete}
        onClose={() => setShowAutocomplete(false)}
      />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      />
    </div>
  )
}
