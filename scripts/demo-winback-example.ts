/**
 * Demo primer za Motor zvestobe (P4) — win-back.
 *
 * 1) custom.db (lokalno + USB): preimenuje testno stranko v realistično
 *    "Nuša Leban" (ženska storitev), pobriše ostale testne artefakte.
 * 2) demo-template.db (Vercel spletni demo): doda isti primer, da spletni
 *    demo pokaže kartico "Dolgo jih ni bilo" obiskovalcem.
 *
 * Zagon: bun scripts/demo-winback-example.ts
 */
import { PrismaClient } from '@prisma/client'

const DAY = 86_400_000
const now = Date.now()

async function addExample(db: PrismaClient, renameFrom?: string) {
  const service = await db.service.findFirst({ where: { name: { contains: 'ženske' } } })
  if (!service) throw new Error('Ni storitve Striženje — ženske')

  if (renameFrom) {
    // custom.db: preimenuj obstoječo testno stranko + popravi storitev
    const old = await db.client.findFirst({ where: { name: renameFrom } })
    if (old) {
      await db.client.update({ where: { id: old.id }, data: { name: 'Nuša Leban' } })
      await db.appointment.updateMany({
        where: { clientId: old.id },
        data: { serviceId: service.id, priceCents: service.priceCents },
      })
      console.log(`custom.db: ${renameFrom} → Nuša Leban (storitev popravljen na ${service.name})`)
      return
    }
  }

  // Template (oz. če je ni): ustvari s tremi obiski ~4 tedne narazen
  const existing = await db.client.findFirst({ where: { name: 'Nuša Leban' } })
  if (existing) {
    console.log('Nuša Leban že obstaja — preskočim')
    return
  }
  const client = await db.client.create({
    data: { name: 'Nuša Leban', phone: '+38641555991' },
  })
  for (const daysAgo of [126, 98, 70]) {
    const start = new Date(now - daysAgo * DAY - 10 * 3600_000) // 10:00 wall-clock
    await db.appointment.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        startAt: start,
        endAt: new Date(start.getTime() + 45 * 60_000),
        status: 'completed',
        priceCents: service.priceCents,
      },
    })
  }
  console.log(`Dodana Nuša Leban (3 obiski ~4 tedne narazen, zadnji pred 10 tedni, ${service.name})`)
}

async function main() {
  // --- custom.db ---
  const custom = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } })
  try {
    for (const testPhone of ['+38641555998', '+38641555997']) {
      const c = await custom.client.findFirst({ where: { phone: testPhone } })
      if (c) {
        await custom.appointment.deleteMany({ where: { clientId: c.id } })
        await custom.client.delete({ where: { id: c.id } })
        console.log(`custom.db: pobrisana testna stranka ${c.name}`)
      }
    }
    await addExample(custom, 'Ivana Izgubljena')
  } finally {
    await custom.$disconnect()
  }

  // --- demo-template.db ---
  const template = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/demo-template.db' } } })
  try {
    await addExample(template)
  } finally {
    await template.$disconnect()
  }
  console.log('✓ Obe bazi pripravljeni')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
