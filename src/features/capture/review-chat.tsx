'use client'

import { Loader2, Send } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { fromISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { askReview } from '@/server/actions/review-chat'

type Message = { role: 'user' | 'assistant'; text: string }

/** Pinned once a period is open, so a follow-up stays on the same weeks. */
type Period = { period: 'weekly' | 'monthly'; key: string; start: string; end: string }

/** The phrases that open a period, offered as chips so the first ask is one tap. */
const STARTERS = ['thisWeek', 'lastWeek', 'thisMonth'] as const

export function ReviewChat() {
  const t = useTranslations('capture.review')
  const format = useFormatter()
  const [messages, setMessages] = useState<Message[]>([])
  const [period, setPeriod] = useState<Period | null>(null)
  const [text, setText] = useState('')
  const [pending, startAsking] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  // Follow the conversation down as it grows; the panel is short.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending])

  const send = (message: string) => {
    const trimmed = message.trim()
    if (trimmed.length < 2 || pending) return

    // Paired off the visible transcript: the server keeps no open thread, so
    // what is on screen is the whole conversation the model gets to see.
    const history = exchangesOf(messages)
    setMessages((previous) => [...previous, { role: 'user', text: trimmed }])
    setText('')

    startAsking(async () => {
      const result = await askReview({
        message: trimmed,
        history,
        ...(period ? { period: period.period, key: period.key } : {}),
      })

      if (!result.ok) {
        toast.error(t(result.error === 'rate_limited' ? 'rateLimited' : 'failed'))
        // Hand the message back rather than swallowing it into a failed turn.
        setMessages((previous) => previous.slice(0, -1))
        setText(trimmed)
        return
      }

      setPeriod({ period: result.period, key: result.range.start, ...result.range })
      setMessages((previous) => [...previous, { role: 'assistant', text: result.answer }])
    })
  }

  const answered = messages.some((message) => message.role === 'assistant')

  return (
    <div className="space-y-3">
      {period ? (
        <Badge tone="neutral">
          {t('reviewing', {
            label: format.dateTimeRange(fromISODate(period.start), fromISODate(period.end), {
              day: 'numeric',
              month: 'short',
            }),
          })}
        </Badge>
      ) : (
        <p className="text-text-subtle text-xs leading-snug">{t('intro')}</p>
      )}

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
              {message.role === 'assistant' ? (
                <Markdown>{message.text}</Markdown>
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

      <div className="flex flex-wrap gap-1.5">
        {messages.length === 0
          ? STARTERS.map((starter) => (
              <Chip key={starter} onClick={() => send(t(`starters.${starter}`))} disabled={pending}>
                {t(`starters.${starter}`)}
              </Chip>
            ))
          : null}
        {answered && !pending ? (
          <Chip onClick={() => send(t('askSuggestions'))}>{t('askSuggestions')}</Chip>
        ) : null}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          // A chat message is usually one line: Enter sends, Shift+Enter breaks.
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send(text)
            }
          }}
          placeholder={answered ? t('placeholderMore') : t('placeholder')}
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

/** Messages walk user/assistant; the model wants them paired. */
function exchangesOf(messages: Message[]): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = []
  for (let index = 0; index < messages.length - 1; index += 1) {
    const question = messages[index]
    const answer = messages[index + 1]
    if (question?.role === 'user' && answer?.role === 'assistant') {
      pairs.push({ question: question.text, answer: answer.text })
    }
  }
  return pairs
}

function Chip({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="glass hover:bg-surface-2 rounded-full px-2.5 py-1 text-xs disabled:opacity-50"
    >
      {children}
    </button>
  )
}
