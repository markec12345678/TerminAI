'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

/**
 * Preklop teme — ikoni se preklapljata prek CSS razreda `dark`, ki ga
 * next-themes nastavi na <html>. Tako ni hidracijskega nesoglasja in
 * ne potrebujemo stanja "mounted".
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Preklopi na svetli način' : 'Preklopi na temni način'}
      title={isDark ? 'Svetli način' : 'Temni način'}
      className="shrink-0"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" />
    </Button>
  )
}
