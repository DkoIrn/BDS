"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, LogOut, Settings } from "lucide-react"
import { logout } from "@/lib/actions/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

interface TopBarProps {
  user: {
    email: string
    fullName: string | null
  }
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  return email[0].toUpperCase()
}

/** Map pathname to a human-readable page name for breadcrumbs */
function getPageName(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "Dashboard"

  const routeNames: Record<string, string> = {
    dashboard: "Dashboard",
    projects: "Projects",
    pipeline: "Pipeline",
    reports: "Reports",
    settings: "Settings",
    tools: "Tools",
  }

  const toolNames: Record<string, string> = {
    convert: "Convert",
    visualize: "Visualize",
    transform: "Transform",
    compare: "Compare",
  }

  // Use the first segment for the primary page name
  const primary = routeNames[segments[0]] || segments[0]

  // Show tool sub-page name
  if (segments[0] === "tools" && segments[1]) {
    return toolNames[segments[1]] || segments[1]
  }

  // If there are deeper segments (e.g., /projects/[id]/jobs/[id]),
  // just show the primary route name
  return primary
}

export function TopBar({ user }: TopBarProps) {
  const pathname = usePathname()
  const pageName = getPageName(pathname)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      {/* Left side: sidebar trigger + separator + breadcrumbs */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{pageName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right side: notification bell + user dropdown */}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled className="opacity-40">
          <Bell className="size-4" />
          <span className="sr-only">Notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user.fullName, user.email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
