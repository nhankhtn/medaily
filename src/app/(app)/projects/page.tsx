import { ArrowRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { Progress } from '@/components/ui/progress'
import { ProjectDialog } from '@/features/projects/project-dialog'
import { getProjectsView } from '@/server/services/projects'

const STATUS_TONE = {
  planned: 'neutral',
  active: 'accent',
  on_hold: 'warn',
  done: 'good',
  dropped: 'neutral',
} as const

export default async function ProjectsPage() {
  const [t, data] = await Promise.all([getTranslations('projects'), getProjectsView()])

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={<ProjectDialog goals={data.goals} />}
      />

      {data.projects.length === 0 ? (
        <EmptyState
          title={t('noneYet')}
          body={t('noneYetBody')}
          action={<ProjectDialog goals={data.goals} />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.projects.map((project) => {
            const progress =
              project.taskCount > 0 ? (project.doneTaskCount / project.taskCount) * 100 : null

            return (
              <li
                key={project.id}
                className="rounded-[var(--radius)] border border-border-base bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/projects/${project.id}`}
                    className="min-w-0 flex-1 truncate font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                  <Badge tone={STATUS_TONE[project.status]}>{t(`statuses.${project.status}`)}</Badge>
                </div>

                {project.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-text-subtle">{project.description}</p>
                ) : null}

                {progress !== null ? (
                  <Progress className="mt-3" value={progress} label={project.name} />
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-subtle">
                  {project.taskCount > 0 ? (
                    <span className="tabular-nums">
                      {t('doneTasks', { done: project.doneTaskCount, total: project.taskCount })}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock className="size-3.5" />
                    {Math.round(project.minutesSpent / 60)}h
                  </span>
                  <Button asChild variant="ghost" size="sm" className="ml-auto h-7 px-2">
                    <Link href={`/projects/${project.id}`}>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
