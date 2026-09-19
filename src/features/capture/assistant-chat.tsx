'use client'

import { Loader2, RotateCcw, Send } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import { askAssistant, resetAssistant } from '@/server/actions/assistant'

type Message = { role: 'user' | 'model'; text: string; reason?: string | null }

/** The phrases that open a conversation, offered so the first ask is one tap. */
const STARTERS = ['thisWeek', 'spending', 'todo'] as const

/** Where an opening that never got to end itself waits to be collected. */
const ABANDONED = 'capture.assistant.opening'

function newOpening(): string {
  // randomUUID wants a secure context, which a phone on the LAN is not.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The capture box's assistant, answered by the agent service.
 *
 * One conversation per opening of the box, and each opening names its own. A
 * thread nobody has written to is already empty, so the panel is ready the
 * moment it is drawn — there is nothing to clear and nothing to wait for.
 *
 * Ending it is the part that costs a call, and it happens on the way out where
 * nobody is watching. A tab closed with the panel still open leaves its thread
 * behind; there is never more than one, and the next opening collects it.
 */
export function AssistantChat({ onLeave }: { onLeave: () => void }) {
  const t = useTranslations('capture.assistant')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [pending, startAsking] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)
  const [opening] = useState(newOpening)

  useEffect(() => {
    let abandoned: string | null = null
    try {
      abandoned = sessionStorage.getItem(ABANDONED)
      sessionStorage.setItem(ABANDONED, opening)
    } catch {
      // A browser that refuses storage just forgets an abandoned thread.
    }
    if (abandoned) void resetAssistant(abandoned)

    return () => {
      void resetAssistant(opening)
      try {
        sessionStorage.removeItem(ABANDONED)
      } catch {
        // As above.
      }
    }
  }, [opening])

  // Follow the conversation down as it grows; the panel is short.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending])

  const send = (message: string) => {
    const trimmed = message.trim()
    if (trimmed.length < 2 || pending) return

    setMessages((previous) => [...previous, { role: 'user', text: trimmed }])
    setText('')

    startAsking(async () => {
      const result = await askAssistant({ message: trimmed, opening })

      if (!result.ok) {
        toast.error(t(result.error === 'rate_limited' ? 'rateLimited' : 'failed'))
        // Hand the message back rather than swallowing it into a failed turn.
        setMessages((previous) => previous.slice(0, -1))
        setText(trimmed)
        return
      }

      setMessages((previous) => [
        ...previous,
        { role: 'model', text: result.answer, reason: result.decision?.reason ?? null },
      ])
    })
  }

  const clear = () => {
    startAsking(async () => {
      const result = await resetAssistant(opening)
      if (!result.ok) {
        toast.error(t('failed'))
        return
      }
      setMessages([])
    })
  }

  return (
    <div className="space-y-3">
      {/* Only ever holds the one control, so it pushes it to the right itself. */}
      <div className="flex items-start justify-end gap-2">
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="text-text-subtle hover:text-text inline-flex shrink-0 items-center gap-1 text-xs disabled:opacity-50"
          >
            <RotateCcw className="size-3" />
            {t('startOver')}
          </button>
        ) : null}
      </div>

      {messages.length > 0 ? (
        <ul className="space-y-2">
          {messages.map((message, index) => (
            <li
              key={index}
              className={cn(
                'rounded-[var(--radius)] px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'bg-accent-soft text-text ml-6'
                  : 'bg-surface-2 text-text mr-2',
              )}
            >
              {message.role === 'model' ? (
                <>
                  <Markdown>{message.text}</Markdown>
                  {/* The route it took, in the person's own words. A question
                      read the wrong way should be visible, not silent. */}
                  {message.reason ? (
                    <p className="text-text-subtle mt-2 text-xs leading-snug">
                      {t('read', { reason: message.reason })}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{message.text}</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {pending ? (
        <p className="text-text-subtle flex items-center gap-2 text-xs">
          <Loader2 className="size-3 animate-spin" />
          {t('thinking')}
        </p>
      ) : null}

      <div ref={endRef} />

      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => send(t(`starters.${starter}`))}
              disabled={pending}
              className="border-border-strong bg-surface hover:bg-surface-2 rounded-full border px-2.5 py-1 text-xs disabled:opacity-50"
            >
              {t(`starters.${starter}`)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(event) => {
            // A leading slash is nobody's question. It is the way out of here,
            // and the placeholder says so.
            if (event.target.value.startsWith('/')) {
              onLeave()
              return
            }
            setText(event.target.value)
          }}
          // A chat message is usually one line: Enter sends, Shift+Enter breaks.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send(text)
            }
          }}
          placeholder={messages.length > 0 ? t('placeholderMore') : t('placeholder')}
          maxLength={1000}
          rows={2}
          disabled={pending}
          className="min-h-11 flex-1 text-base sm:text-sm"
        />
        <Button
          type="button"
          size="iconSm"
          onClick={() => send(text)}
          disabled={pending || text.trim().length < 2}
          aria-label={t('send')}
        >
          <Send className="size-4" />
        </Button>
      </div>

      <p className="text-text-subtle text-xs leading-snug">{t('privacy')}</p>
    </div>
  )
}
