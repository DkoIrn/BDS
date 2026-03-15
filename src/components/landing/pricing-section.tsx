import Link from 'next/link'
import { Check } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PricingTier {
  name: string
  price: number | null
  description: string
  features: string[]
  highlighted: boolean
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 49,
    description: 'For small teams getting started with automated QC.',
    features: [
      '5 projects',
      '10 uploads per month',
      '25MB file size limit',
      'Basic validators',
      'PDF reports',
      'Email support',
    ],
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 149,
    description: 'For growing survey operations that need full QC coverage.',
    features: [
      'Unlimited projects',
      '100 uploads per month',
      '50MB file size limit',
      'All validators + profiles',
      'PDF + dataset export',
      'Priority processing',
      'Custom validation profiles',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: null,
    description: 'For large organizations with custom requirements.',
    features: [
      'Everything in Professional',
      'Unlimited uploads',
      '100MB file size limit',
      'API access',
      'Custom validators',
      'Dedicated support',
      'SSO integration',
    ],
    highlighted: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-16 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Choose the plan that fits your survey operation
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted
                  ? 'relative border-secondary ring-2 ring-secondary'
                  : ''
              }
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="secondary">Most Popular</Badge>
                </div>
              )}

              <CardHeader className="pt-6">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  {tier.price !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${tier.price}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /month
                      </span>
                    </div>
                  ) : (
                    <span className="text-4xl font-bold text-foreground">
                      Contact Us
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul data-slot="feature-list" className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Link
                  href="/signup"
                  className={`inline-flex h-10 w-full items-center justify-center rounded-md text-sm font-medium shadow-sm transition-colors ${
                    tier.highlighted
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'border border-input bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {tier.price !== null ? 'Get Started' : 'Contact Sales'}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
