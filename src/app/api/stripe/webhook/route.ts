import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.supabase_user_id
      const plan = session.metadata?.plan

      if (userId && plan) {
        await supabaseAdmin
          .from('profiles')
          .update({
            plan,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const status = subscription.status

      if (status === 'active') break

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .limit(1)

      if (profiles?.[0]) {
        await supabaseAdmin
          .from('profiles')
          .update({ plan: 'free' })
          .eq('id', profiles[0].id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object

      await supabaseAdmin
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_subscription_id', subscription.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
