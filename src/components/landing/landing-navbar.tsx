"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
]

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-colors ${
        scrolled
          ? "border-b bg-background/95 backdrop-blur supports-backdrop-filter:backdrop-blur"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        {/* Logo */}
        <a
          href="#"
          className="flex items-center gap-2"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: "smooth" })
          }}
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            SQ
          </div>
          <span className="text-lg font-semibold text-foreground">
            SurveyQC
          </span>
        </a>

        {/* Center nav links - hidden on mobile */}
        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side: auth links */}
        <div className="ml-auto hidden items-center gap-4 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger menu */}
        <div className="ml-auto md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 px-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <hr className="border-border" />
                <Link
                  href="/login"
                  className="text-sm font-medium text-foreground"
                  onClick={() => setOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
                  onClick={() => setOpen(false)}
                >
                  Get Started
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
