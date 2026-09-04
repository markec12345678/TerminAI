import type { MetadataRoute } from 'next'

/**
 * PWA manifest — lastnica si aplikacijo doda na domači zaslon
 * (Chrome: Deli → Namesti aplikacijo / Dodaj na domači zaslon).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TerminAI — rezervacije za salon',
    short_name: 'TerminAI',
    description: 'Rezervacijski sistem za frizerske in kozmetične salone. Deluje tudi brez interneta.',
    lang: 'sl',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffbf7',
    theme_color: '#9f1239',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
