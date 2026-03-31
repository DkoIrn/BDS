'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/lib/actions/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function signupAction(_prevState: { error: string } | null, formData: FormData) {
  return signup(formData)
}

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, null)

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Start validating survey data in minutes</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
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

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
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
