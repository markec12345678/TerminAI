'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * TerminAI je zasnovan izključno za svetli način (kremna/burgundy znamka).
 * forcedTheme="light" povozí VSE: shranjeno izbiro v localStorage, sistemsko
 * nastavitev OS in morebitne stare vrednosti — temni način tako ne more
 * prižgati ne pomotoma ne sam od sebe.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
