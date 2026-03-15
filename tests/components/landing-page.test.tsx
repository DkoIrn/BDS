import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LandingPage } from '@/components/landing/landing-page'

describe('LandingPage', () => {
  describe('section rendering (UIDE-03)', () => {
    it('renders hero section with heading text', () => {
      render(<LandingPage />)
      expect(
        screen.getByText(/stop spending hours manually checking survey data/i)
      ).toBeDefined()
    })

    it('renders features section with heading', () => {
      render(<LandingPage />)
      expect(
        screen.getByText(/everything you need for survey qc/i)
      ).toBeDefined()
    })

    it('renders how-it-works section', () => {
      render(<LandingPage />)
      // Multiple matches: navbar anchor link + section heading
      const matches = screen.getAllByText(/how it works/i)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('renders pricing section', () => {
      render(<LandingPage />)
      expect(
        screen.getByText(/simple, transparent pricing/i)
      ).toBeDefined()
    })

    it('renders CTA section', () => {
      render(<LandingPage />)
      expect(
        screen.getByText(/ready to automate your survey qc/i)
      ).toBeDefined()
    })

    it('renders footer', () => {
      render(<LandingPage />)
      // Multiple matches: navbar logo + hero mockup URL + footer logo
      const matches = screen.getAllByText(/surveyqc/i)
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('navigation', () => {
    it('hero section contains a link to /signup', () => {
      render(<LandingPage />)
      const signupLinks = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href') === '/signup')
      expect(signupLinks.length).toBeGreaterThanOrEqual(1)
    })

    it('page contains anchor-target ids for features, how-it-works, and pricing', () => {
      const { container } = render(<LandingPage />)
      expect(container.querySelector('#features')).not.toBeNull()
      expect(container.querySelector('#how-it-works')).not.toBeNull()
      expect(container.querySelector('#pricing')).not.toBeNull()
    })
  })
})
