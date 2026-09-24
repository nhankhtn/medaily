'use client'

import { LifeBuoy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/features/projects/project-dialog'
import { sendSupport } from '@/server/actions/support'

/**
 * Writing in without leaving the app.
 *
 * Rendered only where the chat it forwards to is configured, so a deploy with
 * nowhere to send a note never offers to take one — a button that swallows
 * what somebody wrote is worse than no button.
 *
 * The page they were on rides along. Nearly every note is about the screen
 * that is open, and asking for it is asking someone to describe what the app
 * already knows.
 */
export function SupportDialog({
  signedIn,
  trigger,
}: {
  signedIn: boolean
  trigger?: React.ReactNode
}) {
  const t = useTranslations('support')
  const tc = useTranslations('common')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="ghost">
            <LifeBuoy className="size-4" />
            {t('title')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={t('title')} description={t('body')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await sendSupport({
                body: String(formData.get('body') ?? ''),
                replyTo: String(formData.get('replyTo') ?? ''),
                path: pathname,
              })

              if (!result.ok) {
                toast.error(
                  result.error === 'rate_limited'
                    ? t('tooMany')
                    : result.error === 'invalid_input'
                      ? t('tooShort')
                      : t('unavailable'),
                )
                return
              }

              toast.success(t('sent'))
              setOpen(false)
            })
          }
          className="space-y-3"
        >
          <Field label={t('message')}>
            <Textarea
              name="body"
              rows={5}
              required
              autoFocus
              minLength={5}
              maxLength={2000}
              placeholder={t('placeholder')}
            />
          </Field>

          {/* A session already names them, and a typed address would only be
              a second, less reliable one. */}
          {signedIn ? null : (
            <Field label={t('replyTo')}>
              <Input name="replyTo" type="email" maxLength={200} autoComplete="email" />
              <p className="text-text-subtle mt-1 text-xs">{t('replyToHint')}</p>
            </Field>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {t('send')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
