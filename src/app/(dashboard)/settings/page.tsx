"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { toast } from "sonner"
import { updateUserProfile } from "@/lib/actions/user-profile"
import { updatePassword } from "@/lib/actions/auth"
import { uploadBrandingLogo, saveBrandColor, getBrandingSettings } from "@/lib/actions/branding"
import { Check, Crown, FileText, Shield, ExternalLink, Loader2, Upload, Palette } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { tiers, formatPrice, type CurrencyConfig } from "@/lib/pricing-tiers"
import { UsageSection } from "@/components/usage/usage-section"

const gbp: CurrencyConfig = { code: 'GBP', symbol: '£', multiplier: 1 }

// Map DB plan values to tier display names
const planToTierName: Record<string, string> = {
  free: 'Free Trial',
  pro: 'Pro',
  max: 'Max',
  enterprise: 'Enterprise',
}

// Map tier names to checkout plan keys
const tierToCheckoutPlan: Record<string, string> = {
  Pro: 'pro',
  Max: 'max',
}

function CheckoutToast() {
  const searchParams = useSearchParams()
  const checkout = searchParams.get('checkout')

  useEffect(() => {
    if (checkout === 'success') {
      toast.success('Subscription activated! Welcome aboard.')
    } else if (checkout === 'cancel') {
      toast('Checkout cancelled — no changes made.')
    }
  }, [checkout])

  return null
}

export default function SettingsPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPlan, setCurrentPlan] = useState("free")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState("#14B8A6")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const currency = gbp
  const [profilePending, startProfileTransition] = useTransition()
  const [passwordPending, startPasswordTransition] = useTransition()
  const [brandingPending, startBrandingTransition] = useTransition()

  const currentTierName = planToTierName[currentPlan] || 'Free Trial'

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
          .select("full_name, plan")
          .eq("id", user.id)
          .single()
        setFullName(profile?.full_name ?? "")
        setCurrentPlan(profile?.plan ?? "free")

        // Load branding settings
        const branding = await getBrandingSettings()
        setBrandColor(branding.brandColor)
        setLogoUrl(branding.logoUrl)
      }
    }

    loadUser()
  }, [])

  async function handleUpgrade(tierName: string) {
    const plan = tierToCheckoutPlan[tierName]
    if (!plan) return

    setCheckoutLoading(tierName)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Failed to start checkout')
        setCheckoutLoading(null)
      }
    } catch {
      toast.error('Something went wrong')
      setCheckoutLoading(null)
    }
  }

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData()
    formData.set("full_name", fullName)

    startProfileTransition(async () => {
      const result = await updateUserProfile(formData)
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

  // Determine tier ordering for upgrade/downgrade logic
  const tierOrder = ['Free Trial', 'Pro', 'Max', 'Enterprise']
  const currentTierIndex = tierOrder.indexOf(currentTierName)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Suspense fallback={null}>
        <CheckoutToast />
      </Suspense>

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

      {/* Report Branding Section */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-teal-50">
              <Palette className="size-4 text-teal-600" />
            </div>
            Report Branding
          </CardTitle>
          <CardDescription>Customise your QC reports with company branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Company Logo</Label>
            {logoUrl ? (
              <div className="space-y-2">
                <div className="inline-flex rounded-xl border bg-slate-100 p-3">
                  <img
                    src={logoUrl}
                    alt="Company logo preview"
                    className="h-[60px] w-[120px] object-contain"
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={brandingPending}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    Change Logo
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 px-6 py-8 text-center transition-colors hover:border-muted-foreground/50 hover:bg-muted/50"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Upload your company logo</p>
                <p className="text-xs text-muted-foreground/70">(PNG or JPEG, max 2MB)</p>
              </button>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const fd = new FormData()
                fd.set("logo", file)
                startBrandingTransition(async () => {
                  const result = await uploadBrandingLogo(fd)
                  if (result.error) {
                    toast.error(result.error)
                  } else {
                    toast.success("Logo uploaded successfully")
                    const branding = await getBrandingSettings()
                    setLogoUrl(branding.logoUrl)
                  }
                })
                // Reset input so re-uploading the same file triggers onChange
                e.target.value = ""
              }}
            />
          </div>

          {/* Brand Colour */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Brand Colour</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border"
              />
              <Input
                value={brandColor}
                onChange={(e) => {
                  const val = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    setBrandColor(val)
                  }
                }}
                className="w-28 rounded-xl font-mono text-sm"
              />
              <Button
                type="button"
                size="sm"
                className="rounded-xl bg-foreground text-background hover:bg-foreground/90"
                disabled={brandingPending || !/^#[0-9A-Fa-f]{6}$/.test(brandColor)}
                onClick={() => {
                  const fd = new FormData()
                  fd.set("brand_color", brandColor)
                  startBrandingTransition(async () => {
                    const result = await saveBrandColor(fd)
                    if (result.error) {
                      toast.error(result.error)
                    } else {
                      toast.success("Brand colour saved")
                    }
                  })
                }}
              >
                {brandingPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Your logo and colour will appear on all generated PDF reports.
          </p>
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
            You are currently on the <span className="font-semibold text-foreground">{currentTierName}</span> plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => {
              const isCurrent = tier.name === currentTierName
              const tierIndex = tierOrder.indexOf(tier.name)
              const isDowngrade = tierIndex < currentTierIndex
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
                  {tier.highlighted && !isCurrent && (
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
                        ? formatPrice(tier.basePrice, currency)
                        : "Custom"}
                      {tier.basePrice !== null && tier.basePrice > 0 && (
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
                      isCurrent || isDowngrade
                        ? ""
                        : tier.highlighted
                          ? "bg-foreground text-background hover:bg-foreground/90"
                          : ""
                    }`}
                    size="sm"
                    variant={isCurrent || isDowngrade ? "outline" : tier.highlighted ? "default" : "outline"}
                    disabled={isCurrent || isDowngrade || checkoutLoading !== null}
                    onClick={() => handleUpgrade(tier.name)}
                  >
                    {checkoutLoading === tier.name ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : isDowngrade ? (
                      "Downgrade"
                    ) : tier.basePrice === null ? (
                      "Contact Sales"
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Usage Section */}
      <UsageSection />

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

      {/* Legal Section */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Legal</CardTitle>
          <CardDescription>Privacy, terms, and policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            href="/privacy"
            target="_blank"
            className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50">
                <Shield className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Privacy Policy</p>
                <p className="text-xs text-muted-foreground">How we handle your data</p>
              </div>
            </div>
            <ExternalLink className="size-4 text-muted-foreground" />
          </Link>
          <Link
            href="/terms"
            target="_blank"
            className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50">
                <FileText className="size-4 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Terms of Service</p>
                <p className="text-xs text-muted-foreground">Rules and conditions of use</p>
              </div>
            </div>
            <ExternalLink className="size-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
