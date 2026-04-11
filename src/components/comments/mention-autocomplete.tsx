"use client"

import { useEffect, useRef, useState } from "react"
import type { OrgMember } from "@/lib/types/organisations"

interface MentionAutocompleteProps {
  members: OrgMember[]
  filterText: string
  onSelect: (member: OrgMember) => void
  visible: boolean
  onClose: () => void
}

export function MentionAutocomplete({
  members,
  filterText,
  onSelect,
  visible,
  onClose,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = members.filter((m) => {
    const name = m.profiles?.full_name?.toLowerCase() ?? ""
    const email = m.profiles?.email?.toLowerCase() ?? ""
    const filter = filterText.toLowerCase()
    return name.includes(filter) || email.includes(filter)
  })

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  // Keyboard handling (called from parent via event forwarding)
  useEffect(() => {
    if (!visible) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [visible, filtered, selectedIndex, onSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll("[data-mention-item]")
    items[selectedIndex]?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  if (!visible) return null

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-1 z-50 w-64 max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-md"
      role="listbox"
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          No members found
        </div>
      ) : (
        filtered.slice(0, 5).map((member, index) => {
          const name = member.profiles?.full_name || "Unknown"
          const email = member.profiles?.email || ""
          const initials = name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)

          return (
            <button
              key={member.user_id}
              data-mention-item
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => onSelect(member)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/60"
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{name}</p>
                {email && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {email}
                  </p>
                )}
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
