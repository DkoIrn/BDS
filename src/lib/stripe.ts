import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(key)
  }
  return _stripe
}

/** @deprecated Use getStripe() instead — kept for existing imports */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO ?? '',
  max: process.env.STRIPE_PRICE_MAX ?? '',
} as const

export type PlanKey = keyof typeof PRICE_IDS
