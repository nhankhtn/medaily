'use client'

import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useBindings } from '@/features/shortcuts/provider'
import {
  ACTIONS,
  actionById,
  bindingKeyCaps,
  chordFromEvent,
  GROUP_ORDER,
  isChordBinding,
  type ShortcutAction,
} from '@/lib/shortcuts'
import { cn } from '@/lib/utils'
import { resetAllShortcuts, resetShortcut, setShortcut } from '@/server/actions/shortcuts'

/*
 * The modifier is a browser fact, not state: `useSyncExternalStore` reads it
 * with a server snapshot, so the markup matches on the first paint instead of
 * correcting itself after mount. It never changes, so nothing to subscribe to.
 */
const subscribeToNothing = () => () => {}
const macSnapshot = () => (navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl')
const serverSnapshot = () => 'Ctrl'

/** How long a bare key waits to see whether it is the start of a sequence. */
const SEQUENCE_WINDOW_MS = 800

export function ShortcutsDialog({
  captureEnabled,
  global = false,
  trigger,
}: {
  captureEnabled: boolean
  global?: boolean
  trigger?: React.ReactNode
}) {
  const t = useTranslations('settings.shortcuts')
  const tn = useTranslations('nav')
  const tc = useTranslations('common')
  const bindings = useBindings()
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const modLabel = useSyncExternalStore(subscribeToNothing, macSnapshot, serverSnapshot)

  useEffect(() => {
    if (!global) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      event.preventDefault()
      setOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [global])

  const save = (id: string, binding: string) =>
    startTransition(async () => {
      const result = await setShortcut({ id, binding })
      if (result.ok) {
        toast.success(t('saved'))
        return
      }
      if (result.error === 'taken' && result.takenBy) {
        const other = actionById(result.takenBy)
        toast.error(
          t('taken', {
            action: other?.labelNamespace === 'nav' ? tn(other.id) : t(`items.${result.takenBy}`),
          }),
        )
        return
      }
      toast.error(tc('error'))
    })

  useRecorder(recording, bindings, (binding) => {
    const id = recording
    setRecording(null)
    if (id && binding) save(id, binding)
  })

  const groups = GROUP_ORDER.map((group) => ({
    id: group,
    actions: ACTIONS.filter(
      (action) => action.group === group && (captureEnabled || !action.needsCapture),
    ),
  })).filter((group) => group.actions.length > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setRecording(null)
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent title={t('title')} description={t('help')} className="sm:max-w-2xl">
        <div className="gap-x-8 sm:columns-2">
          {groups.map((group) => (
            <div key={group.id} className="mb-4 break-inside-avoid">
              <h3 className="text-text-muted text-xs font-semibold tracking-wide uppercase">
                {t(`groups.${group.id}`)}
              </h3>
              <ul className="divide-border-base mt-1 divide-y">
                {group.actions.map((action) => (
                  <Row
                    key={action.id}
                    action={action}
                    binding={bindings[action.id] ?? action.binding}
                    label={action.labelNamespace === 'nav' ? tn(action.id) : t(`items.${action.id}`)}
                    modLabel={modLabel}
                    recording={recording === action.id}
                    onRecord={() => setRecording(recording === action.id ? null : action.id)}
                    onReset={() =>
                      startTransition(async () => {
                        await resetShortcut({ id: action.id })
                      })
                    }
                    thenLabel={t('then')}
                    recordingLabel={t('press')}
                    resetLabel={t('reset')}
                    isDefault={bindings[action.id] === action.binding}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border-base mt-2 flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-text-subtle text-xs">{t('editHint')}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              startTransition(async () => {
                await resetAllShortcuts()
                toast.success(t('resetAllDone'))
              })
            }
          >
            <RotateCcw className="size-3.5" />
            {t('resetAll')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  action,
  binding,
  label,
  modLabel,
  recording,
  onRecord,
  onReset,
  thenLabel,
  recordingLabel,
  resetLabel,
  isDefault,
}: {
  action: ShortcutAction
  binding: string
  label: string
  modLabel: string
  recording: boolean
  onRecord: () => void
  onReset: () => void
  thenLabel: string
  recordingLabel: string
  resetLabel: string
  isDefault: boolean
}) {
  const caps = bindingKeyCaps(binding)
  const sequence = isChordBinding(binding)

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0 text-sm">{label}</span>

      <span className="flex shrink-0 items-center gap-1">
        {!isDefault ? (
          <button
            type="button"
            onClick={onReset}
            aria-label={resetLabel}
            title={resetLabel}
            className="text-text-subtle hover:text-text"
          >
            <RotateCcw className="size-3" />
          </button>
        ) : null}

        <button
          type="button"
          onClick={onRecord}
          aria-label={`${label} — ${recordingLabel}`}
          className={cn(
            'flex items-center gap-1 rounded px-1 py-0.5',
            recording ? 'ring-accent ring-2' : 'hover:bg-surface-2',
          )}
        >
          {recording ? (
            <span className="text-accent text-[11px] font-medium">{recordingLabel}</span>
          ) : (
            caps.map((cap, index) => (
              <span key={`${action.id}-${index}`} className="flex items-center gap-1">
                {index > 0 && sequence ? (
                  <span className="text-text-subtle text-[10px]">{thenLabel}</span>
                ) : null}
                <Kbd>{cap === 'mod' ? modLabel : cap}</Kbd>
              </span>
            ))
          )}
        </button>
      </span>
    </li>
  )
}

/**
 * Reads the next keypress as a binding.
 *
 * A bare key waits a moment before it commits: `g` on its own is a shortcut,
 * and `g` then `d` is a different one, and only time tells them apart. The
 * listener captures, so the app's own dispatcher never sees these presses.
 */
function useRecorder(
  recording: string | null,
  bindings: Record<string, string>,
  onDone: (binding: string | null) => void,
) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    if (!recording) return

    let leader: string | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const commit = (binding: string | null) => {
      if (timer) clearTimeout(timer)
      done.current(binding)
    }

    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        commit(null)
        return
      }

      const chord = chordFromEvent(event)
      if (!chord) return

      if (leader) {
        commit(`${leader} ${chord}`)
        return
      }

      // A modifier chord can never lead a sequence, so it is final.
      if (chord.includes('+')) {
        commit(chord)
        return
      }

      leader = chord
      timer = setTimeout(() => done.current(chord), SEQUENCE_WINDOW_MS)
    }

    window.addEventListener('keydown', onKey, true)
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [recording, bindings])
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        'border-border-strong bg-surface-2 text-text-muted inline-flex h-6 min-w-6 items-center',
        'justify-center rounded border px-1.5 font-sans text-[11px] font-medium',
      )}
    >
      {children}
    </kbd>
  )
}
