"use client"

import { useEffect, useState, useTransition } from "react"
import {
  MessageSquare,
  Trash2,
  Send,
  Check,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  addComment,
  getIssueComments,
  deleteComment,
  resolveComment,
  reopenComment,
} from "@/lib/actions/comments"
import { getTeamMembers } from "@/lib/actions/team"
import { parseMentions } from "@/lib/utils/mentions"
import { MentionInput } from "./mention-input"
import type { IssueComment } from "@/lib/types/organisations"
import type { OrgMember } from "@/lib/types/organisations"

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return "just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/** Renders comment content with @mention blue pills */
function CommentContent({ content }: { content: string }) {
  const segments = parseMentions(content)

  return (
    <p className="mt-0.5 text-xs text-foreground/80 whitespace-pre-wrap">
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            className="inline-flex items-center bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded px-1 py-0.5 text-[10px] font-medium"
          >
            @{seg.name}
          </span>
        )
      )}
    </p>
  )
}

interface IssueCommentsProps {
  issueId: string
  currentUserId: string
}

export function IssueComments({ issueId, currentUserId }: IssueCommentsProps) {
  const [comments, setComments] = useState<IssueComment[]>([])
  const [allComments, setAllComments] = useState<IssueComment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()
  const [showResolved, setShowResolved] = useState(false)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [expandedResolved, setExpandedResolved] = useState<Set<string>>(
    new Set()
  )

  // Fetch comments and members on mount
  useEffect(() => {
    let cancelled = false

    Promise.all([
      getIssueComments(issueId, "all"),
      getTeamMembers(),
    ]).then(([commentsData, teamResult]) => {
      if (cancelled) return
      setAllComments(commentsData)
      setComments(commentsData.filter((c) => !c.resolved_at))
      if ("data" in teamResult) {
        setMembers(teamResult.data)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [issueId])

  // Filter comments based on showResolved toggle
  const displayComments = showResolved
    ? allComments
    : allComments.filter((c) => !c.resolved_at)

  const resolvedCount = allComments.filter((c) => c.resolved_at).length

  function handleAdd() {
    if (!content.trim()) return
    const optimistic: IssueComment = {
      id: `temp-${Date.now()}`,
      issue_id: issueId,
      user_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
      resolved_by: null,
      profiles: { full_name: "You" },
    }
    setAllComments((prev) => [...prev, optimistic])
    const text = content.trim()
    setContent("")

    startTransition(async () => {
      const result = await addComment(issueId, text)
      if ("success" in result) {
        setAllComments((prev) =>
          prev.map((c) => (c.id === optimistic.id ? result.comment : c))
        )
      } else {
        setAllComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      }
    })
  }

  function handleDelete(commentId: string) {
    setAllComments((prev) => prev.filter((c) => c.id !== commentId))
    startTransition(async () => {
      const result = await deleteComment(commentId)
      if ("error" in result) {
        const data = await getIssueComments(issueId, "all")
        setAllComments(data)
      }
    })
  }

  function handleResolve(commentId: string) {
    // Optimistic update
    setAllComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              resolved_at: new Date().toISOString(),
              resolved_by: currentUserId,
              resolved_by_name: "You",
            }
          : c
      )
    )

    startTransition(async () => {
      const result = await resolveComment(commentId)
      if ("error" in result) {
        const data = await getIssueComments(issueId, "all")
        setAllComments(data)
      }
    })
  }

  function handleReopen(commentId: string) {
    // Optimistic update
    setAllComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, resolved_at: null, resolved_by: null, resolved_by_name: null }
          : c
      )
    )

    startTransition(async () => {
      const result = await reopenComment(commentId)
      if ("error" in result) {
        const data = await getIssueComments(issueId, "all")
        setAllComments(data)
      }
    })
  }

  function toggleExpandResolved(commentId: string) {
    setExpandedResolved((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">Loading comments...</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Show resolved toggle */}
      {resolvedCount > 0 && (
        <button
          onClick={() => setShowResolved(!showResolved)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {showResolved ? (
            <EyeOff className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
          {showResolved
            ? "Hide resolved"
            : `Show resolved (${resolvedCount})`}
        </button>
      )}

      {displayComments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No comments yet. Be the first to comment.
        </p>
      )}

      {displayComments.map((comment) => {
        const isResolved = !!comment.resolved_at
        const isExpanded = expandedResolved.has(comment.id)

        if (isResolved && !isExpanded) {
          // Collapsed resolved comment
          return (
            <button
              key={comment.id}
              onClick={() => toggleExpandResolved(comment.id)}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-2.5 text-left transition-colors hover:bg-muted/50 cursor-pointer"
            >
              <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
              <Check className="size-3 shrink-0 text-emerald-500" />
              <span className="text-[10px] text-muted-foreground truncate">
                {comment.resolved_by_name || "Someone"} resolved this{" "}
                {comment.resolved_at && `- ${relativeTime(comment.resolved_at)}`}
              </span>
            </button>
          )
        }

        // Regular or expanded resolved comment
        return (
          <div
            key={comment.id}
            className={`group rounded-lg border p-2.5 ${
              isResolved
                ? "border-dashed bg-muted/30"
                : "bg-card"
            }`}
          >
            {isResolved && (
              <button
                onClick={() => toggleExpandResolved(comment.id)}
                className="flex items-center gap-1 mb-2 text-[10px] text-emerald-600 dark:text-emerald-400 cursor-pointer"
              >
                <ChevronDown className="size-3" />
                <Check className="size-3" />
                <span>
                  Resolved by {comment.resolved_by_name || "Someone"}{" "}
                  {comment.resolved_at && `- ${relativeTime(comment.resolved_at)}`}
                </span>
              </button>
            )}

            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {comment.profiles?.full_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(comment.created_at)}
                  </span>
                </div>
                <CommentContent content={comment.content} />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-0.5 shrink-0">
                {isResolved ? (
                  <button
                    onClick={() => handleReopen(comment.id)}
                    className="rounded p-1 text-muted-foreground transition-opacity hover:bg-amber-500/10 hover:text-amber-600 cursor-pointer"
                    title="Reopen comment"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleResolve(comment.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-emerald-500/10 hover:text-emerald-600 group-hover:opacity-100 cursor-pointer"
                    title="Resolve comment"
                  >
                    <Check className="size-3" />
                  </button>
                )}
                {comment.user_id === currentUserId && !isResolved && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 cursor-pointer"
                    title="Delete comment"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Add comment form */}
      <div className="flex items-end gap-2">
        <MentionInput
          value={content}
          onChange={setContent}
          onSubmit={handleAdd}
          members={members}
          disabled={isPending}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!content.trim() || isPending}
          className="h-8 gap-1.5 rounded-lg px-3 text-xs"
        >
          <Send className="size-3" />
          Post
        </Button>
      </div>
    </div>
  )
}
