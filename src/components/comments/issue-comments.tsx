"use client"

import { useEffect, useState, useTransition } from "react"
import { MessageSquare, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addComment, getIssueComments, deleteComment } from "@/lib/actions/comments"
import type { IssueComment } from "@/lib/types/organisations"

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

interface IssueCommentsProps {
  issueId: string
  currentUserId: string
}

export function IssueComments({ issueId, currentUserId }: IssueCommentsProps) {
  const [comments, setComments] = useState<IssueComment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getIssueComments(issueId).then((data) => {
      if (!cancelled) {
        setComments(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [issueId])

  function handleAdd() {
    if (!content.trim()) return
    const optimistic: IssueComment = {
      id: `temp-${Date.now()}`,
      issue_id: issueId,
      user_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { full_name: "You" },
    }
    setComments((prev) => [...prev, optimistic])
    const text = content.trim()
    setContent("")

    startTransition(async () => {
      const result = await addComment(issueId, text)
      if ("success" in result) {
        setComments((prev) =>
          prev.map((c) => (c.id === optimistic.id ? result.comment : c))
        )
      } else {
        // Remove optimistic on failure
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
      }
    })
  }

  function handleDelete(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    startTransition(async () => {
      const result = await deleteComment(commentId)
      if ("error" in result) {
        // Refetch on failure
        const data = await getIssueComments(issueId)
        setComments(data)
      }
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
      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No comments yet. Be the first to comment.
        </p>
      )}

      {comments.map((comment) => (
        <div
          key={comment.id}
          className="group flex items-start gap-2 rounded-lg border bg-card p-2.5"
        >
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
            <p className="mt-0.5 text-xs text-foreground/80 whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
          {comment.user_id === currentUserId && (
            <button
              onClick={() => handleDelete(comment.id)}
              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              title="Delete comment"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      ))}

      {/* Add comment form */}
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleAdd()
            }
          }}
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
