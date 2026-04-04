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
import { tiers, formatPrice, type CurrencyConfig } from '@/lib/pricing-tiers'

// GBP is the base currency — no detection needed
const gbp: CurrencyConfig = { code: 'GBP', symbol: '£', multiplier: 1 }

export function PricingSection() {
  const currency = gbp

  return (
    <section id="pricing" className="scroll-mt-16 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Choose the plan that fits your QC workload
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted
                  ? 'relative overflow-visible border-secondary ring-2 ring-secondary'
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
                  {tier.basePrice !== null ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        {formatPrice(tier.basePrice, currency)}
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
                  {tier.basePrice !== null ? 'Get Started' : 'Contact Sales'}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
