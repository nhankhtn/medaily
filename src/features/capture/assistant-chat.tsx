'use client'

import { Loader2, RotateCcw, Send, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { isFilingTarget, type FilingTarget } from '@/lib/capture/modules'
import { readEvents } from '@/lib/sse'
import { cn } from '@/lib/utils'
import { resetAssistant } from '@/server/actions/assistant'

type Message = {
  role: 'user' | 'model'
  text: string
  reason?: string | null
  /**
   * Still being written. The bubble is on screen so the person can read as the
   * tokens land; chrome that belongs on a finished answer (reason, offer) waits.
   */
  drafting?: boolean
  /**
   * The note this answer might have been. Read as a question, but it carried
   * an amount — so the way to file it after all is one tap under the answer,
   * rather than typing it again somewhere else.
   */
  offer?: string
}

/**
 * An amount, roughly. Only ever used to offer a second reading of something
 * already answered, so a false positive costs a button nobody presses.
 */
const AMOUNT = /\d[\d.,]*\s*(k|ngh[iì]n|ng[aà]n|tr|tri[eệ]u|đ|vnd)\b/i

/** The agent's three nodes, in the order a run walks them. */
const STEPS = ['route', 'load', 'respond'] as const
type Step = (typeof STEPS)[number]

function isStep(value: unknown): value is Step {
  return STEPS.includes(value as Step)
}

/** Eight a minute. Worth its own wording: waiting a moment fixes it. */
class RateLimited extends Error {}

/**
 * One message, read as the agent works it out.
 *
 * Two ways it can end. A question is answered, and the step and the reading
 * land while that answer is still being written. A note is not answered at
 * all: the agent stops at the decision and names the form it belongs in.
 */
type RunResult =
  | { filed: null; answer: string; reason: string | null }
  | { filed: FilingTarget; answer: null; reason: string | null }

async function run(
  message: string,
  opening: string,
  on: {
    step: (step: Step) => void
    reading: (reason: string) => void
    /** Each token chunk of the answer, as Gemini writes it. */
    delta: (text: string) => void
  },
): Promise<RunResult> {
  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, opening }),
  })

  if (response.status === 429) throw new RateLimited()
  if (!response.ok || !response.body) throw new Error(`assistant answered ${response.status}`)

  let answer = ''
  let reason: string | null = null

  for await (const event of readEvents(response.body)) {
    const payload = JSON.parse(event.data)

    if (event.event === 'step' && isStep(payload.node)) on.step(payload.node)
    else if (event.event === 'reason') {
      reason = payload.reason
      on.reading(payload.reason)
    } else if (event.event === 'file' && isFilingTarget(payload.module)) {
      /*
       * Straight out. Nothing follows a filing — the run ends at the decision,
       * and what is left of the stream is the checkpoint being written, which
       * took three seconds to close on a note that was already decided.
       * Leaving here cancels the read, which hangs up on the agent.
       */
      return { filed: payload.module, answer: null, reason }
    } else if (event.event === 'delta' && typeof payload.text === 'string') {
      on.delta(payload.text)
    } else if (event.event === 'answer') answer = payload.answer
    else if (event.event === 'failed') throw new Error('the run reported a failure')
  }

  // A stream that ends without one has failed quietly, which is still failing.
  if (!answer) throw new Error('the run ended with no answer')
  return { filed: null, answer, reason }
}

/** The phrases that open a conversation, offered so the first ask is one tap. */
const STARTERS = ['thisWeek', 'spending', 'todo', 'howTo'] as const

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
 *
 * Not everything typed here is a question. "hôm nay tiêu 30k" is a note, and
 * the agent says so instead of answering it — the box then opens the form that
 * writes it down, which is the same form the menu would have opened.
 */
export function AssistantChat({
  onLeave,
  onFile,
}: {
  onLeave: () => void
  /** A note, and the form it goes in. The box swaps itself out for that form. */
  onFile: (target: FilingTarget, text: string) => void
}) {
  const t = useTranslations('capture.assistant')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  /*
   * Plain state rather than `useTransition`: a transition renders at low
   * priority and holds its updates until it settles, which for a run reported
   * step by step means the steps all land at the end, together, useless.
   */
  const [pending, setPending] = useState(false)
  /** Where the run has got to, and how it read the question — both live. */
  const [step, setStep] = useState<Step | null>(null)
  const [reading, setReading] = useState<string | null>(null)
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
  }, [messages, pending, step, reading])

  const send = (message: string) => {
    const trimmed = message.trim()
    if (trimmed.length < 2 || pending) return

    setMessages((previous) => [...previous, { role: 'user', text: trimmed }])
    setText('')
    // Routing has begun by the time the request lands, and nothing on the wire
    // will say so — the first step is set here or it is never shown.
    setStep('route')
    setReading(null)

    void (async () => {
      setPending(true)
      let drafting = false
      try {
        const result = await run(trimmed, opening, {
          step: setStep,
          reading: setReading,
          delta: (chunk) => {
            drafting = true
            setMessages((previous) => {
              const last = previous.at(-1)
              if (last?.role === 'model' && last.drafting) {
                return [
                  ...previous.slice(0, -1),
                  { ...last, text: last.text + chunk },
                ]
              }
              return [...previous, { role: 'model', text: chunk, drafting: true }]
            })
          },
        })

        if (result.filed) {
          // Left in the transcript on the way past, so coming back to a panel
          // that swapped itself out does not look like a question gone missing.
          setMessages((previous) => {
            const withoutDraft = drafting
              ? previous.filter((message) => !(message.role === 'model' && message.drafting))
              : previous
            return [
              ...withoutDraft,
              { role: 'model', text: t(`filed.${result.filed}`), reason: result.reason },
            ]
          })
          onFile(result.filed, trimmed)
          return
        }

        setMessages((previous) => {
          const withoutDraft = previous.filter(
            (message) => !(message.role === 'model' && message.drafting),
          )
          return [
            ...withoutDraft,
            {
              role: 'model',
              text: result.answer,
              reason: result.reason,
              offer: AMOUNT.test(trimmed) ? trimmed : undefined,
            },
          ]
        })
      } catch (error) {
        console.error('assistant', error)
        toast.error(t(error instanceof RateLimited ? 'rateLimited' : 'failed'))
        // Hand the message back rather than swallowing it into a failed turn.
        setMessages((previous) =>
          previous
            .filter((message) => !(message.role === 'model' && message.drafting))
            .slice(0, -1),
        )
        setText(trimmed)
      } finally {
        setPending(false)
        setStep(null)
        setReading(null)
      }
    })()
  }

  const clear = () => {
    void (async () => {
      setPending(true)
      try {
        const result = await resetAssistant(opening)
        if (!result.ok) {
          toast.error(t('failed'))
          return
        }
        setMessages([])
      } finally {
        setPending(false)
      }
    })()
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
                  {/* Answered, but it had an amount in it. The other reading
                      is one tap away rather than a retype somewhere else. */}
                  {message.offer ? (
                    <button
                      type="button"
                      onClick={() => onFile('finance', message.offer as string)}
                      className="glass hover:bg-surface-2 mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                    >
                      <Wallet className="size-3" />
                      {t('fileAsSpending')}
                    </button>
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
        <div className="text-text-subtle space-y-1 text-xs">
          {/* Once tokens are landing the bubble above is the progress; the step
              line would just bounce under a growing answer. */}
          {!messages.some((message) => message.drafting) ? (
            <p className="flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" />
              {t(step ? `steps.${step}` : 'thinking')}
            </p>
          ) : null}
          {/* The reading arrives well before the answer does. Showing it here
              means a question taken the wrong way is caught while it is still
              cheaper to rephrase than to read a wrong answer. */}
          {reading ? <p className="pl-5 leading-snug">{t('read', { reason: reading })}</p> : null}
        </div>
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
              className="glass hover:bg-surface-2 rounded-full px-2.5 py-1 text-xs disabled:opacity-50"
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
    </div>
  )
}
