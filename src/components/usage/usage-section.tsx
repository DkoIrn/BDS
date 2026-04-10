"use client"

import { useEffect, useState } from "react"
import { BarChart3, FolderOpen, Shield, HardDrive } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getUsageData, type UsageResponse } from "@/lib/actions/usage"
import { formatStorageSize } from "@/lib/usage"

// Map DB plan values to display names
const planDisplayName: Record<string, string> = {
  free: "Free Trial",
  pro: "Pro",
  max: "Max",
  enterprise: "Enterprise",
}

function getBarColor(current: number, max: number): string {
  const pct = (current / max) * 100
  if (pct >= 100) return "bg-red-500"
  if (pct >= 80) return "bg-amber-500"
  return "bg-teal-500"
}

function getBarTrackColor(current: number, max: number): string {
  const pct = (current / max) * 100
  if (pct >= 100) return "bg-red-100"
  if (pct >= 80) return "bg-amber-100"
  return "bg-teal-100"
}

interface UsageBarProps {
  icon: React.ReactNode
  label: string
  current: string
  max: string | null
  currentNum: number
  maxNum: number | null
}

function UsageBar({ icon, label, current, max, currentNum, maxNum }: UsageBarProps) {
  if (maxNum === null) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{label}</span>
            <span className="text-sm text-muted-foreground">{current} / Unlimited</span>
          </div>
          <p className="mt-1 text-xs text-teal-600 font-medium">Unlimited</p>
        </div>
      </div>
    )
  }

  const pct = Math.min((currentNum / maxNum) * 100, 100)

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">
            {current} / {max}
          </span>
        </div>
        <div className={`mt-1.5 h-2 w-full overflow-hidden rounded-full ${getBarTrackColor(currentNum, maxNum)}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(currentNum, maxNum)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function UsageSection() {
  const [data, setData] = useState<UsageResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      const result = await getUsageData()
      if (result.data) {
        setData(result.data)
      }
      setLoading(false)
    }
    fetchUsage()
  }, [])

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-teal-50">
            <BarChart3 className="size-4 text-teal-600" />
          </div>
          Usage
        </CardTitle>
        <CardDescription>
          {data
            ? `Usage on your ${planDisplayName[data.plan] ?? data.plan} plan`
            : "Loading usage data..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          </>
        ) : data ? (
          <>
            <UsageBar
              icon={<FolderOpen className="size-4 text-teal-600" />}
              label="Projects"
              current={String(data.projectCount)}
              max={data.limits.maxProjects !== null ? String(data.limits.maxProjects) : null}
              currentNum={data.projectCount}
              maxNum={data.limits.maxProjects}
            />
            <UsageBar
              icon={<Shield className="size-4 text-teal-600" />}
              label="QC Checks this month"
              current={String(data.qcCheckCount)}
              max={data.limits.maxQcChecksPerMonth !== null ? String(data.limits.maxQcChecksPerMonth) : null}
              currentNum={data.qcCheckCount}
              maxNum={data.limits.maxQcChecksPerMonth}
            />
            <UsageBar
              icon={<HardDrive className="size-4 text-teal-600" />}
              label="Storage"
              current={formatStorageSize(data.storageBytes)}
              max={data.limits.maxStorageBytes !== null ? formatStorageSize(data.limits.maxStorageBytes) : null}
              currentNum={data.storageBytes}
              maxNum={data.limits.maxStorageBytes}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to load usage data.</p>
        )}
      </CardContent>
    </Card>
  )
}
