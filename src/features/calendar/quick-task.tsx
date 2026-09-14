'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ISODate } from '@/lib/dates'
import { saveTask } from '@/server/actions/projects'

/**
 * A task without a project. Anything that needs a project, a due date or an
 * estimate is a project task and belongs on the project page.
 */
export function QuickTask({ date }: { date: ISODate }) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()

  const add = () => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return

    startTransition(async () => {
      try {
        // The day being looked at is the day it is due, so planning tomorrow
        // is a matter of being on tomorrow's page.
        const result = await saveTask({ title: trimmed, projectId: null, dueDate: date })
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        setTitle('')
        router.refresh()
      } catch (error) {
        console.error('[today] could not add that task:', error)
        toast.error(tc('error'))
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        placeholder={t('addPlaceholder')}
        aria-label={t('add')}
        className="h-9 w-56"
      />
      <Button size="sm" disabled={pending || title.trim().length === 0} onClick={add}>
        <Plus className="size-4" />
        {t('add')}
      </Button>
    </div>
  )
}
