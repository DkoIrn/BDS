"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Key, Copy, Check, Trash2, Plus, ShieldAlert } from "lucide-react"
import { generateApiKey, listApiKeys, revokeApiKey } from "@/lib/actions/api-keys"
import type { ApiKey } from "@/lib/types/api-keys"
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never"
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function ApiKeysSection({ plan }: { plan: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [generateOpen, setGenerateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [keyName, setKeyName] = useState("")
  const [newRawKey, setNewRawKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generatePending, startGenerateTransition] = useTransition()
  const [revokePending, startRevokeTransition] = useTransition()
  const [loadPending, startLoadTransition] = useTransition()

  useEffect(() => {
    loadKeys()
  }, [])

  function loadKeys() {
    startLoadTransition(async () => {
      const result = await listApiKeys()
      if ("data" in result) {
        setKeys(result.data)
      }
    })
  }

  function handleGenerate() {
    startGenerateTransition(async () => {
      const result = await generateApiKey(keyName)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setNewRawKey(result.key)
      setKeyName("")
      loadKeys()
    })
  }

  function handleRevoke() {
    if (!revokeTarget) return
    startRevokeTransition(async () => {
      const result = await revokeApiKey(revokeTarget.id)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("API key revoked")
      }
      setRevokeOpen(false)
      setRevokeTarget(null)
      loadKeys()
    })
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
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50">
              <Key className="size-4 text-violet-600" />
            </div>
            API Keys
          </CardTitle>
          <CardDescription>Manage programmatic access to TruQC</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-muted-foreground/25 px-6 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-50">
              <ShieldAlert className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Enterprise Feature</p>
              <p className="text-xs text-muted-foreground">
                API access is available on the Enterprise plan. Contact sales to upgrade.
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
              <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50">
                <Key className="size-4 text-violet-600" />
              </div>
              API Keys
            </CardTitle>
            <CardDescription>Manage programmatic access to TruQC</CardDescription>
          </div>

          {/* Generate Key Dialog */}
          <Dialog
            open={generateOpen}
            onOpenChange={(open) => {
              setGenerateOpen(open)
              if (!open) {
                setNewRawKey(null)
                setKeyName("")
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
              Generate New Key
            </DialogTrigger>
            <DialogContent>
              {newRawKey ? (
                <>
                  <DialogHeader>
                    <DialogTitle>API Key Created</DialogTitle>
                    <DialogDescription>
                      This key will only be shown once. Copy it now.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all">
                        {newRawKey}
                      </code>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0 rounded-lg"
                        onClick={() => copyToClipboard(newRawKey)}
                      >
                        {copied ? (
                          <Check className="size-4 text-emerald-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-800">
                        Store this key securely. You will not be able to see it again.
                      </p>
                    </div>
                  </div>
                  <DialogFooter showCloseButton />
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Generate New API Key</DialogTitle>
                    <DialogDescription>
                      Give your key a name to identify it later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g. Production API"
                      className="rounded-xl"
                      autoFocus
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
                      disabled={generatePending || !keyName.trim()}
                      onClick={handleGenerate}
                    >
                      {generatePending ? "Generating..." : "Generate Key"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No API keys yet. Generate one to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => {
              const isRevoked = !!k.revoked_at
              return (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Key className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{k.name}</p>
                        <Badge
                          variant={isRevoked ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {isRevoked ? "Revoked" : "Active"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <code className="font-mono">{k.key_prefix}...</code>
                        <span>Created {formatDate(k.created_at)}</span>
                        <span>Last used {formatDate(k.last_used_at)}</span>
                      </div>
                    </div>
                  </div>
                  {!isRevoked && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setRevokeTarget(k)
                        setRevokeOpen(true)
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Revoke Confirmation Dialog */}
        <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Revoke API Key</DialogTitle>
              <DialogDescription>
                Are you sure you want to revoke &quot;{revokeTarget?.name}&quot;?
                Any applications using this key will lose access immediately.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                className="rounded-xl"
                disabled={revokePending}
                onClick={handleRevoke}
              >
                {revokePending ? "Revoking..." : "Revoke Key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
