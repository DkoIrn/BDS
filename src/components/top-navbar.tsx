"use client"

import { useState } from "react"
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
  ShieldCheck,
  Settings,
  LogOut,
  Bell,
  ChevronDown,
  User,
  Menu,
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
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const mainNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "QC Pipeline", href: "/pipeline", icon: ShieldCheck },
  { title: "Projects", href: "/projects", icon: FolderOpen },
  { title: "QC Reports", href: "/reports", icon: BarChart3 },
]

const toolsNav = [
  { title: "Convert", href: "/tools/convert", icon: ArrowRightLeft },
  { title: "Transform", href: "/tools/transform", icon: Wrench },
  { title: "Compare", href: "/tools/compare", icon: GitCompareArrows },
  { title: "Visualise", href: "/tools/visualize", icon: Map },
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
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const isToolsActive = pathname.startsWith("/tools")

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 items-center gap-4 px-4 sm:gap-6 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.png"
            alt="TruQC"
            width={180}
            height={64}
            className="h-16 w-auto"
          />
        </Link>

        {/* Main nav — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial={item.href.replace("/", "")}
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
              data-tutorial="tools"
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

        {/* Right side — hidden on mobile */}
        <div className="ml-auto hidden md:flex items-center gap-1.5">
          <Button variant="ghost" size="icon-sm" disabled className="opacity-40" data-tutorial="notifications">
            <Bell className="size-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          <Link href="/settings" data-tutorial="settings">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <Settings className="size-4" />
              <span className="sr-only">Settings</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger data-tutorial="profile" className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ml-1">
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

        {/* Mobile hamburger menu */}
        <div className="ml-auto md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger data-tutorial="menu" className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {mainNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <item.icon className="size-4" />
                    {item.title}
                  </Link>
                ))}

                <hr className="my-2 border-border" />
                <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Tools</p>
                {toolsNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <item.icon className="size-4" />
                    {item.title}
                  </Link>
                ))}

                <hr className="my-2 border-border" />
                <Link
                  href="/settings"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); logout() }}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-muted/60 text-left"
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
