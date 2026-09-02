'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Scissors, Menu, X, Sparkles } from 'lucide-react'

const LINKS = [
  { href: '#demo', label: 'Živi demo' },
  { href: '#funkcije', label: 'Funkcije' },
  { href: '#cene', label: 'Cene' },
  { href: '#faq', label: 'Pogosta vprašanja' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5" aria-label="TerminAI domov">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
            <Scissors className="h-4 w-4" />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Termin<span className="text-primary">AI</span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Glavna navigacija">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild className="hidden gap-1.5 sm:inline-flex">
            <a href="#demo">
              <Sparkles className="h-4 w-4" /> Preizkusi demo
            </a>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Zapri meni' : 'Odpri meni'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="border-t bg-background px-4 py-3 md:hidden" aria-label="Mobilna navigacija">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Button asChild className="mt-2 gap-1.5">
              <a href="#demo" onClick={() => setOpen(false)}>
                <Sparkles className="h-4 w-4" /> Preizkusi demo
              </a>
            </Button>
          </div>
        </nav>
      )}
    </header>
  )
}
