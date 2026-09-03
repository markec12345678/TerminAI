import { Navbar } from '@/components/terminai/navbar'
import { Hero } from '@/components/terminai/hero'
import { DemoSection } from '@/components/terminai/demo-section'
import { Features, Pricing, Faq, FinalCta } from '@/components/terminai/sections'
import { Footer } from '@/components/terminai/footer'
import { CancelDialog } from '@/components/terminai/cancel-dialog'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <DemoSection />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      {/* Odpoved termina prek povezave (/?cancel=token) — stranka odpove sama */}
      <CancelDialog />
    </div>
  )
}
