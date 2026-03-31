"use client"

import { useEffect, useState, useTransition } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { toast } from "sonner"
import { updateProfile } from "@/lib/actions/profile"
import { updatePassword } from "@/lib/actions/auth"
import { Check, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { tiers, detectCurrency, formatPrice, type CurrencyConfig } from "@/lib/pricing-tiers"

export default function SettingsPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [currency, setCurrency] = useState<CurrencyConfig | null>(null)
  const [profilePending, startProfileTransition] = useTransition()
  const [passwordPending, startPasswordTransition] = useTransition()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setEmail(user.email ?? "")
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
        setFullName(profile?.full_name ?? "")
      }
    }

    loadUser()
    setCurrency(detectCurrency())
  }, [])

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData()
    formData.set("full_name", fullName)

    startProfileTransition(async () => {
      const result = await updateProfile(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Profile updated successfully")
      }
    })
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordError("")

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters")
      return
    }

    const formData = new FormData()
    formData.set("password", newPassword)
    formData.set("confirmPassword", confirmPassword)

    startPasswordTransition(async () => {
      const result = await updatePassword(formData)
      if (result && "error" in result) {
        setPasswordError(result.error)
      } else {
        toast.success("Password updated successfully")
        setNewPassword("")
        setConfirmPassword("")
      }
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Profile Section */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                disabled
                className="rounded-xl bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <Button type="submit" className="rounded-xl bg-foreground text-background hover:bg-foreground/90" disabled={profilePending}>
              {profilePending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Plan & Billing Section */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50">
              <Crown className="size-4 text-amber-600" />
            </div>
            Plan & Billing
          </CardTitle>
          <CardDescription>
            You are currently on the <span className="font-semibold text-foreground">Starter</span> plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {tiers.map((tier) => {
              const isCurrent = tier.name === "Starter"
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl border p-4 ${
                    tier.highlighted
                      ? "border-teal-400 ring-2 ring-teal-400"
                      : isCurrent
                        ? "border-foreground/20 bg-foreground/[0.02]"
                        : ""
                  }`}
                >
                  {tier.highlighted && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-md bg-teal-500 text-[10px] text-white">
                      Recommended
                    </Badge>
                  )}
                  {isCurrent && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-md bg-foreground text-[10px] text-background">
                      Current
                    </Badge>
                  )}
                  <div className="mt-1">
                    <p className="font-semibold">{tier.name}</p>
                    <p className="text-2xl font-bold">
                      {tier.basePrice !== null
                        ? (currency ? formatPrice(tier.basePrice, currency) : `$${tier.basePrice}`)
                        : "Custom"}
                      {tier.basePrice !== null && (
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      )}
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {tier.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Check className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                    {tier.features.length > 4 && (
                      <li className="text-xs text-muted-foreground">
                        +{tier.features.length - 4} more
                      </li>
                    )}
                  </ul>
                  <Button
                    className={`mt-3 w-full rounded-xl ${
                      isCurrent
                        ? ""
                        : tier.highlighted
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : ""
                    }`}
                    size="sm"
                    variant={isCurrent ? "outline" : tier.highlighted ? "default" : "outline"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : tier.basePrice !== null ? "Upgrade" : "Contact Sales"}
                  </Button>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Billing integration coming soon. Contact support for plan changes.
          </p>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="rounded-xl"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            <Button type="submit" className="rounded-xl bg-foreground text-background hover:bg-foreground/90" disabled={passwordPending}>
              {passwordPending ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
