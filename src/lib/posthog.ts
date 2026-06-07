import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window === 'undefined') return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    capture_pageview: false,  // manual — Next.js App Router doesn't trigger PostHog's auto-detection
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  })
}

export { posthog }
