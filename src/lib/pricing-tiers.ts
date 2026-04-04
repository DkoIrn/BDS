export interface PricingTier {
  name: string
  basePrice: number | null // USD base price
  description: string
  features: string[]
  highlighted: boolean
}

export interface CurrencyConfig {
  code: string
  symbol: string
  multiplier: number // relative to USD
}

const currencies: Record<string, CurrencyConfig> = {
  GBP: { code: 'GBP', symbol: '£', multiplier: 1 },
  USD: { code: 'USD', symbol: '$', multiplier: 1.27 },
  EUR: { code: 'EUR', symbol: '€', multiplier: 1.16 },
  AUD: { code: 'AUD', symbol: 'A$', multiplier: 1.96 },
  CAD: { code: 'CAD', symbol: 'C$', multiplier: 1.73 },
  NOK: { code: 'NOK', symbol: 'kr ', multiplier: 13.7 },
  SGD: { code: 'SGD', symbol: 'S$', multiplier: 1.70 },
  AED: { code: 'AED', symbol: 'د.إ', multiplier: 4.64 },
  BRL: { code: 'BRL', symbol: 'R$', multiplier: 6.33 },
  INR: { code: 'INR', symbol: '₹', multiplier: 105 },
  MYR: { code: 'MYR', symbol: 'RM', multiplier: 5.95 },
}

// Map country/region codes to currencies
const regionToCurrency: Record<string, string> = {
  US: 'USD', GB: 'GBP', UK: 'GBP',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR',
  AU: 'AUD', NZ: 'AUD',
  CA: 'CAD',
  NO: 'NOK', SE: 'NOK', DK: 'NOK',
  SG: 'SGD',
  AE: 'AED', SA: 'AED', QA: 'AED', BH: 'AED', KW: 'AED', OM: 'AED',
  BR: 'BRL',
  IN: 'INR',
  MY: 'MYR',
}

/**
 * Detect the user's currency from their browser locale.
 * Falls back to USD if the region can't be determined.
 */
export function detectCurrency(): CurrencyConfig {
  if (typeof navigator === 'undefined') return currencies.USD

  // 1. Check all browser locales (navigator.languages includes regional variants)
  const locales = navigator.languages?.length ? navigator.languages : [navigator.language || 'en-US']
  for (const locale of locales) {
    const parts = locale.split('-')
    const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : ''
    if (region && regionToCurrency[region]) {
      return currencies[regionToCurrency[region]]
    }
  }

  // 2. Use Intl to resolve the locale's native currency
  try {
    const resolved = Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).resolvedOptions()
    // resolved.locale often includes region, e.g. "en-GB"
    const localeParts = resolved.locale.split('-')
    const region = localeParts.length > 1 ? localeParts[localeParts.length - 1].toUpperCase() : ''
    if (region && regionToCurrency[region]) {
      return currencies[regionToCurrency[region]]
    }
  } catch {
    // ignore
  }

  // 3. Timezone-based fallback
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.startsWith('Europe/London') || tz.startsWith('Europe/Belfast')) return currencies.GBP
    if (tz.startsWith('Europe/')) return currencies.EUR
    if (tz.startsWith('Australia/')) return currencies.AUD
    if (tz.startsWith('America/Toronto') || tz.startsWith('America/Vancouver') || tz.startsWith('America/Edmonton') || tz.startsWith('America/Winnipeg') || tz.startsWith('America/Halifax')) return currencies.CAD
    if (tz.startsWith('Asia/Singapore')) return currencies.SGD
    if (tz.startsWith('Asia/Dubai') || tz.startsWith('Asia/Riyadh')) return currencies.AED
    if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) return currencies.INR
    if (tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza')) return currencies.BRL
    if (tz.startsWith('Asia/Kuala_Lumpur')) return currencies.MYR
    if (tz.startsWith('Europe/Oslo') || tz.startsWith('Europe/Stockholm') || tz.startsWith('Europe/Copenhagen')) return currencies.NOK
  } catch {
    // ignore
  }

  return currencies.GBP
}

/**
 * Format a price in the detected currency.
 * Rounds to nearest whole number for clean display.
 */
export function formatPrice(baseGbp: number, currency: CurrencyConfig): string {
  const converted = Math.round(baseGbp * currency.multiplier)
  return `${currency.symbol}${converted}`
}

export const tiers: PricingTier[] = [
  {
    name: 'Starter',
    basePrice: 39,
    description: 'For small teams running QC on survey datasets.',
    features: [
      '5 projects',
      '10 QC checks per month',
      '25MB file size limit',
      'Core validation rules',
      'Auto-fix common issues',
      'PDF QC reports',
      'Email support',
    ],
    highlighted: false,
  },
  {
    name: 'Professional',
    basePrice: 119,
    description: 'For survey teams that need full QC coverage and compliance.',
    features: [
      'Unlimited projects',
      '100 QC checks per month',
      '50MB file size limit',
      'All validators + custom profiles',
      'AI-assisted issue resolution',
      'PDF reports + clean data export',
      'Priority processing',
      'Audit trail',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    basePrice: null,
    description: 'For organisations with custom QC and compliance needs.',
    features: [
      'Everything in Professional',
      'Unlimited QC checks',
      '100MB file size limit',
      'API access',
      'Custom validation rules',
      'Dedicated support',
      'SSO integration',
    ],
    highlighted: false,
  },
]
