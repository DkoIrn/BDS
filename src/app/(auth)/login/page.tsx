'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/lib/actions/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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
          <form action={formAction} className="space-y-4">
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
