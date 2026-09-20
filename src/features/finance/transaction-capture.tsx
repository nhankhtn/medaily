'use client'

import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { FinanceDraftList } from '@/features/finance/draft-list'
import { parseTransactionText, type ParseTransactionsResult } from '@/server/actions/finance'

type Parsed = Extract<ParseTransactionsResult, { ok: true }>

/**
 * Type the day out in one breath — "sáng ăn phở 40k, cà phê 25k, đổ xăng 100
 * nghìn" — and get one editable row per payment.
 *
 * The rows are a *proposal*. Nothing is written until the user presses save,
 * every field stays editable, and a row can be dropped, so a misread number is
 * a visible correction rather than an entry to hunt down later.
 */
export function TransactionCapture({ enabled }: { enabled: boolean }) {
  const t = useTranslations('finance.capture')
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [parsing, startParsing] = useTransition()

  if (!enabled) return null

  const parse = () =>
    startParsing(async () => {
      const result = await parseTransactionText({ text })
      if (!result.ok) {
        toast.error(t(result.error === 'rate_limited' ? 'rateLimited' : 'failed'))
        return
      }
      if (result.drafts.length === 0) {
        toast.info(t('nothingFound'))
        return
      }
      setParsed(result)
    })

  return (
    <div className="border-border-base space-y-3 rounded-[var(--radius)] border border-dashed p-3">
      <div className="flex items-center gap-2">
        <Wand2 className="text-accent size-4 shrink-0" />
        <h3 className="text-sm font-medium">{t('title')}</h3>
      </div>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        // Enter is a newline here — the note is often several lines long.
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            if (text.trim().length >= 3) parse()
          }
        }}
        placeholder={t('placeholder')}
        maxLength={2000}
        rows={3}
        disabled={parsing}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={parse}
          disabled={parsing || text.trim().length < 3}
        >
          {parsing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {parsing ? t('parsing') : t('parse')}
        </Button>
      </div>

      {parsed ? (
        <FinanceDraftList
          drafts={parsed.drafts}
          accounts={parsed.context.accounts}
          categories={parsed.context.categories}
          currency={parsed.context.currency}
          onDiscard={() => setParsed(null)}
          onSaved={() => {
            setParsed(null)
            setText('')
          }}
        />
      ) : null}
    </div>
  )
}
