import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PricingSection } from '@/components/landing/pricing-section'

describe('PricingSection', () => {
  describe('tier display (SUBS-01)', () => {
    it('renders exactly 3 tier names: Starter, Professional, Enterprise', () => {
      render(<PricingSection />)
      expect(screen.getByText('Starter')).toBeDefined()
      expect(screen.getByText('Professional')).toBeDefined()
      expect(screen.getByText('Enterprise')).toBeDefined()
    })

    it('displays GBP prices for Starter and Professional tiers', () => {
      render(<PricingSection />)
      expect(screen.getByText('£39')).toBeDefined()
      expect(screen.getByText('£119')).toBeDefined()
    })

    it('displays "Contact Us" for Enterprise tier instead of a price', () => {
      render(<PricingSection />)
      expect(screen.getByText('Contact Us')).toBeDefined()
    })
  })

  describe('Professional tier highlight (SUBS-02)', () => {
    it('Professional tier has a "Most Popular" badge', () => {
      render(<PricingSection />)
      expect(screen.getByText('Most Popular')).toBeDefined()
    })
  })

  describe('feature lists', () => {
    it('each tier has at least 3 features listed', () => {
      const { container } = render(<PricingSection />)
      // Each pricing card should have a feature list
      const featureLists = container.querySelectorAll('[data-slot="feature-list"]')
      expect(featureLists.length).toBe(3)
      featureLists.forEach((list) => {
        const items = list.querySelectorAll('li')
        expect(items.length).toBeGreaterThanOrEqual(3)
      })
    })
  })

  describe('CTA links', () => {
    it('all tier CTA buttons link to /signup', () => {
      render(<PricingSection />)
      const signupLinks = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href') === '/signup')
      // Should have at least 3 (one per tier)
      expect(signupLinks.length).toBeGreaterThanOrEqual(3)
    })
  })
})
