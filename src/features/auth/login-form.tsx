'use client'

import { Loader2, LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login, type LoginState } from '@/server/actions/auth'

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth')
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, { error: null })

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />

      <div className="space-y-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          {t('username')}
        </label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={state.error === 'invalid'}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          {t('password')}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error === 'invalid'}
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-[var(--radius)] bg-bad-soft px-3 py-2 text-sm text-bad">
          {t(
            state.error === 'invalid'
              ? 'invalid'
              : state.error === 'rate_limited'
                ? 'rateLimited'
                : 'notConfigured',
          )}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        {pending ? t('signingIn') : t('submit')}
      </Button>
    </form>
  )
}
