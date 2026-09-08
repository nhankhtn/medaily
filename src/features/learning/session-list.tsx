'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FocusSession } from '@/lib/db/schema'
import { fromISODate, type ISODate } from '@/lib/dates'
import { removeSession, saveSession } from '@/server/actions/learning'

export function SessionList({
  sessions,
  topics,
  projects,
  today,
}: {
  sessions: FocusSession[]
  topics: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  today: ISODate
}) {
  const t = useTranslations('learning')
  const tc = useTranslations('common')
  const format = useFormatter()
  const [pending, startTransition] = useTransition()
  const [minutes, setMinutes] = useState('')
  const [kind, setKind] = useState<'learning' | 'deep_work' | 'project'>('learning')
  const [topicId, setTopicId] = useState('')
  const [date, setDate] = useState<string>(today)

  const topicName = (id: string | null) => topics.find((topic) => topic.id === id)?.name ?? null
  const projectName = (id: string | null) =>
    projects.find((project) => project.id === id)?.name ?? null

  const add = () => {
    const value = Number(minutes)
    if (!Number.isFinite(value) || value <= 0) return

    startTransition(async () => {
      const result = await saveSession({
        date,
        minutes: Math.round(value),
        kind,
        topicId: topicId || null,
      })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      setMinutes('')
      toast.success(t('sessionSaved'))
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-24 space-y-1.5">
          <span className="text-xs font-medium text-text-muted">{t('minutes')}</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && add()}
            className="text-center tabular-nums"
          />
        </label>

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

        <label className="w-40 space-y-1.5">
          <span className="text-xs font-medium text-text-muted">{t('date')}</span>
          <Input
            type="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <Button onClick={add} disabled={pending || minutes === ''}>
          <Plus className="size-4" />
          {t('addSession')}
        </Button>
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-text-subtle">{t('noSessions')}</p>
      ) : (
        <ul className="divide-y divide-border-base">
          {sessions.map((session) => (
            <li key={session.id} className="group flex items-center gap-3 py-2">
              <span className="w-14 shrink-0 text-sm font-medium tabular-nums">
                {session.minutes}m
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={session.kind === 'learning' ? 'accent' : 'neutral'}>
                    {t(`kinds.${session.kind}`)}
                  </Badge>
                  {topicName(session.topicId) ? (
                    <span className="truncate text-sm">{topicName(session.topicId)}</span>
                  ) : null}
                  {projectName(session.projectId) ? (
                    <span className="truncate text-sm text-text-muted">
                      · {projectName(session.projectId)}
                    </span>
                  ) : null}
                </div>
                {session.note ? (
                  <p className="truncate text-xs text-text-subtle">{session.note}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                {format.dateTime(fromISODate(session.sessionDate), {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <button
                type="button"
                disabled={pending}
                aria-label={`${tc('delete')} ${session.minutes}m`}
                onClick={() => startTransition(async () => void (await removeSession(session.id)))}
                className="shrink-0 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
