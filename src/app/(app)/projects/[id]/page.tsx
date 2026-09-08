import { ArrowLeft, Clock } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ProjectDialog } from '@/features/projects/project-dialog'
import { TaskList } from '@/features/projects/task-list'
import { getProjectDetail, getProjectsView } from '@/server/services/projects'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [t, tc, detail, list] = await Promise.all([
    getTranslations('projects'),
    getTranslations('common'),
    getProjectDetail(id),
    getProjectsView(),
  ])

  if (!detail) notFound()
  const { project, tasks } = detail

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button asChild variant="ghost" size="iconSm">
            <Link href="/projects" aria-label={t('title')}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-subtle">
              <Badge tone="accent">{t(`statuses.${project.status}`)}</Badge>
              <Badge>{t(`priorities.${project.priority}`)}</Badge>
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="size-3.5" />
                {t('timeSpent')}: {Math.floor(project.minutesSpent / 60)}h{' '}
                {project.minutesSpent % 60}m
              </span>
            </div>
          </div>
        </div>

        <ProjectDialog
          project={project}
          goals={list.goals}
          trigger={
            <Button variant="outline" size="sm">
              {tc('edit')}
            </Button>
          }
        />
      </div>

      {project.description ? (
        <p className="max-w-prose text-sm leading-relaxed text-text-muted">{project.description}</p>
      ) : null}

      <Card>
        <CardHeader title={t('tasks')} />
        <CardBody>
          <TaskList projectId={project.id} tasks={tasks} />
        </CardBody>
      </Card>
    </div>
  )
}
