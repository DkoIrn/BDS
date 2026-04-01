"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  ArrowRightLeft,
  Map,
  Wrench,
  GitCompareArrows,
  Workflow,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  User,
} from "lucide-react"
import { logout } from "@/lib/actions/auth"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const mainNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderOpen },
  { title: "Pipeline", href: "/pipeline", icon: Workflow },
  { title: "Reports", href: "/reports", icon: BarChart3 },
]

const toolsNav = [
  { title: "Convert", href: "/tools/convert", icon: ArrowRightLeft },
  { title: "Visualize", href: "/tools/visualize", icon: Map },
  { title: "Transform", href: "/tools/transform", icon: Wrench },
  { title: "Compare", href: "/tools/compare", icon: GitCompareArrows },
]

interface TopNavbarProps {
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

export function TopNavbar({ user }: TopNavbarProps) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const isToolsActive = pathname.startsWith("/tools")

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 items-center gap-6 px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.png"
            alt="DataFlow"
            width={28}
            height={28}
            className="rounded-lg"
          />
          <span className="text-sm font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-heading), sans-serif" }}>
            DataFlow
          </span>
        </Link>

        {/* Main nav */}
        <nav className="flex items-center gap-1">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <item.icon className="size-3.5" />
              {item.title}
            </Link>
          ))}

          {/* Tools dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none ${
                isToolsActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Wrench className="size-3.5" />
              Tools
              <ChevronDown className="size-3 opacity-50" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8} className="min-w-44">
              {toolsNav.map((item) => (
                <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                  <item.icon className="size-4" />
                  {item.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" disabled className="opacity-40">
            <Bell className="size-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          <Link href="/settings">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <Settings className="size-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ml-1">
              <Avatar size="sm">
                <AvatarFallback className="bg-foreground text-background">
                  <User className="size-3.5" />
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div>
                    <p className="text-sm font-medium">{user.fullName || "User"}</p>
                    <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
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
      </div>
    </header>
  )
}
