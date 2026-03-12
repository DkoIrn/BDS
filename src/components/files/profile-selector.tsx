"use client"

import { useState } from "react"
import { Settings2, Save, Pencil, Trash2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThresholdEditor } from "@/components/files/threshold-editor"
import { DEFAULT_TEMPLATES, getTemplateById } from "@/lib/validation/templates"
import type { ProfileConfig, ValidationProfile } from "@/lib/types/validation"

interface ProfileSelectorProps {
  selectedProfileId: string
  onProfileChange: (id: string, config: ProfileConfig) => void
  userProfiles: ValidationProfile[]
  onSaveProfile: (name: string, config: ProfileConfig) => Promise<void>
  onUpdateProfile: (
    id: string,
    name: string,
    config: ProfileConfig
  ) => Promise<void>
  onDeleteProfile: (id: string) => Promise<void>
  mappedColumnTypes: string[]
  currentConfig: ProfileConfig
  onConfigChange: (config: ProfileConfig) => void
  onReset: () => void
  configErrors: Record<string, string>
}

export function ProfileSelector({
  selectedProfileId,
  onProfileChange,
  userProfiles,
  onSaveProfile,
  onUpdateProfile,
  onDeleteProfile,
  mappedColumnTypes,
  currentConfig,
  onConfigChange,
  onReset,
  configErrors,
}: ProfileSelectorProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [saveMode, setSaveMode] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  function handleProfileSelect(value: string) {
    // Resolve config from template or user profile
    const template = getTemplateById(value)
    if (template) {
      onProfileChange(value, { ...template.config })
      return
    }
    const profile = userProfiles.find((p) => p.id === value)
    if (profile) {
      onProfileChange(value, { ...profile.config })
    }
  }

  async function handleSaveAsProfile() {
    if (!saveName.trim()) {
      toast.error("Enter a profile name")
      return
    }
    setSaving(true)
    try {
      await onSaveProfile(saveName.trim(), currentConfig)
      setSaveMode(false)
      setSaveName("")
      toast.success(`Profile "${saveName.trim()}" saved`)
    } catch {
      toast.error("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateProfile() {
    if (!editingProfileId || !editName.trim()) return
    setSaving(true)
    try {
      await onUpdateProfile(editingProfileId, editName.trim(), currentConfig)
      setEditingProfileId(null)
      setEditName("")
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProfile(id: string) {
    try {
      await onDeleteProfile(id)
      setDeleteConfirmId(null)
      toast.success("Profile deleted")
    } catch {
      toast.error("Failed to delete profile")
    }
  }

  function startEditing(profile: ValidationProfile) {
    setEditingProfileId(profile.id)
    setEditName(profile.name)
    onProfileChange(profile.id, { ...profile.config })
    setCustomizeOpen(true)
  }

  const selectedLabel =
    getTemplateById(selectedProfileId)?.name ??
    userProfiles.find((p) => p.id === selectedProfileId)?.name ??
    "Select profile"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select
            value={selectedProfileId}
            onValueChange={(val) => { if (val) handleProfileSelect(val) }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select validation profile">
                {selectedLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>DEFAULTS</SelectLabel>
                {DEFAULT_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {userProfiles.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>MY PROFILES</SelectLabel>
                    {userProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant={customizeOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setCustomizeOpen(!customizeOpen)}
        >
          <Settings2 className="mr-1.5 size-3.5" />
          Customize
        </Button>
      </div>

      {/* User profile actions row */}
      {userProfiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {userProfiles.map((p) => (
            <div key={p.id} className="flex items-center gap-0.5">
              {deleteConfirmId === p.id ? (
                <div className="flex items-center gap-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 dark:border-red-600 dark:bg-red-950/30">
                  <span className="text-xs text-red-700 dark:text-red-300">
                    Delete &quot;{p.name}&quot;?
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteProfile(p.id)}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    onClick={() => startEditing(p)}
                    title={`Edit ${p.name}`}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-red-500"
                    onClick={() => setDeleteConfirmId(p.id)}
                    title={`Delete ${p.name}`}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Threshold Editor */}
      {customizeOpen && (
        <ThresholdEditor
          config={currentConfig}
          onChange={onConfigChange}
          mappedColumnTypes={mappedColumnTypes}
          onReset={onReset}
          errors={configErrors}
        />
      )}

      {/* Save / Update actions */}
      {customizeOpen && (
        <div className="flex items-center gap-2">
          {editingProfileId ? (
            <>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 max-w-48 text-xs"
                placeholder="Profile name"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleUpdateProfile}
                disabled={saving || !editName.trim()}
              >
                <Save className="mr-1.5 size-3.5" />
                Update
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditingProfileId(null)}
              >
                <X className="mr-1.5 size-3.5" />
                Cancel
              </Button>
            </>
          ) : saveMode ? (
            <>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-8 max-w-48 text-xs"
                placeholder="Profile name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAsProfile()
                }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAsProfile}
                disabled={saving || !saveName.trim()}
              >
                <Save className="mr-1.5 size-3.5" />
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSaveMode(false)
                  setSaveName("")
                }}
              >
                <X className="mr-1.5 size-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveMode(true)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Save as Profile
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
