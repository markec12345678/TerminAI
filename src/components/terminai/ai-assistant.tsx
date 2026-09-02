'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Sparkles, Send, Bot, RotateCcw } from 'lucide-react'

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Koliko stane barvanje?',
  'Kdaj imate proste termine v soboto?',
  'Katero storitev mi priporočate?',
  'Kako se lahko odpovem termin?',
]

export function AiAssistant() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: 'Pozdravljeni! Sem Ana, recepcionarka Studia Aura. 👋 Kako vam lahko pomagam?',
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || thinking) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    setThinking(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => m.role === 'user' || m.role === 'assistant') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI ni odgovoril')
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Oprostite, trenutno ne morem odgovoriti. Pokličite nas na +386 40 123 456.' },
      ])
      toast({ title: 'AI ni odgovoril', description: 'Poskusite znova.', variant: 'destructive' })
    } finally {
      setThinking(false)
    }
  }

  return (
    <Card className="flex h-full flex-col border-border/60 shadow-xl shadow-primary/5">
      <CardHeader className="border-b bg-secondary/60 py-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" aria-label="na voljo" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold leading-tight">Ana — AI recepcionarka</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> AI
              </span>
            </div>
            <p className="text-xs text-muted-foreground">odgovarja 24/7 · slovenščina</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setMessages([{ role: 'assistant', content: 'Pozdravljeni! Sem Ana, recepcionarka Studia Aura. 👋 Kako vam lahko pomagam?' }])
            }
            aria-label="Ponastavi pogovor"
            title="Ponastavi pogovor"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div ref={scrollRef} className="terminai-scroll min-h-[280px] flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border bg-muted/50'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border bg-muted/50 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary/50 [animation-delay:300ms]" />
                <span className="sr-only">Ana razmišlja</span>
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Predlagana vprašanja">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Vpišite sporočilo …"
            aria-label="Sporočilo Ani"
            maxLength={500}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"
          />
          <Button type="submit" size="icon" disabled={thinking || input.trim().length === 0} aria-label="Pošlji">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
