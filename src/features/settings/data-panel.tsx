'use client'

import { Download, Loader2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { importData } from '@/server/actions/data'
import type { ImportSummary } from '@/server/services/export'

export function DataPanel() {
  const t = useTranslations('data')
  const tc = useTranslations('common')
  const inputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (dryRun: boolean) => {
    const file = inputRef.current?.files?.[0]
    if (!file) {
      toast.info(t('noFile'))
      return
    }

    startTransition(async () => {
      const json = await file.text()
      const result = await importData({ json, dryRun })
      setSummary(result)

      if (!result.ok) {
        toast.error(result.errors[0] ?? tc('error'))
        return
      }
      if (!dryRun) toast.success(t('added', { count: total(result.inserted) }))
    })
  }

  return (
    <section className="space-y-3 rounded-[var(--radius)] border border-border-base bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        <p className="mt-0.5 text-xs leading-snug text-text-subtle">{t('body')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href="/api/export?format=json" download>
            <Download className="size-4" />
            {t('exportJson')}
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="/api/export?format=csv&table=daily_logs" download>
            <Download className="size-4" />
            {t('exportCsv')}
          </a>
        </Button>
      </div>

      <div className="space-y-2 border-t border-border-base pt-3">
        <p className="text-xs text-text-subtle">{t('importHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            aria-label={t('import')}
            onChange={() => setSummary(null)}
            className="max-w-full text-xs file:mr-2 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs"
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(true)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t('dryRun')}
          </Button>
          <Button
            size="sm"
            disabled={pending || !summary?.ok || !summary.dryRun}
            onClick={() => run(false)}
          >
            {t('apply')}
          </Button>
        </div>

        {summary ? (
          <div className="rounded-[var(--radius)] bg-surface-2 p-3 text-xs">
            {summary.ok ? (
              <p>
                {summary.dryRun
                  ? t('wouldAdd', {
                      count: total(summary.inserted),
                      tables: Object.keys(summary.inserted).length,
                    })
                  : t('added', { count: total(summary.inserted) })}
                {total(summary.skipped) > 0
                  ? ` · ${t('skipped', { count: total(summary.skipped) })}`
                  : ''}
              </p>
            ) : null}

            {summary.errors.length > 0 ? (
              <div className="mt-1.5">
                <p className="font-medium text-bad">{t('importErrors')}</p>
                <ul className="mt-0.5 space-y-0.5 text-text-muted">
                  {summary.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-text-subtle">{t('backupNote')}</p>
      </div>
    </section>
  )
}

const total = (counts: Record<string, number>) =>
  Object.values(counts).reduce((sum, value) => sum + value, 0)
