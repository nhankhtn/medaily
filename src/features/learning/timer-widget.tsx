'use client'

import { Loader2, Play, Square } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { startTimer, stopTimer } from '@/server/actions/learning'
import type { RunningTimer } from '@/server/services/learning'
import { cn } from '@/lib/utils'

/**
 * Spec 10.3 — the timer is server-side state, so this only renders it and ticks
 * the display. A refresh, another tab or another device all show the same run.
 */
export function TimerWidget({
  timer,
  topics,
  projects,
  compact = false,
}: {
  timer: RunningTimer | null
  topics: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  compact?: boolean
}) {
  const t = useTranslations('learning')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<'learning' | 'deep_work' | 'project'>('learning')
  const [topicId, setTopicId] = useState('')
  const [projectId, setProjectId] = useState('')
  // `key` on the running badge remounts this when the run changes, so the
  // server value is genuinely the initial state and the interval only ticks.
  const [elapsed, setElapsed] = useState(timer?.elapsedMinutes ?? 0)

  useEffect(() => {
    if (!timer) return
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 60_000)))
    }, 15_000)
    return () => clearInterval(id)
  }, [timer])

  const stop = () =>
    startTransition(async () => {
      const result = await stopTimer()
      if (!result.ok) return
      toast.success(t('totalMinutes', { minutes: result.minutes }))
      if (result.capped) toast.warning(t('timerCapped'), { duration: 8000 })
    })

  if (timer) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-accent bg-accent-soft px-2.5 py-1',
          compact && 'h-9',
        )}
      >
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent" />
        <span className="text-xs font-medium tabular-nums text-accent">
          {t('running', { minutes: elapsed })}
        </span>
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          aria-label={t('stop')}
          className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-text"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Square className="size-3" />}
        </button>
      </div>
    )
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="iconSm"
        aria-label={t('start')}
        disabled={pending}
        onClick={() => startTransition(async () => void (await startTimer({ kind: 'learning' })))}
      >
        <Play className="size-4" />
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-32 flex-1 space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{t('kind')}</span>
        <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          {(['learning', 'deep_work', 'project'] as const).map((option) => (
            <option key={option} value={option}>
              {t(`kinds.${option}`)}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-32 flex-1 space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{t('topic')}</span>
        <Select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
          <option value="">{t('noTopic')}</option>
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-32 flex-1 space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{t('project')}</span>
        <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
          <option value="">{t('noProject')}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </label>

      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await startTimer({
              kind,
              topicId: topicId || null,
              projectId: projectId || null,
            })
            if (!result.ok) toast.error(tc('error'))
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
        {t('start')}
      </Button>
    </div>
  )
}
