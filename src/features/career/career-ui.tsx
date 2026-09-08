'use client'

import { ExternalLink, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import type { Achievement, PortfolioItem, Skill } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { saveAchievement, savePortfolioItem, saveSkill } from '@/server/actions/career'
import { cn } from '@/lib/utils'

const LEVELS = [1, 2, 3, 4, 5] as const

export function SkillList({ skills }: { skills: Skill[] }) {
  const t = useTranslations('career')

  if (skills.length === 0) return <p className="text-sm text-text-subtle">{t('noSkills')}</p>

  return (
    <ul className="space-y-2.5">
      {skills.map((skill) => (
        <li key={skill.id} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{skill.name}</span>
            <span className="shrink-0 text-xs text-text-subtle">
              {t('levelOf', { level: skill.level })}
              {skill.targetLevel && skill.targetLevel > skill.level
                ? ` · ${t('gap', { gap: skill.targetLevel - skill.level })}`
                : ''}
            </span>
          </div>
          {/* Current level as filled pips, the target as an outlined one. */}
          <div className="flex gap-1">
            {LEVELS.map((level) => (
              <span
                key={level}
                className={cn(
                  'h-2 flex-1 rounded-full',
                  level <= skill.level
                    ? 'bg-accent'
                    : skill.targetLevel && level <= skill.targetLevel
                      ? 'bg-accent-soft'
                      : 'bg-surface-2',
                )}
              />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function SkillDialog() {
  const t = useTranslations('career')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addSkill')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addSkill')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await saveSkill({
                name: String(formData.get('name') ?? ''),
                category: String(formData.get('category') ?? ''),
                level: Number(formData.get('level') ?? 1),
                targetLevel: formData.get('targetLevel')
                  ? Number(formData.get('targetLevel'))
                  : null,
              })
              if (!result.ok) {
                toast.error(tc('error'))
                return
              }
              toast.success(t('saved'))
              setOpen(false)
            })
          }
          className="space-y-3"
        >
          <Field label={t('skillName')}>
            <Input name="name" required autoFocus maxLength={120} />
          </Field>
          <Field label={t('category')}>
            <Input name="category" maxLength={80} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('level')}>
              <Select name="level" defaultValue="3">
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('targetLevel')}>
              <Select name="targetLevel" defaultValue="">
                <option value="">—</option>
                {LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AchievementDialog({ today }: { today: ISODate }) {
  const t = useTranslations('career')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('addAchievement')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addAchievement')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await saveAchievement({
                title: String(formData.get('title') ?? ''),
                achievedOn: String(formData.get('achievedOn') ?? today),
                description: String(formData.get('description') ?? ''),
                impact: String(formData.get('impact') ?? ''),
                link: String(formData.get('link') ?? ''),
              })
              if (!result.ok) {
                toast.error(tc('error'))
                return
              }
              toast.success(t('saved'))
              setOpen(false)
            })
          }
          className="space-y-3"
        >
          <Field label={t('achievementTitle')}>
            <Input name="title" required autoFocus maxLength={200} />
          </Field>
          <Field label={t('achievedOn')}>
            <Input type="date" name="achievedOn" max={today} defaultValue={today} />
          </Field>
          <Field label={t('impact')}>
            <Textarea name="impact" rows={2} />
          </Field>
          <Field label={t('link')}>
            <Input name="link" type="url" maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PortfolioDialog() {
  const t = useTranslations('career')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addPortfolio')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addPortfolio')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await savePortfolioItem({
                title: String(formData.get('title') ?? ''),
                url: String(formData.get('url') ?? ''),
                description: String(formData.get('description') ?? ''),
                tech: String(formData.get('tech') ?? '')
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
              if (!result.ok) {
                toast.error(tc('error'))
                return
              }
              toast.success(t('saved'))
              setOpen(false)
            })
          }
          className="space-y-3"
        >
          <Field label={t('itemTitle')}>
            <Input name="title" required autoFocus maxLength={200} />
          </Field>
          <Field label="URL">
            <Input name="url" type="url" maxLength={500} />
          </Field>
          <Field label={t('description')}>
            <Textarea name="description" rows={3} />
          </Field>
          <Field label={t('tech')}>
            <Input name="tech" placeholder="Next.js, PostgreSQL" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PortfolioList({ items }: { items: PortfolioItem[] }) {
  const t = useTranslations('career')
  if (items.length === 0) return <p className="text-sm text-text-subtle">{t('noPortfolio')}</p>

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="rounded-[var(--radius)] border border-border-base p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{item.title}</span>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 text-accent"
                aria-label={item.title}
              >
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-text-subtle">{item.description}</p>
          ) : null}
          {item.tech && item.tech.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tech.map((tech) => (
                <Badge key={tech}>{tech}</Badge>
              ))}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function AchievementList({ items }: { items: Achievement[] }) {
  const t = useTranslations('career')
  if (items.length === 0) return <p className="text-sm text-text-subtle">{t('noAchievements')}</p>

  return (
    <ul className="divide-y divide-border-base">
      {items.map((item) => (
        <li key={item.id} className="py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{item.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-text-subtle">
              {item.achievedOn}
            </span>
          </div>
          {item.impact ? <p className="mt-0.5 text-sm text-text-muted">{item.impact}</p> : null}
        </li>
      ))}
    </ul>
  )
}
