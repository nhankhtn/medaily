'use client'

import { CornerDownLeft, Loader2, MessageSquarePlus, Pencil, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  assistantModule,
  FILING_MODULES,
  type FilingTarget,
  matchModules,
  slashQuery,
  type CaptureModule,
  type CaptureModuleKey,
} from '@/lib/capture/modules'
import { cn } from '@/lib/utils'
import { AssistantChat } from '@/features/capture/assistant-chat'
import { ReviewChat } from '@/features/capture/review-chat'
import { FinanceDraftList } from '@/features/finance/draft-list'
import { PlanReview } from '@/features/capture/plan-review'
import { useShortcut } from '@/features/shortcuts/provider'
import { parseTransactionText, type ParseTransactionsResult } from '@/server/actions/finance'
import { parsePlanText } from '@/server/actions/plan-capture'
import type { PlanItem } from '@/lib/capture/plan-items'
import type { ISODate } from '@/lib/dates'
import type { BindableMetric } from '@/lib/metrics/bindable'

type Parsed = { module: 'finance'; result: Extract<ParseTransactionsResult, { ok: true }> }

/**
 * A launcher in the bottom-right corner that opens a panel for logging
 * anything, from any page.
 *
 * `/` lists the places a note can go and the pick decides what happens to it —
 * an explicit choice rather than a guess, so a note that reads like two things
 * cannot land in the wrong one. The menu is a registry, so the next
 * destination is one entry plus a branch below.
 */
export function CaptureBox({
  enabled,
  assistant,
}: {
  enabled: boolean
  /** The agent service is deployed. Its destination is hidden without it. */
  assistant: boolean
}) {
  const t = useTranslations('capture')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)

  useShortcut('capture', () => setOpen((previous) => !previous), enabled)

  // Escape closes from anywhere in the panel, including a focused field, and
  // is not the registry's to hand out.
  useEffect(() => {
    if (!enabled || !open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, open])

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
          className="glass-strong flex max-h-[min(42rem,calc(100dvh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col rounded-2xl shadow-2xl"
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
            <CaptureForm labelOf={(module) => t(`modules.${module.key}`)} assistant={assistant} />
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

function CaptureForm({
  labelOf,
  assistant,
}: {
  labelOf: (module: CaptureModule) => string
  assistant: boolean
}) {
  const t = useTranslations('capture')

  /*
   * The assistant is home, not an entry in a list. The box opens on it, `/`
   * in its input leaves for the menu, and leaving a filing destination comes
   * back here — so there is always one way out and one way back.
   *
   * Without it configured there is no home to return to, and `null` means the
   * menu, which is how the box worked before the assistant existed.
   */
  const home = assistantModule(assistant)
  const [module, setModule] = useState<CaptureModuleKey | null>(home?.key ?? null)

  /*
   * A note the assistant recognised, on its way to the form that writes it
   * down. It carries the text, so the form arrives with the note already in
   * it and already being read — the tap that would have chosen the
   * destination is the tap that is no longer needed.
   *
   * Cleared whenever a destination is chosen by hand, or the same note would
   * be read again the next time that form is opened.
   */
  const [handoff, setHandoff] = useState<{ target: FilingTarget; text: string } | null>(null)

  const go = (key: CaptureModuleKey | null) => {
    setHandoff(null)
    setModule(key)
  }

  const chosen = [...FILING_MODULES, ...(home ? [home] : [])].find(
    (candidate) => candidate.key === module,
  )

  const atHome = chosen?.key === 'assistant'

  return (
    <div className="space-y-3">
      {chosen ? (
        <div className="flex items-center gap-2">
          <Badge tone="accent">
            <chosen.icon className="size-3" />
            {labelOf(chosen)}
          </Badge>
          {/* Home has no "change": `/` in its own input is how you leave it. */}
          {atHome ? null : (
            <button
              type="button"
              onClick={() => go(home?.key ?? null)}
              className="text-text-subtle hover:text-text inline-flex items-center gap-1 text-xs"
            >
              <X className="size-3" />
              {t(home ? 'backToAssistant' : 'changeTarget')}
            </button>
          )}
        </div>
      ) : null}

      {/*
        Home is hidden while the menu is open, not unmounted. Typing the slash
        and deleting it again is one keystroke each way, and a remount would
        refetch the thread and blink the conversation away every time — seven
        calls to the service for three changes of mind, measured.
      */}
      {home ? (
        <div hidden={!atHome}>
          <AssistantChat
            onLeave={() => setModule(null)}
            onFile={(target, text) => {
              setHandoff({ target, text })
              setModule(target)
            }}
          />
        </div>
      ) : null}

      {chosen ? null : (
        <ModulePicker
          labelOf={labelOf}
          modules={FILING_MODULES}
          onPick={go}
          onCancel={home ? () => go(home.key) : undefined}
          /* With a home, the only way here is the slash typed to leave it — so
             the menu arrives already open rather than asking for it twice. */
          initialText={home ? '/' : ''}
        />
      )}

      {/* Each destination owns its own input: a note dumped into finance runs
          to several lines, a question about a week is one. */}
      {chosen && !atHome ? (
        chosen.key === 'finance' ? (
          <FinancePanel handoff={handoff?.target === 'finance' ? handoff.text : undefined} />
        ) : chosen.key === 'plan' ? (
          <PlanPanel handoff={handoff?.target === 'plan' ? handoff.text : undefined} />
        ) : (
          <ReviewChat />
        )
      ) : null}
    </div>
  )
}

function ModulePicker({
  labelOf,
  modules,
  onPick,
  onCancel,
  initialText = '',
}: {
  labelOf: (module: CaptureModule) => string
  modules: CaptureModule[]
  onPick: (key: CaptureModuleKey) => void
  /**
   * Where deleting the slash goes. Only passed when there is somewhere to go:
   * with a home, this field exists to hold a slash and nothing else, so a
   * field without one is a dead end rather than a state worth being in.
   */
  onCancel?: () => void
  /** What the field starts with, so a slash already typed is not typed twice. */
  initialText?: string
}) {
  const t = useTranslations('capture')
  const [text, setText] = useState(initialText)
  const [active, setActive] = useState(0)
  const field = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const input = field.current
    if (!input) return
    // `autoFocus` leaves the caret in front of the text it was handed. There
    // Backspace deletes nothing and the next keystroke lands before the slash,
    // which turns the field into something that looks typed-in but is inert.
    input.setSelectionRange(input.value.length, input.value.length)
  }, [])

  const query = slashQuery(text)
  const matches = useMemo(
    () => (query === null ? [] : matchModules(query, labelOf, modules)),
    [query, labelOf, modules],
  )
  const menuOpen = matches.length > 0
  // Clamped at render rather than reset in an effect: the list can shrink
  // between keystrokes and a stale index would highlight nothing.
  const activeIndex = Math.min(active, Math.max(0, matches.length - 1))

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen) return
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
      if (chosen) onPick(chosen.key)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Textarea
          ref={field}
          autoFocus
          value={text}
          onChange={(event) => {
            const next = event.target.value
            // Delete the slash and you have undone the thing that brought you
            // here, so it takes you back rather than leaving you nowhere.
            if (onCancel && !next.startsWith('/')) {
              onCancel()
              return
            }
            setText(next)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={t('placeholder')}
          maxLength={200}
          rows={2}
        />

        {menuOpen ? (
          /*
           * In the flow rather than absolutely positioned: the panel is only
           * as tall as its content, so a floating menu hung off the bottom of
           * a short box, outside its own border and past the screen edge.
           * Inline, the panel grows upward to hold it.
           */
          <ul
            role="listbox"
            aria-label={t('destinations')}
            className="glass mt-1 overflow-hidden rounded-[var(--radius)]"
          >
            {matches.map((candidate, index) => (
              <li key={candidate.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onPick(candidate.key)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    index === activeIndex ? 'bg-accent-soft text-accent' : 'text-text',
                  )}
                >
                  <candidate.icon className="size-4 shrink-0" />
                  <span className="flex-1">{labelOf(candidate)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-text-subtle text-xs">{t('pickFirst')}</p>
    </div>
  )
}

function PlanPanel({ handoff }: { handoff?: string }) {
  const t = useTranslations('capture')
  const tp = useTranslations('capture.plan')
  const [text, setText] = useState(handoff ?? '')
  const [read, setRead] = useState<{
    items: PlanItem[]
    today: ISODate
    metrics: BindableMetric[]
  } | null>(null)
  const [reading, startReading] = useTransition()

  const ready = text.trim().length >= 3

  const parse = (source: string = text) =>
    startReading(async () => {
      const result = await parsePlanText({ text: source })
      if (!result.ok) {
        toast.error(tp(result.error === 'rate_limited' ? 'rateLimited' : 'failed'))
        return
      }
      if (result.items.length === 0) {
        toast.info(tp('nothingFound'))
        return
      }
      setRead({ items: result.items, today: result.today, metrics: result.metrics })
    })

  useHandoff(handoff, setText, parse)

  if (read) {
    return (
      <PlanReview
        items={read.items}
        today={read.today}
        metrics={read.metrics}
        onDiscard={() => setRead(null)}
        onSaved={() => {
          setRead(null)
          setText('')
        }}
      />
    )
  }

  return (
    <div className="space-y-3">
      <Textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        // Enter is a newline here: a plan is usually a list, not a sentence.
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            if (ready) parse()
          }
        }}
        placeholder={t('examples.plan')}
        maxLength={2000}
        rows={4}
        disabled={reading}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => parse()} disabled={reading || !ready}>
          {reading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {reading ? tp('reading') : tp('read')}
        </Button>
        <span className="text-text-subtle inline-flex items-center gap-1 text-xs">
          <CornerDownLeft className="size-3" />
          {t('submitHint')}
        </span>
      </div>
    </div>
  )
}

/**
 * A note the assistant already recognised, read the moment the form opens.
 *
 * It was written once and routed once; asking for the button as well would be
 * the same decision made twice. Runs at most once per handoff — `parse` is
 * deliberately not a dependency, because it is rebuilt on every keystroke and
 * a note must not be re-read as the rows below it are being corrected.
 */
function useHandoff(
  handoff: string | undefined,
  setText: (text: string) => void,
  parse: (source: string) => void,
) {
  /* The note already read, rather than a flag: a handoff can arrive a render
     after the form mounts, and this must survive that without reading twice. */
  const read = useRef<string | null>(null)

  useEffect(() => {
    if (!handoff || read.current === handoff) return
    read.current = handoff
    setText(handoff)
    parse(handoff)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff])
}

function FinancePanel({ handoff }: { handoff?: string }) {
  const t = useTranslations('capture')
  const tf = useTranslations('finance.capture')
  const [text, setText] = useState(handoff ?? '')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [parsing, startParsing] = useTransition()

  const parse = (source: string = text) =>
    startParsing(async () => {
      const result = await parseTransactionText({ text: source })
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

  useHandoff(handoff, setText, parse)

  const ready = text.trim().length >= 3

  /*
   * Once the rows are here the note has done its job. It folds away to one
   * line, because the panel is small — on a phone the box you already typed
   * into pushed the rows, and the save button under them, off the bottom, and
   * a review step you have to scroll to find is one you will not do.
   */
  if (parsed) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <p className="text-text-subtle min-w-0 flex-1 truncate text-xs">{text}</p>
          <button
            type="button"
            onClick={() => setParsed(null)}
            className="text-text-subtle hover:text-text inline-flex shrink-0 items-center gap-1 text-xs"
          >
            <Pencil className="size-3" />
            {tf('rewrite')}
          </button>
        </div>

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
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Textarea
        autoFocus
        value={text}
        onChange={(event) => setText(event.target.value)}
        // Enter is a newline here: a day's spending runs to several lines.
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            if (ready) parse()
          }
        }}
        placeholder={t('examples.finance')}
        maxLength={2000}
        rows={3}
        disabled={parsing}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => parse()} disabled={parsing || !ready}>
          {parsing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {parsing ? tf('parsing') : tf('parse')}
        </Button>
        <span className="text-text-subtle inline-flex items-center gap-1 text-xs">
          <CornerDownLeft className="size-3" />
          {t('submitHint')}
        </span>
      </div>
    </div>
  )
}
