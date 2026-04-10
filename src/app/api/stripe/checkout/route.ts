import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS, type PlanKey } from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { plan } = (await request.json()) as { plan: PlanKey }

  if (!PRICE_IDS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL!

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: user.email,
    metadata: {
      supabase_user_id: user.id,
      plan,
    },
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${origin}/settings?checkout=success`,
    cancel_url: `${origin}/settings?checkout=cancel`,
  })

  return NextResponse.json({ url: session.url })
}
