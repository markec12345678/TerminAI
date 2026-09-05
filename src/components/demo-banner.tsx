/**
 * TerminAI — obvestilni trak za spletni demo (Vercel).
 *
 * Prikaže se SAMO, če je ob buildu nastavljen NEXT_PUBLIC_DEMO_MODE
 * (na Vercelu). Lokalna/USB različica ga nikoli ne vidi.
 *
 * Pošilja jasno sporočilo: to je predstavitvena različica — vsak obisk
 * se začne s svežimi demo podatki, spremembe niso trajno shranjene.
 * (Serverless SQLite v /tmp se ob cold startu prepiše iz predloge.)
 */

import { Globe } from "lucide-react";

export function DemoBanner() {
  if (!process.env.NEXT_PUBLIC_DEMO_MODE) return null;

  return (
    <div
      role="status"
      aria-label="Spletni demo"
      className="w-full bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100 border-b border-amber-300/60 dark:border-amber-700/50"
    >
      <div className="mx-auto max-w-6xl px-3 sm:px-4 py-1.5 flex items-center gap-2 text-[11px] sm:text-xs">
        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p className="leading-snug">
          <strong className="font-semibold">Spletni demo</strong> — vsak obisk se
          začne s svežimi demo podatki (Studio Aura); spremembe se trajno ne
          shranjujejo. Trajna različica teče lokalno na vašem računalniku.
        </p>
      </div>
    </div>
  );
}
