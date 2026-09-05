'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, WifiOff, Phone } from 'lucide-react'

interface Props {
  businessName: string
  businessPhone: string
}

/**
 * Offline nadomestek AI asistenta — prikazan, ko je AI izklopljena
 * (USB/offline namestitev). Brez API klicev, čisti statični prikaz.
 */
export function AiAssistantOffline({ businessName, businessPhone }: Props) {
  return (
    <Card className="flex h-full flex-col border-border/60 shadow-xl shadow-primary/5">
      <CardHeader className="border-b bg-secondary/60 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted-foreground/20">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-tight">Ana — AI recepcionarka</h3>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <WifiOff className="h-3 w-3" /> offline način
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <WifiOff className="h-7 w-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">Ana spava medtem, ko ste offline 😴</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Rezervacije delujejo normalno — uporabite okvir levo. Za vprašanja pokličite salon.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <a href={`tel:${businessPhone.replace(/\s/g, '')}`}>
            <Phone className="h-4 w-4" /> {businessPhone}
          </a>
        </Button>
        <p className="text-[11px] text-muted-foreground">
          AI recepcionarka se aktivira, ko se {businessName} poveže online.
        </p>
      </CardContent>
    </Card>
  )
}
