import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO!,
  max: process.env.STRIPE_PRICE_MAX!,
} as const

export type PlanKey = keyof typeof PRICE_IDS
