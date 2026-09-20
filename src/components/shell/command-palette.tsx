'use client'

import {
  CalendarDays,
  ClipboardList,
  CornerDownLeft,
  FolderKanban,
  Gauge,
  Loader2,
  NotebookPen,
  Search,
  SquareCheck,
  StickyNote,
  Target,
  User,
  type LucideIcon,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { isISODate, type ISODate } from '@/lib/dates'
import { formatDate } from '@/lib/format/dates'
import { NAV_ITEMS } from '@/lib/nav'
import { PATHS } from '@/lib/paths'
import { plainSnippet } from '@/lib/search'
import { useKeyboardInset } from '@/components/ui/use-viewport-inset'
import { useShortcut } from '@/features/shortcuts/provider'
import { saveDay } from '@/server/actions/daily'
import type { SearchHit } from '@/server/repositories/search'
import { cn } from '@/lib/utils'
import { useContentSearch } from './use-content-search'

/**
 * Spec 22.1 — the fastest path for a returning user: jump to any page, log a
 * metric without leaving the current screen, or find anything ever written.
 * Verbs are parsed from plain text (`sleep 7.5`, `study 45`) and a bare date
 * opens that day.
 */
const METRIC_VERBS: {
  keywords: string[]
  field: string
  metricKey: string
  kind: 'scale' | 'hours' | 'minutes'
}[] = [
  { keywords: ['energy'], field: 'energy', metricKey: 'energy', kind: 'scale' },
  { keywords: ['mood'], field: 'mood', metricKey: 'mood', kind: 'scale' },
  { keywords: ['sleep'], field: 'sleepHours', metricKey: 'sleep', kind: 'hours' },
  {
    keywords: ['study', 'learn'],
    field: 'technicalStudyMinutes',
    metricKey: 'study',
    kind: 'minutes',
  },
  {
    keywords: ['deep', 'deepwork'],
    field: 'deepWorkMinutes',
    metricKey: 'deepWork',
    kind: 'minutes',
  },
  {
    keywords: ['exercise', 'gym', 'run'],
    field: 'exerciseMinutes',
    metricKey: 'exercise',
    kind: 'minutes',
  },
  { keywords: ['read', 'reading'], field: 'readingMinutes', metricKey: 'reading', kind: 'minutes' },
  {
    keywords: ['ent', 'entertainment'],
    field: 'entertainmentMinutes',
    metricKey: 'entertainment',
    kind: 'minutes',
  },
  { keywords: ['english'], field: 'englishMinutes', metricKey: 'english', kind: 'minutes' },
]

/**
 * What each kind of row looks like. A page and a note both open on Enter, so
 * the icon is how you tell before you press it which one you are about to get.
 */
const HIT_ICONS: Record<SearchHit['type'], LucideIcon> = {
  note: StickyNote,
  journal: NotebookPen,
  daily: ClipboardList,
  task: SquareCheck,
  project: FolderKanban,
  goal: Target,
  person: User,
}

type Command =
  | { type: 'nav'; id: string; label: string; icon: LucideIcon; kind: string; href: string }
  | {
      type: 'hit'
      id: string
      label: string
      icon: LucideIcon
      kind: string
      href: string
      detail: string | null
    }
  | {
      type: 'metric'
      id: string
      label: string
      icon: LucideIcon
      kind: string
      field: string
      value: number
    }
  | { type: 'date'; id: string; label: string; icon: LucideIcon; kind: string; date: ISODate }

export function CommandPalette({ today }: { today: ISODate }) {
  const t = useTranslations('palette')
  const ts = useTranslations('search')
  const tn = useTranslations('nav')
  const tm = useTranslations('metrics')
  const tc = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  // On a phone the list would otherwise run on underneath the keyboard.
  const keyboard = useKeyboardInset()

  const { hits, searching, eligible } = useContentSearch(query, open)

  const commands = useMemo<Command[]>(() => {
    const trimmed = query.trim()
    const lower = trimmed.toLowerCase()
    const out: Command[] = []

    // A bare date opens that day — the fastest way back into history.
    if (isISODate(trimmed) && trimmed <= today) {
      out.push({
        type: 'date',
        id: `date:${trimmed}`,
        label: t('gotoDate', { date: formatDate(trimmed) }),
        icon: CalendarDays,
        kind: t('navigation'),
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
          icon: Gauge,
          kind: t('actions'),
          field: verb.field,
          value,
        })
      }
    }

    for (const item of NAV_ITEMS) {
      const label = tn(item.key)
      if (!lower || label.toLowerCase().includes(lower) || item.key.includes(lower)) {
        out.push({
          type: 'nav',
          id: `nav:${item.key}`,
          label,
          icon: item.icon,
          kind: t('navigation'),
          href: item.href,
        })
      }
    }

    return out
  }, [query, today, t, tn, tm])

  const items = useMemo<Command[]>(() => {
    const found = hits.map<Command>((hit) => ({
      type: 'hit',
      id: `hit:${hit.type}:${hit.id}`,
      label: hit.title,
      icon: HIT_ICONS[hit.type],
      kind: ts(`types.${hit.type}`),
      href: hit.href,
      detail: plainSnippet(hit.snippet) ?? (hit.date ? formatDate(hit.date) : null),
    }))

    return [...commands, ...found]
  }, [commands, hits, ts])

  const run = useCallback(
    (command: Command) => {
      if (command.type === 'nav' || command.type === 'hit') {
        setOpen(false)
        router.push(command.href)
        return
      }
      if (command.type === 'date') {
        setOpen(false)
        router.push(command.date === today ? PATHS.daily : PATHS.dailyOn(command.date))
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

  useShortcut('palette', () => setOpen((prev) => !prev))

  // Escape is not in the registry: closing what is open is not a preference.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // The list scrolls now, so the arrow keys have to carry the view with them.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('open')}
      className="glass text-text-subtle hover:border-border-strong flex h-9 items-center gap-2 rounded-full px-3 text-xs"
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">{t('open')}</span>
      <kbd className="border-border-base hidden rounded border px-1 font-sans text-[10px] sm:inline">
        {t('hint')}
      </kbd>
    </button>
  )

  if (!open) return trigger

  /**
   * The header is `sticky` with a backdrop filter, which makes it a stacking
   * context of its own: no z-index set in here can lift the palette above the
   * capture button outside it. The portal takes the overlay out to the body,
   * where its z-index means what it says.
   */
  return (
    <>
      {trigger}
      {createPortal(
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-overlay/80 p-4 pt-[7dvh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="glass-strong flex max-h-[calc(80dvh-var(--keyboard-inset))] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius)]"
            style={{ '--keyboard-inset': `${keyboard}px` } as React.CSSProperties}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('open')}
          >
            <div className="border-border-base flex shrink-0 items-center gap-2 border-b px-3">
              <Search className="text-text-subtle size-4 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                placeholder={t('placeholder')}
                aria-label={t('placeholder')}
                className="placeholder:text-text-subtle h-12 flex-1 bg-transparent text-base outline-none"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActive((prev) => Math.min(items.length - 1, prev + 1))
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive((prev) => Math.max(0, prev - 1))
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const command = items[active]
                    if (command) run(command)
                  }
                }}
              />
            </div>

            <ul
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
              aria-busy={searching}
            >
              {items.map((command, index) => {
                const Icon = command.icon
                // One heading, above the first row that came out of the database.
                const opensGroup = command.type === 'hit' && items[index - 1]?.type !== 'hit'

                return (
                  <li key={command.id}>
                    {opensGroup ? (
                      <p className="text-text-subtle px-4 pt-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
                        {t('inYourData')}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      ref={index === active ? activeRef : null}
                      disabled={pending}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => run(command)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm',
                        index === active ? 'bg-accent-soft text-text' : 'text-text-muted',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-4 shrink-0',
                          index === active ? 'text-accent' : 'text-text-subtle',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{command.label}</span>
                        {command.type === 'hit' && command.detail ? (
                          <span className="text-text-subtle mt-0.5 block truncate text-xs">
                            {command.detail}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-text-subtle flex shrink-0 items-center gap-2 text-xs">
                        {command.kind}
                        {index === active ? <CornerDownLeft className="size-3" /> : null}
                      </span>
                    </button>
                  </li>
                )
              })}

              {/* A search that is still running says so, rather than looking empty. */}
              {searching ? (
                <li className="text-text-subtle flex items-center gap-2 px-4 py-2.5 text-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  {t('searching')}
                </li>
              ) : null}

              {!searching && eligible && hits.length === 0 ? (
                <li className="text-text-subtle px-4 py-2.5 text-sm">
                  {t('nothingInData', { query: query.trim() })}
                </li>
              ) : !searching && items.length === 0 ? (
                <li className="text-text-subtle px-4 py-3 text-sm">{t('noResults')}</li>
              ) : null}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
