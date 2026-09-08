'use client'

import { CornerDownLeft, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { isISODate, type ISODate } from '@/lib/dates'
import { NAV_ITEMS } from '@/lib/nav'
import { saveDay } from '@/server/actions/daily'
import { cn } from '@/lib/utils'

/**
 * Spec 22.1 — the fastest path for a returning user: jump to any page, or log a
 * metric without leaving the current screen. Verbs are parsed from plain text
 * (`sleep 7.5`, `study 45`) and a bare date opens that day.
 */
const METRIC_VERBS: { keywords: string[]; field: string; metricKey: string; kind: 'scale' | 'hours' | 'minutes' }[] = [
  { keywords: ['energy'], field: 'energy', metricKey: 'energy', kind: 'scale' },
  { keywords: ['mood'], field: 'mood', metricKey: 'mood', kind: 'scale' },
  { keywords: ['sleep'], field: 'sleepHours', metricKey: 'sleep', kind: 'hours' },
  { keywords: ['study', 'learn'], field: 'technicalStudyMinutes', metricKey: 'study', kind: 'minutes' },
  { keywords: ['deep', 'deepwork'], field: 'deepWorkMinutes', metricKey: 'deepWork', kind: 'minutes' },
  { keywords: ['exercise', 'gym', 'run'], field: 'exerciseMinutes', metricKey: 'exercise', kind: 'minutes' },
  { keywords: ['read', 'reading'], field: 'readingMinutes', metricKey: 'reading', kind: 'minutes' },
  { keywords: ['ent', 'entertainment'], field: 'entertainmentMinutes', metricKey: 'entertainment', kind: 'minutes' },
  { keywords: ['english'], field: 'englishMinutes', metricKey: 'english', kind: 'minutes' },
]

type Command =
  | { type: 'nav'; id: string; label: string; href: string }
  | { type: 'metric'; id: string; label: string; field: string; value: number }
  | { type: 'date'; id: string; label: string; date: ISODate }

export function CommandPalette({ today }: { today: ISODate }) {
  const t = useTranslations('palette')
  const tn = useTranslations('nav')
  const tm = useTranslations('metrics')
  const tc = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const chord = useRef<string | null>(null)

  const commands = useMemo<Command[]>(() => {
    const trimmed = query.trim()
    const lower = trimmed.toLowerCase()
    const out: Command[] = []

    // A bare date opens that day — the fastest way back into history.
    if (isISODate(trimmed) && trimmed <= today) {
      out.push({
        type: 'date',
        id: `date:${trimmed}`,
        label: t('gotoDate', { date: trimmed }),
        date: trimmed,
      })
    }

    const match = /^([a-zA-Z]+)\s+(\d+(?:[.,]\d+)?)$/.exec(trimmed)
    if (match) {
      const [, word, rawValue] = match
      const verb = METRIC_VERBS.find((candidate) =>
        candidate.keywords.some((keyword) => keyword.startsWith((word ?? '').toLowerCase())),
      )
      const parsed = Number((rawValue ?? '').replace(',', '.'))
      if (verb && Number.isFinite(parsed)) {
        const value =
          verb.kind === 'scale'
            ? Math.min(10, Math.max(1, Math.round(parsed)))
            : verb.kind === 'hours'
              ? Math.min(24, Math.max(0, parsed))
              : Math.min(1440, Math.max(0, Math.round(parsed)))
        out.push({
          type: 'metric',
          id: `metric:${verb.field}`,
          label: t('setMetric', { metric: tm(verb.metricKey), value }),
          field: verb.field,
          value,
        })
      }
    }

    for (const item of NAV_ITEMS) {
      const label = tn(item.key)
      if (!lower || label.toLowerCase().includes(lower) || item.key.includes(lower)) {
        out.push({ type: 'nav', id: `nav:${item.key}`, label, href: item.href })
      }
    }

    return out
  }, [query, today, t, tn, tm])

  const run = useCallback(
    (command: Command) => {
      if (command.type === 'nav') {
        setOpen(false)
        router.push(command.href)
        return
      }
      if (command.type === 'date') {
        setOpen(false)
        router.push(command.date === today ? '/daily' : `/daily/${command.date}`)
        return
      }

      startTransition(async () => {
        const result = await saveDay({
          date: today,
          patch: { [command.field]: command.value },
          source: 'manual',
        })
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        toast.success(command.label)
        setOpen(false)
        setQuery('')
        router.refresh()
      })
    },
    [router, today, tc],
  )

  // ⌘K opens; `g` then a letter jumps; both ignore typing inside fields.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inField = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (event.key === 'Escape') {
        setOpen(false)
        chord.current = null
        return
      }
      if (inField || event.metaKey || event.ctrlKey || event.altKey) return

      if (chord.current === 'g') {
        const map: Record<string, string> = {
          d: '/daily',
          h: '/habits',
          g: '/goals',
          a: '/analytics',
          s: '/settings',
          o: '/',
        }
        const href = map[event.key.toLowerCase()]
        chord.current = null
        if (href) {
          event.preventDefault()
          router.push(href)
        }
        return
      }
      if (event.key === 'g') {
        chord.current = 'g'
        setTimeout(() => (chord.current = null), 1500)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className="flex h-9 items-center gap-2 rounded-full border border-border-base bg-surface-2 px-3 text-xs text-text-subtle hover:border-border-strong"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">{t('open')}</span>
        <kbd className="hidden rounded border border-border-base px-1 font-sans text-[10px] sm:inline">
          {t('hint')}
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[10vh]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius)] border border-border-strong bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('open')}
      >
        <div className="flex items-center gap-2 border-b border-border-base px-3">
          <Search className="size-4 shrink-0 text-text-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-text-subtle"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((prev) => Math.min(commands.length - 1, prev + 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((prev) => Math.max(0, prev - 1))
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                const command = commands[active]
                if (command) run(command)
              }
            }}
          />
        </div>

        <ul className="max-h-72 overflow-y-auto py-1">
          {commands.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-subtle">{t('noResults')}</li>
          ) : (
            commands.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  disabled={pending}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm',
                    index === active ? 'bg-accent-soft text-text' : 'text-text-muted',
                  )}
                >
                  <span className="truncate">{command.label}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-text-subtle">
                    {command.type === 'nav' ? t('navigation') : t('actions')}
                    {index === active ? <CornerDownLeft className="size-3" /> : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
