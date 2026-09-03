'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserRound, Store } from 'lucide-react'
import { BookingWidget } from './booking-widget'
import { AiAssistant } from './ai-assistant'
import { AiAssistantOffline } from './ai-assistant-offline'
import { Dashboard } from './dashboard'
import type { BusinessDto, ServiceDto } from './types'

// Build-time zastavica: USB/offline build ima NEXT_PUBLIC_AI_ENABLED=false
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED !== 'false'

export function DemoSection() {
  const [services, setServices] = useState<ServiceDto[]>([])
  const [business, setBusiness] = useState<BusinessDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services')
      if (res.ok) {
        const data = await res.json()
        setServices(data.services)
        setBusiness(data.business)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  const onBooked = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const onServicesChanged = useCallback(() => {
    setRefreshKey((k) => k + 1)
    loadServices()
  }, [loadServices])

  return (
    <section id="demo" className="scroll-mt-16 bg-gradient-to-b from-muted/40 to-background py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary">
            Živi demo · ne navidezen
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Preizkusite kot <span className="italic text-primary">stranka</span> — ali skozi oči <span className="italic text-primary">lastnika</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Vse spodaj je pravi, delujoč sistem: rezervirajte termin, preklopite v nadzorno ploščo in potrjujte ali
            odpovedujte. Ana na desni je <strong className="text-foreground">neobvezen AI dodatek</strong> — tu je
            vključena samo za predstavitev. Demo salon:{' '}
            <strong className="text-foreground">{business?.name ?? 'Studio Aura'}, Ljubljana</strong>.
          </p>
        </div>

        <Tabs defaultValue="stranka" className="mt-8">
          <div className="flex justify-center">
            <TabsList className="h-auto rounded-full p-1">
              <TabsTrigger value="stranka" className="gap-2 rounded-full px-5 py-2 data-[state=active]:shadow-sm">
                <UserRound className="h-4 w-4" />
                Stran za stranko
              </TabsTrigger>
              <TabsTrigger value="lastnik" className="gap-2 rounded-full px-5 py-2 data-[state=active]:shadow-sm">
                <Store className="h-4 w-4" />
                Nadzorna plošča lastnika
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stranka" className="mt-6 grid gap-6 lg:grid-cols-5 lg:items-start">
            <div className="lg:col-span-3">
              <BookingWidget
                services={services}
                loading={loading}
                businessName={business?.name ?? 'Studio Aura'}
                businessTagline={business?.tagline ?? null}
                businessAddress={business?.address ?? ''}
                businessPhone={business?.phone ?? ''}
                onBooked={onBooked}
              />
            </div>
            <div className="lg:col-span-2 lg:sticky lg:top-20">
              {AI_ENABLED ? (
                <AiAssistant />
              ) : (
                <AiAssistantOffline
                  businessName={business?.name ?? 'salon'}
                  businessPhone={business?.phone ?? ''}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="lastnik" className="mt-6">
            <Dashboard onRefreshKey={refreshKey} onServicesChanged={onServicesChanged} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
