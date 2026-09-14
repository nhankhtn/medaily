'use client'

import { CornerDownLeft, Loader2, MessageSquarePlus, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  CAPTURE_MODULES,
  matchModules,
  slashQuery,
  type CaptureModule,
  type CaptureModuleKey,
} from '@/lib/capture/modules'
import { cn } from '@/lib/utils'
import { FinanceDraftList } from '@/features/finance/draft-list'
import { parseTransactionText, type ParseTransactionsResult } from '@/server/actions/finance'

type Parsed = { module: 'finance'; result: Extract<ParseTransactionsResult, { ok: true }> }

/**
 * A launcher in the bottom-right corner that opens a panel for logging
 * anything, from any page.
 *
 * `/` lists the places a note can go and the pick decides which parser runs —
 * an explicit choice rather than a guess, so a note that reads like two things
 * cannot land in the wrong one. Only finance is wired up so far; the menu is a
 * registry, so the next one is one entry.
 */
export function CaptureBox({ enabled }: { enabled: boolean }) {
  const t = useTranslations('capture')
  const tn = useTranslations('nav')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setOpen((previous) => !previous)
        return
      }
      // Escape closes from anywhere in the panel, including a focused field.
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      className={cn(
        'fixed right-4 z-40 md:right-6',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6',
      )}
    >
      {open ? (
        <section
          aria-label={t('title')}
          className="border-border-strong bg-surface flex max-h-[min(34rem,calc(100dvh-10rem))] w-[min(26rem,calc(100vw-2rem))] flex-col rounded-2xl border shadow-2xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-3 pb-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{t('title')}</h2>
              <p className="text-text-subtle mt-0.5 text-xs leading-snug">{t('description')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tc('close')}
              title={t('closeHint')}
              className="text-text-subtle hover:bg-surface-2 hover:text-text flex size-8 shrink-0 items-center justify-center rounded-full"
            >
              <X className="size-4" />
            </button>
          </header>

          {/* Mounted only while open, so a dismissed panel never reopens
              holding a half-typed note and its stale drafts. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <CaptureForm labelOf={(module) => tn(module.labelKey)} />
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('open')}
          title={t('openHint')}
          className="bg-accent text-accent-text hover:bg-accent-hover flex size-13 items-center justify-center rounded-full shadow-lg transition-colors"
        >
          <MessageSquarePlus className="size-6" />
        </button>
      )}
    </div>
  )
}

function CaptureForm({ labelOf }: { labelOf: (module: CaptureModule) => string }) {
  const t = useTranslations('capture')
  const tf = useTranslations('finance.capture')
  const [module, setModule] = useState<CaptureModuleKey | null>(null)
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [active, setActive] = useState(0)
  const [parsing, startParsing] = useTransition()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const query = module === null ? slashQuery(text) : null
  const matches = useMemo(
    () => (query === null ? [] : matchModules(query, labelOf)),
    [query, labelOf],
  )
  const menuOpen = matches.length > 0
  // Clamped at render rather than reset in an effect: the list can shrink
  // between keystrokes and a stale index would highlight nothing.
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1))

  const retype = (value: string) => {
    setText(value)
    setActive(0)
  }

  const pick = (key: CaptureModuleKey) => {
    setModule(key)
    retype('')
    inputRef.current?.focus()
  }

  const parse = () =>
    startParsing(async () => {
      if (module !== 'finance') return
      const result = await parseTransactionText({ text })
      if (!result.ok) {
        toast.error(tf(result.error === 'rate_limited' ? 'rateLimited' : 'failed'))
        return
      }
      if (result.drafts.length === 0) {
        toast.info(tf('nothingFound'))
        return
      }
      setParsed({ module: 'finance', result })
    })

  const ready = module !== null && text.trim().length >= 3

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setActive(
          (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length,
        )
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const chosen = matches[activeIndex]
        if (chosen) pick(chosen.key)
        return
      }
    }

    // Enter alone is a newline: these notes run to several lines.
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      if (ready) parse()
    }
  }

  const chosen = CAPTURE_MODULES.find((candidate) => candidate.key === module)

  return (
    <div className="space-y-3">
      <div className="relative">
        {chosen ? (
          <div className="mb-2 flex items-center gap-2">
            <Badge tone="accent">
              <chosen.icon className="size-3" />
              {labelOf(chosen)}
            </Badge>
            <button
              type="button"
              onClick={() => {
                setModule(null)
                setParsed(null)
              }}
              className="text-text-subtle hover:text-text inline-flex items-center gap-1 text-xs"
            >
              <X className="size-3" />
              {t('changeTarget')}
            </button>
          </div>
        ) : null}

        <Textarea
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(event) => retype(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={chosen ? t(`examples.${chosen.key}`) : t('placeholder')}
          maxLength={2000}
          rows={3}
          disabled={parsing}
          className="text-sm"
        />

        {menuOpen ? (
          <ul
            role="listbox"
            aria-label={t('destinations')}
            className="border-border-strong bg-surface absolute z-10 mt-1 w-full overflow-hidden rounded-[var(--radius)] border shadow-[var(--shadow-card)]"
          >
            {matches.map((candidate, index) => (
              <li key={candidate.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(candidate.key)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    index === activeIndex ? 'bg-accent-soft text-accent' : 'text-text',
                  )}
                >
                  <candidate.icon className="size-4 shrink-0" />
                  <span className="flex-1">{labelOf(candidate)}</span>
                  <span className="text-text-subtle text-xs">/{candidate.key}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={parse} disabled={parsing || !ready}>
          {parsing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {parsing ? tf('parsing') : tf('parse')}
        </Button>
        <span className="text-text-subtle inline-flex items-center gap-1 text-xs">
          <CornerDownLeft className="size-3" />
          {module === null ? t('pickFirst') : t('submitHint')}
        </span>
      </div>

      {parsed ? (
        <FinanceDraftList
          drafts={parsed.result.drafts}
          accounts={parsed.result.context.accounts}
          categories={parsed.result.context.categories}
          currency={parsed.result.context.currency}
          onDiscard={() => setParsed(null)}
          onSaved={() => {
            setParsed(null)
            setText('')
          }}
        />
      ) : (
        <p className="text-text-subtle text-xs leading-snug">{tf('privacy')}</p>
      )}
    </div>
  )
}
