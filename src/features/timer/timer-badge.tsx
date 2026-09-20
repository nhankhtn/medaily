'use client'

import { Loader2, Pause, Play, Square, Timer } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { formatDuration } from '@/lib/timer'
import { cn } from '@/lib/utils'
import { pauseTimer, resumeTimer, stopTimer } from '@/server/actions/timer'
import type { RunningTimer } from '@/server/services/timer'
import { useElapsedSeconds } from './use-run'
import { PATHS } from '@/lib/paths'

/**
 * The run, wherever the user is in the app. It only mirrors server state — the
 * page at /timer is where a run is configured.
 */
export function TimerBadge({ timer }: { timer: RunningTimer | null }) {
  const t = useTranslations('timer')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const elapsed = useElapsedSeconds(timer)

  if (!timer) {
    return (
      <Link
        href={PATHS.timer}
        aria-label={t('title')}
        className="flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
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
            running ? 'animate-pulse bg-accent' : 'bg-text-subtle',
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
        onClick={() => startTransition(async () => void (await (running ? pauseTimer() : resumeTimer())))}
        disabled={pending}
        aria-label={t(running ? 'pause' : 'resume')}
        className="flex size-6 items-center justify-center rounded-full text-text-muted hover:text-text"
      >
        {running ? <Pause className="size-3" /> : <Play className="size-3" />}
      </button>

      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            const result = await stopTimer({})
            if (!result.ok) {
              toast[result.error === 'too_short' ? 'info' : 'error'](
                result.error === 'too_short' ? t('tooShort') : tc('error'),
              )
              return
            }
            toast.success(t('savedShort', { minutes: result.minutes }))
          })
        }
        disabled={pending}
        aria-label={t('stop')}
        className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-text"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />}
      </button>
    </div>
  )
}
