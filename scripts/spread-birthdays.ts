/**
 * Rozporedi demo rojstne dneve čez leto (obe bazi: custom.db + demo-template.db).
 *
 * Zakaj: vsi demo rojstni dnevi so bili septembra — na USB demou bi kartica
 * ob drugem letnem času padla na prazno. Sedaj: septembrski sklop (Ana danes,
 * Petra čez 3, Maja čez 9 dni — živa predstavitev) + po en razporejen
 * v novembru, januarju in maju, da "naslednja" vrstica nikoli ni prazna.
 *
 * Zagon: bun scripts/spread-birthdays.ts
 */
import { PrismaClient } from '@prisma/client'

/** ime → MM-DD */
const PLAN: Record<string, string> = {
  'Ana Novak': '09-05',
  'Petra Zupan': '09-08',
  'Maja Kos': '09-14',
  'Marko Kovač': '09-30',
  'Luka Bizjak': '11-21',
  'Nuša Leban': '01-17',
  'Tina Hočevar': '05-23',
}

const DBS = [
  'file:/home/z/my-project/db/custom.db',
  'file:/home/z/my-project/db/demo-template.db',
]

for (const url of DBS) {
  const db = new PrismaClient({ datasources: { db: { url } } })
  let changed = 0
  for (const [name, birthday] of Object.entries(PLAN)) {
    const res = await db.client.updateMany({ where: { name }, data: { birthday } })
    changed += res.count
  }
  const rows = await db.client.findMany({
    where: { birthday: { not: null } },
    select: { name: true, birthday: true },
    orderBy: { name: 'asc' },
  })
  console.log(`${url}: posodobljenih ${changed} zapisov →`, JSON.stringify(rows))
  await db.$disconnect()
}
