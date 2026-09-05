import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { dayNameFull, formatPrice, getBusinessHours } from '@/lib/booking'

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1500) }))
    .min(1)
    .max(24),
})

export async function POST(req: NextRequest) {
  try {
    // Offline način (USB/lokalna namestitev): AI izklopljena, nič API klicev
    if (process.env.AI_ENABLED === 'false') {
      return NextResponse.json(
        {
          offline: true,
          error: 'AI asistent ni na voljo v offline načinu. Za rezervacijo uporabite rezervacijski okvir.',
        },
        { status: 503 }
      )
    }

    const body = await req.json()
    const parsed = chatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Napačna zahteva' }, { status: 400 })
    }

    const { messages } = parsed.data

    // Kontekst iz baze: storitve, cene, delovni čas
    const business = await db.business.findFirst()
    const services = await db.service.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } })

    const serviceList = services
      .map(
        (s) =>
          `- ${s.name}: ${s.durationMin} min, redna cena ${formatPrice(s.priceCents)}, vršni čas (po 15h in sobota) ${formatPrice(s.peakPriceCents)}`
      )
      .join('\n')

    // Delovni čas IZ BAZE (tudi po lastničini spremembi v modulu Delovni čas) —
    // prej je bil hardkodiran in je Ana lažno citirala privzete ure.
    const hoursMap = await getBusinessHours()
    // 7. 1. 2024 je nedelja — s tem dobimo datum za vsak dan v tednu (0–6)
    const dowDate = (i: number) => `2024-01-${String(7 + i).padStart(2, '0')}`
    const hoursDesc = Array.from({ length: 7 }, (_, i) => {
      const h = hoursMap.get(i)
      if (!h) return `${dayNameFull(dowDate(i))} zaprto`
      const premor = h.breakStart && h.breakEnd ? ` (premor ${h.breakStart}–${h.breakEnd})` : ''
      return `${dayNameFull(dowDate(i))} ${h.open}–${h.close}${premor}`
    }).join('; ')

    const systemPrompt = `Ti si Ana, prijazna recepcionarka salona ${business?.name ?? 'Studio Aura'} v Ljubljani. Odgovarjaš izključno v slovenščini, vljudno, kratko in konkretno (največ 3–4 stavke ali kratka lista).

Podatki o salonu:
- Naslov: ${business?.address ?? 'Trubarjeva 27, Ljubljana'}
- Telefon: ${business?.phone ?? '+386 40 123 456'}
- Delovni čas: ${hoursDesc}

Storitve in cene:
${serviceList}

Pravila:
1. Strankam pomagaš izbrati storitev, poveš ceno in trajanje.
2. Če sprašujejo po terminih, jih usmeriš na rezervacijski okvir na strani (gumb "Izberi termin") — dejansko proste termine vidiš tam.
3. Odpovedi so možne do 24 ur pred terminom, brez stroškov.
4. Ne izmišljuj si prostih terminov ali informacij, ki jih ni v podatkih.
5. Priporočila za nego las lahko podaš splošno (npr. za barvanje svetujes posvet predhodno).
6. Nikoli ne razkrivaš, da si AI — če te vprašajo, si "virtualna recepcionarka".

Trenutni datum uporabi samo, če te sprašujejo specifično.`

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      thinking: { type: 'disabled' },
    })

    const reply = completion.choices[0]?.message?.content
    if (!reply || reply.trim().length === 0) {
      return NextResponse.json({ error: 'AI ni odgovoril, poskusite znova.' }, { status: 502 })
    }

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('POST /api/ai error', e)
    return NextResponse.json({ error: 'AI asistent trenutno ni dosegljiv' }, { status: 500 })
  }
}
