'use client'

import { Loader2, Play } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { TimerBadge } from '@/features/timer/timer-badge'
import { startTimer } from '@/server/actions/timer'
import type { RunningTimer } from '@/server/services/timer'
import { PATHS } from '@/lib/paths'

/**
 * Spec 10.3 — the timer is server-side state, so this only starts a run and
 * hands the display to the shared badge. Pausing, countdowns and workouts live
 * on the timer page.
 */
export function TimerWidget({
  timer,
  topics,
  projects,
}: {
  timer: RunningTimer | null
  topics: { id: string; name: string }[]
  projects: { id: string; name: string }[]
}) {
  const t = useTranslations('learning')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [kind, setKind] = useState<'learning' | 'deep_work' | 'project'>('learning')
  const [topicId, setTopicId] = useState('')
  const [projectId, setProjectId] = useState('')

  if (timer) return <TimerBadge timer={timer} />

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
              target: 'focus',
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

      <Button asChild variant="ghost">
        <Link href={PATHS.timer}>{t('openTimer')}</Link>
      </Button>
    </div>
  )
}
