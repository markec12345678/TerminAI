import { Scissors, MapPin, Mail } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Scissors className="h-3.5 w-3.5" />
              </span>
              <span className="font-display text-lg font-semibold">
                Termin<span className="text-primary">AI</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Rezervacijski sistem za salone — deluje tudi offline, AI po želji.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Noga">
            <a href="#demo" className="transition-colors hover:text-primary">Demo</a>
            <a href="#funkcije" className="transition-colors hover:text-primary">Funkcije</a>
            <a href="#cene" className="transition-colors hover:text-primary">Cene</a>
            <a href="#faq" className="transition-colors hover:text-primary">Pogosta vprašanja</a>
          </nav>

          <div className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground sm:items-end">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Ljubljana, Slovenija
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> info@terminai.si
            </span>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} TerminAI — demo različica. Prikazani podatki (salon Studio Aura, stranke, termini) so
            izmišljeni za namen predstavitve.
          </p>
        </div>
      </div>
    </footer>
  )
}
