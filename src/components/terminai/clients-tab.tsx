'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Search, Phone, CalendarDays, Wallet, Heart, AlertTriangle } from 'lucide-react'
import { ownerFetch } from '@/lib/owner-fetch'
import { formatPrice } from './types'

interface ClientRow {
  id: string
  name: string
  phone: string
  visits: number
  noShows: number
  totalCents: number
  lastVisit: string | null
  next: { at: string; service: string } | null
  favorite: string | null
}

/** Baza strank — obiski, prihodki, zadnji obisk, naslednji termin. */
export function ClientsTab() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    ownerFetch('/api/clients')
      .then(async (r) => {
        if (r.status === 401) {
          setError('PIN')
          return null
        }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => {
        if (d) setClients(d.clients)
      })
      .catch(() => setError('Napaka pri nalaganju strank.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
  }, [clients, query])

  const totals = useMemo(
    () => ({
      visits: clients.reduce((s, c) => s + c.visits, 0),
      revenue: clients.reduce((s, c) => s + c.totalCents, 0),
    }),
    [clients]
  )

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Baza strank</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{clients.length} strank</span>
            <span>·</span>
            <span>{totals.visits} obiskov</span>
            <span>·</span>
            <span className="font-semibold text-foreground">{formatPrice(totals.revenue)}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Iskanje po imenu ali telefonu …"
              className="pl-9"
              aria-label="Iskanje strank"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : error ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {error === 'PIN' ? 'Dostop zavrnjen — vnesite PIN.' : error}
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {query ? 'Ni zadetkov za iskanje.' : 'Baza strank se bo polnila z vsako rezervacijo.'}
            </p>
          ) : (
            <div className="terminai-scroll max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.visits >= 5 && (
                        <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
                          <Heart className="h-3 w-3" /> zvesta stranka
                        </Badge>
                      )}
                      {c.noShows > 0 && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-rose-200 bg-rose-50 text-rose-600"
                          title="Število izostankov — poteče če pravi termini"
                        >
                          <AlertTriangle className="h-3 w-3" /> {c.noShows}× ni prišla
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {c.visits} obiskov
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> {formatPrice(c.totalCents)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {c.next ? (
                      <div>
                        <span className="text-[10px] uppercase tracking-wide">naslednji</span>
                        <div className="font-medium text-foreground">
                          {new Date(c.next.at).getUTCDate()}. ob{' '}
                          {String(new Date(c.next.at).getUTCHours()).padStart(2, '0')}:
                          {String(new Date(c.next.at).getUTCMinutes()).padStart(2, '0')}
                        </div>
                        <div className="truncate">{c.next.service}</div>
                      </div>
                    ) : (
                      <div>{c.favorite ? `največkrat: ${c.favorite}` : c.lastVisit ? `zadnji obisk ${c.lastVisit}` : 'še ni obiskala'}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
