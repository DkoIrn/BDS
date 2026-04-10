'use client'

import { Suspense, useState, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login, signInWithProvider } from '@/lib/actions/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { Provider } from '@supabase/supabase-js'

function loginAction(_prevState: { error: string } | null, formData: FormData) {
  return login(formData)
}

function MessageBanner() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  if (!message) return null

  return (
    <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-foreground">
      {message}
    </div>
  )
}

function SocialButtons() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleOAuth = async (provider: Provider) => {
    setLoading(provider)
    await signInWithProvider(provider)
    setLoading(null)
  }

  return (
    <div className="space-y-3">
      <div>
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl"
          disabled={loading !== null}
          onClick={() => handleOAuth('azure')}
        >
          {loading === 'azure' ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg className="size-4" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
          )}
          Continue with Microsoft
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <>
      <Suspense fallback={null}>
        <MessageBanner />
      </Suspense>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <SocialButtons />

          <form action={formAction} className="mt-4 space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="rounded-xl"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <Button type="submit" className="w-full rounded-xl bg-foreground text-background hover:bg-foreground/90" size="lg" disabled={isPending}>
              {isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-foreground hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  )
}
