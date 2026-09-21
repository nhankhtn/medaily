'use client'

import { Loader2, Pause, Play, Square, Timer } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { formatDuration } from '@/lib/timer'
import { cn } from '@/lib/utils'
import type { RunningTimer } from '@/server/services/timer'
import { dropRun, finishRun, togglePauseRun } from './run-actions'
import { useEffectiveTimer } from './use-effective-timer'
import { useElapsedSeconds } from './use-run'
import { PATHS } from '@/lib/paths'

/**
 * The run, wherever the user is in the app. Prefers the device mirror so a
 * pause taken offline still shows here; /timer is where a run is configured.
 */
export function TimerBadge({ timer: serverTimer }: { timer: RunningTimer | null }) {
  const t = useTranslations('timer')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const timer = useEffectiveTimer(serverTimer)
  const elapsed = useElapsedSeconds(timer)

  if (!timer) {
    return (
      <Link
        href={PATHS.timer}
        aria-label={t('title')}
        className="text-text-muted hover:bg-surface-2 hover:text-text flex size-9 items-center justify-center rounded-full"
      >
        <Timer className="size-4" />
      </Link>
    )
  }

  const running = timer.pausedAt === null
  const countdown = timer.mode === 'countdown' && timer.targetSeconds !== null
  const shown = countdown ? (timer.targetSeconds ?? 0) - elapsed : elapsed

  return (
    <div
      className={cn(
        'flex h-9 items-center gap-1 rounded-full border px-1.5',
        running ? 'border-accent bg-accent-soft' : 'glass',
      )}
    >
      <Link
        href={PATHS.timer}
        className="flex items-center gap-1.5 px-1"
        aria-label={t(running ? 'running' : 'paused')}
      >
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            running ? 'bg-accent animate-pulse' : 'bg-text-subtle',
          )}
        />
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            running ? 'text-accent' : 'text-text-muted',
          )}
        >
          {formatDuration(shown)}
        </span>
      </Link>

      <button
        type="button"
        onClick={() => startTransition(async () => void (await togglePauseRun()))}
        disabled={pending}
        aria-label={t(running ? 'pause' : 'resume')}
        className="text-text-muted hover:text-text flex size-6 items-center justify-center rounded-full"
      >
        {running ? <Pause className="size-3" /> : <Play className="size-3" />}
      </button>

      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const result = await finishRun({})
            if (!result.ok) {
              toast[result.error === 'too_short' ? 'info' : 'error'](
                result.error === 'too_short' ? t('tooShort') : tc('error'),
              )
              return
            }
            toast.success(
              result.queued
                ? t('offline.queued', { minutes: result.minutes })
                : t('savedShort', { minutes: result.minutes }),
            )
          })
        }
        disabled={pending}
        aria-label={t('stop')}
        className="bg-accent text-accent-text flex size-6 items-center justify-center rounded-full"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />}
      </button>
    </div>
  )
}
