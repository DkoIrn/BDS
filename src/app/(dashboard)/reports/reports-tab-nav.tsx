"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { FileText, ShieldCheck } from "lucide-react"

const tabs = [
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Certificates", href: "/reports/certificates", icon: ShieldCheck },
]

export function ReportsTabNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 border-b">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/reports"
            ? pathname === "/reports"
            : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="size-4" />
            {tab.name}
          </Link>
        )
      })}
    </div>
  )
}
