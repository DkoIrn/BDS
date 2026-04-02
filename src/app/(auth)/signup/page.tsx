'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { signup, verifyOtp, resendOtp } from '@/lib/actions/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Mail, ArrowLeft } from 'lucide-react'

export default function SignupPage() {
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsPending(true)

    const formData = new FormData(e.currentTarget)
    const result = await signup(formData)

    setIsPending(false)

    if (result && 'error' in result && result.error) {
      setError(result.error)
      return
    }

    if (result && 'email' in result && result.email) {
      setEmail(result.email)
      setStep('verify')
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste of full code
      const digits = value.replace(/\D/g, '').slice(0, 8).split('')
      const newOtp = [...otp]
      digits.forEach((d, i) => {
        if (index + i < 8) newOtp[index + i] = d
      })
      setOtp(newOtp)
      const nextIndex = Math.min(index + digits.length, 7)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const digit = value.replace(/\D/g, '')
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)

    if (digit && index < 7) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const code = otp.join('')
    if (code.length !== 8) return

    setError(null)
    setIsPending(true)

    const result = await verifyOtp(email, code)

    setIsPending(false)

    if (result && 'error' in result && result.error) {
      setError(result.error)
      setOtp(['', '', '', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  const handleResend = async () => {
    setError(null)
    setIsPending(true)

    const result = await resendOtp(email)

    setIsPending(false)

    if (result && 'error' in result && result.error) {
      setError(result.error)
    }
  }

  // Verification step
  if (step === 'verify') {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-5 text-primary" />
          </div>
          <CardTitle className="mt-3 text-2xl">Check your email</CardTitle>
          <CardDescription>
            We sent a verification code to <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* OTP input */}
            <div className="flex justify-center gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="size-10 rounded-xl border bg-background text-center text-base font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleVerify}
              disabled={otp.join('').length !== 8 || isPending}
              className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
              size="lg"
            >
              {isPending ? 'Verifying...' : 'Verify & Continue'}
            </Button>

            <div className="flex items-center justify-between">
              <button
                onClick={() => { setStep('form'); setOtp(['', '', '', '', '', '', '', '']); setError(null) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3" />
                Back
              </button>
              <button
                onClick={handleResend}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Signup form step
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start validating survey data in minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90" size="lg" disabled={isPending}>
            {isPending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
