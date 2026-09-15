'use client'

import { Archive, Check, Pencil, Settings2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Topic } from '@/lib/db/schema'
import { archiveTopic, saveTopic } from '@/server/actions/learning'

/**
 * Topics, managed from a dialog rather than a panel: they are set up once and
 * then only chosen, so they do not deserve standing room on the page.
 */
export function TopicManager({ topics }: { topics: Topic[] }) {
  const t = useTranslations('learning')
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Settings2 className="size-4" />
          {t('manageTopics')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('topics')}>
        <div className="space-y-4">
          <NewTopic />

          {topics.length === 0 ? (
            <p className="text-text-subtle text-sm">{t('noTopics')}</p>
          ) : (
            <ul className="divide-border-base divide-y">
              {topics.map((topic) => (
                <li key={topic.id} className="py-2">
                  <TopicRow topic={topic} />
                </li>
              ))}
            </ul>
          )}

          <p className="text-text-subtle text-xs">{t('topicHelp')}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NewTopic() {
  const t = useTranslations('learning')
  const tc = useTranslations('common')
  const [name, setName] = useState('')
  const [pending, startTransition] = useTransition()

  const add = () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    startTransition(async () => {
      const result = await saveTopic({ name: trimmed })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      setName('')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        autoFocus
        maxLength={120}
        aria-label={t('addTopic')}
        placeholder={t('topicPlaceholder')}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        className="h-9"
      />
      <Button size="sm" disabled={pending || name.trim() === ''} onClick={add}>
        {tc('add')}
      </Button>
    </div>
  )
}

function TopicRow({ topic }: { topic: Topic }) {
  const t = useTranslations('learning')
  const tc = useTranslations('common')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(topic.name)
  const [pending, startTransition] = useTransition()

  const rename = () => {
    const trimmed = name.trim()
    if (trimmed === '' || trimmed === topic.name) {
      setName(topic.name)
      setEditing(false)
      return
    }
    startTransition(async () => {
      const result = await saveTopic({ id: topic.id, name: trimmed })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      setEditing(false)
    })
  }

  const archive = () =>
    startTransition(async () => {
      const result = await archiveTopic({ id: topic.id })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('topicArchived'))
    })

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={name}
          autoFocus
          maxLength={120}
          aria-label={t('renameTopic')}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              rename()
            }
            if (event.key === 'Escape') {
              event.stopPropagation()
              setName(topic.name)
              setEditing(false)
            }
          }}
          className="h-9"
        />
        <button
          type="button"
          onClick={rename}
          disabled={pending}
          aria-label={tc('save')}
          className="text-text-subtle hover:text-accent shrink-0"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setName(topic.name)
            setEditing(false)
          }}
          aria-label={tc('cancel')}
          className="text-text-subtle hover:text-text shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm">{topic.name}</span>

      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t('renameTopic')}
        className="text-text-subtle hover:text-text shrink-0"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={archive}
        disabled={pending}
        aria-label={t('archiveTopic')}
        title={t('archiveTopicHint')}
        className="text-text-subtle hover:text-warn shrink-0"
      >
        <Archive className="size-3.5" />
      </button>
    </div>
  )
}
