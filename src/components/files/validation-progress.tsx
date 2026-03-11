"use client"

import { Loader2 } from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

interface ValidationProgressProps {
  statusText: string
}

export function ValidationProgress({ statusText }: ValidationProgressProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          {statusText}
        </p>
      </CardContent>
    </Card>
  )
}
