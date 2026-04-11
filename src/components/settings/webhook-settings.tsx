"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Webhook,
  Copy,
  Check,
  Trash2,
  Plus,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  deleteWebhookEndpoint,
  toggleWebhookEndpoint,
  listWebhookDeliveries,
} from "@/lib/actions/webhooks"
import type { WebhookEndpoint, WebhookDelivery } from "@/lib/types/api-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const AVAILABLE_EVENTS = [
  { value: "validation.completed", label: "Validation Completed" },
  { value: "validation.failed", label: "Validation Failed" },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    delivered: { className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Delivered" },
    failed: { className: "bg-red-50 text-red-700 border-red-200", label: "Failed" },
    pending: { className: "bg-amber-50 text-amber-700 border-amber-200", label: "Pending" },
  }
  const v = variants[status] || variants.pending
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.className}`}>
      {v.label}
    </span>
  )
}

function DeliveryHistory({ endpointId }: { endpointId: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const result = await listWebhookDeliveries(endpointId)
      if ("data" in result) {
        setDeliveries(result.data)
      }
      setLoading(false)
    }
    load()
  }, [endpointId])

  if (loading) {
    return <p className="py-3 text-center text-xs text-muted-foreground">Loading deliveries...</p>
  }

  if (deliveries.length === 0) {
    return <p className="py-3 text-center text-xs text-muted-foreground">No deliveries yet</p>
  }

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Event</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Attempts</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Response</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((d) => (
            <tr key={d.id} className="border-b last:border-0">
              <td className="px-3 py-2 font-mono">{d.event}</td>
              <td className="px-3 py-2">
                <StatusBadge status={d.status} />
              </td>
              <td className="px-3 py-2">{d.attempts}</td>
              <td className="px-3 py-2">{d.response_status ?? "-"}</td>
              <td className="px-3 py-2 text-muted-foreground">{formatDate(d.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function WebhookSettings({ plan }: { plan: string }) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null)
  const [newUrl, setNewUrl] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    AVAILABLE_EVENTS.map((e) => e.value)
  )
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createPending, startCreateTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const [togglePending, startToggleTransition] = useTransition()
  const [, startLoadTransition] = useTransition()

  useEffect(() => {
    loadEndpoints()
  }, [])

  function loadEndpoints() {
    startLoadTransition(async () => {
      const result = await listWebhookEndpoints()
      if ("data" in result) {
        setEndpoints(result.data)
      }
    })
  }

  function handleCreate() {
    startCreateTransition(async () => {
      const result = await createWebhookEndpoint(newUrl, selectedEvents)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setNewSecret(result.secret)
      setNewUrl("")
      setSelectedEvents(AVAILABLE_EVENTS.map((e) => e.value))
      loadEndpoints()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startDeleteTransition(async () => {
      const result = await deleteWebhookEndpoint(deleteTarget.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Webhook endpoint deleted")
      }
      setDeleteOpen(false)
      setDeleteTarget(null)
      loadEndpoints()
    })
  }

  function handleToggle(endpoint: WebhookEndpoint) {
    startToggleTransition(async () => {
      const result = await toggleWebhookEndpoint(endpoint.id, !endpoint.active)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success(endpoint.active ? "Webhook paused" : "Webhook activated")
      }
      loadEndpoints()
    })
  }

  function toggleEvent(eventValue: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventValue)
        ? prev.filter((e) => e !== eventValue)
        : [...prev, eventValue]
    )
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Non-enterprise users see upgrade prompt
  if (plan !== "enterprise") {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50">
              <Webhook className="size-4 text-blue-600" />
            </div>
            Webhooks
          </CardTitle>
          <CardDescription>Receive notifications when validation completes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-muted-foreground/25 px-6 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-50">
              <ShieldAlert className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Enterprise Feature</p>
              <p className="text-xs text-muted-foreground">
                Webhooks are available on the Enterprise plan. Contact sales to upgrade.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50">
                <Webhook className="size-4 text-blue-600" />
              </div>
              Webhooks
            </CardTitle>
            <CardDescription>Receive notifications when validation completes</CardDescription>
          </div>

          {/* Add Endpoint Dialog */}
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open)
              if (!open) {
                setNewSecret(null)
                setNewUrl("")
                setSelectedEvents(AVAILABLE_EVENTS.map((e) => e.value))
                setCopied(false)
              }
            }}
          >
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
                />
              }
            >
              <Plus className="size-4" />
              Add Endpoint
            </DialogTrigger>
            <DialogContent>
              {newSecret ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Webhook Endpoint Created</DialogTitle>
                    <DialogDescription>
                      Save this signing secret. It will only be shown once.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Signing Secret</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all">
                          {newSecret}
                        </code>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="shrink-0 rounded-lg"
                          onClick={() => copyToClipboard(newSecret)}
                        >
                          {copied ? (
                            <Check className="size-4 text-emerald-500" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-800">
                        This secret will only be shown once. Use it to verify webhook signatures via the X-TruQC-Signature header.
                      </p>
                    </div>
                  </div>
                  <DialogFooter showCloseButton />
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Add Webhook Endpoint</DialogTitle>
                    <DialogDescription>
                      Enter the URL that will receive webhook notifications.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="webhook-url">Endpoint URL</Label>
                      <Input
                        id="webhook-url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        placeholder="https://example.com/webhooks/truqc"
                        className="rounded-xl"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Events</Label>
                      <div className="space-y-2">
                        {AVAILABLE_EVENTS.map((evt) => (
                          <label
                            key={evt.value}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedEvents.includes(evt.value)}
                              onChange={() => toggleEvent(evt.value)}
                              className="rounded border-gray-300"
                            />
                            {evt.label}
                            <code className="ml-auto text-xs text-muted-foreground">
                              {evt.value}
                            </code>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
                      disabled={createPending || !newUrl.trim() || selectedEvents.length === 0}
                      onClick={handleCreate}
                    >
                      {createPending ? "Creating..." : "Create Endpoint"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No webhook endpoints yet. Add one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {endpoints.map((ep) => {
              const isExpanded = expandedId === ep.id
              return (
                <div key={ep.id} className="rounded-xl border">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : ep.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium font-mono max-w-[300px]">
                            {ep.url}
                          </p>
                          <Badge
                            variant={ep.active ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {ep.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {ep.events.map((evt) => (
                            <Badge key={evt} variant="outline" className="text-[10px]">
                              {evt}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        disabled={togglePending}
                        onClick={() => handleToggle(ep)}
                      >
                        {ep.active ? "Pause" : "Activate"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget(ep)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-3 pb-3">
                      <p className="pt-2 text-xs font-medium text-muted-foreground">Delivery History</p>
                      <DeliveryHistory endpointId={ep.id} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Webhook Endpoint</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this endpoint? All delivery history will be lost.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={deletePending}
                onClick={handleDelete}
              >
                {deletePending ? "Deleting..." : "Delete Endpoint"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
