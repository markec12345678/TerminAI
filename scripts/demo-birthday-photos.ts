/**
 * Enkratni demo skript — Task 15:
 * 1. Rojstni dnevi obstoječim demo strankam (Ana=danes, Petra=+3, Maja=+9, Marko=+25)
 * 2. 1 demo fotografija za Ano (test API-ja) — vezana na njen zadnji zaključen obisk
 * Poženi: bun run scripts/demo-birthday-photos.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// 1×1 sličica — samo za inicialni test API-ja (nadomeščena s pravo kasneje)
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICAgKDA8MCgsOCwgIDRENDg8QEBEQCgsSExIQEA8QEBD/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/2gAIAQEAAD8A0Kg/9k='

async function main() {
  const clients = await db.client.findMany()
  const byName = new Map(clients.map((c) => [c.name, c]))

  const today = new Date()
  const bdIn = (days: number) => {
    const d = new Date(today.getTime() + days * 86400000)
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  const plan: Array<[string, string]> = [
    ['Ana Novak', bdIn(0)],
    ['Petra Zupan', bdIn(3)],
    ['Maja Kos', bdIn(9)],
    ['Marko Kovač', bdIn(25)],
  ]
  for (const [name, birthday] of plan) {
    const c = byName.get(name)
    if (c) {
      await db.client.update({ where: { id: c.id }, data: { birthday } })
      console.log(`✓ ${name}: rojstni dan ${birthday}`)
    }
  }

  // Demo fotografija za Ano — na njen zadnji zaključen obisk
  const ana = byName.get('Ana Novak')
  if (ana) {
    const existing = await db.photo.count({ where: { clientId: ana.id } })
    if (existing === 0) {
      const lastDone = await db.appointment.findFirst({
        where: { clientId: ana.id, status: 'completed' },
        orderBy: { startAt: 'desc' },
      })
      await db.photo.create({
        data: {
          clientId: ana.id,
          appointmentId: lastDone?.id ?? null,
          kind: 'result',
          dataUrl: TINY_JPEG,
          thumbUrl: TINY_JPEG,
          caption: 'demo — nadomesti s pravo fotografijo',
        },
      })
      console.log(`✓ demo fotografija za Ano (obisk ${lastDone?.startAt.toISOString() ?? 'brez'})`)
    }
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
