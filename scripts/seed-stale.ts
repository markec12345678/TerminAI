/**
 * E2E pomoč: ustvari "izgubljeno" stranko (win-back kandidat) in
 * ponavljajoč termin za test pametnega rebookinga v dev bazi.
 * Zagon: bun scripts/seed-stale.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: 'file:/home/z/my-project/db/custom.db' } } })

const DAY = 86_400_000
const now = Date.now()

async function main() {
  const business = await db.business.findFirst()
  if (!business) throw new Error('Ni business zapisa')
  const service = await db.service.findFirst({ where: { active: true } })
  if (!service) throw new Error('Ni storitve')

  // 1) Izgubljena stranka: obiski vsake ~4 tedne, zadnji pred 10 tedni
  //    (običajno 4 tedne → prag 6 tednov → 10 tednov = ZAMUDILA)
  const stale =
    (await db.client.findFirst({ where: { phone: '+38641555999' } })) ??
    (await db.client.create({ data: { name: 'Ivana Izgubljena', phone: '+38641555999' } }))
  await db.appointment.deleteMany({ where: { clientId: stale.id } })
  for (const daysAgo of [126, 98, 70]) {
    const start = new Date(now - daysAgo * DAY - 10 * 3600_000) // 10:00 wall-clock
    await db.appointment.create({
      data: {
        clientId: stale.id,
        serviceId: service.id,
        startAt: start,
        endAt: new Date(start.getTime() + 45 * 60_000),
        status: 'completed',
        priceCents: service.priceCents,
      },
    })
  }
  console.log('OK: Ivana Izgubljena (3 obiski, zadnji pred 10 tedni, ritem ~4 tedne)')

  // 2) Stranka z neredkim obiskom (kandidat "dolgo brez vzorca" → fiksni prag 8)
  const rare =
    (await db.client.findFirst({ where: { phone: '+38641555998' } })) ??
    (await db.client.create({ data: { name: 'Rebeka Redka', phone: '+38641555998' } }))
  await db.appointment.deleteMany({ where: { clientId: rare.id } })
  for (const daysAgo of [100, 85]) {
    const start = new Date(now - daysAgo * DAY - 11 * 3600_000)
    await db.appointment.create({
      data: {
        clientId: rare.id,
        serviceId: service.id,
        startAt: start,
        endAt: new Date(start.getTime() + 45 * 60_000),
        status: 'completed',
        priceCents: service.priceCents,
      },
    })
  }
  console.log('OK: Rebeka Redka (2 obiska, zadnji pred ~12 tedni, brez vzorca)')

  // 3) Današnji končan termin s recurWeeks=5 → test predloga rebooka
  const recurring =
    (await db.client.findFirst({ where: { phone: '+38641555997' } })) ??
    (await db.client.create({ data: { name: 'Zala Ponavljava', phone: '+38641555997' } }))
  await db.appointment.deleteMany({ where: { clientId: recurring.id } })
  const todayStart = new Date(now - 9 * 3600_000) // danes ~ ob 9:00
  const appt = await db.appointment.create({
    data: {
      clientId: recurring.id,
      serviceId: service.id,
      startAt: todayStart,
      endAt: new Date(todayStart.getTime() + 60 * 60_000),
      status: 'completed',
      priceCents: service.priceCents,
      recurWeeks: 5,
    },
  })
  console.log('OK: Zala Ponavljava (danes, recurWeeks=5, id=' + appt.id + ')')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
