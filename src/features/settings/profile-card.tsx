import { KeyRound, Mail } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { SessionProvider } from '@/lib/auth/session'
import { Card } from '@/components/ui/card'
import type { User } from '@/lib/db/schema'

/**
 * Who you are signed in as. Read-only: the name and avatar come from the
 * Google account on every sign-in, so a copy edited here would be overwritten
 * the next time you signed in.
 */
export async function ProfileCard({
  user,
  provider,
  subject,
}: {
  user: User
  provider: SessionProvider
  subject: string
}) {
  const [t, format] = await Promise.all([getTranslations('settings.profile'), getFormatter()])
  const email = user.email ?? (provider === 'google' ? subject : null)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{user.displayName}</p>
          <p className="text-text-subtle mt-0.5 flex items-center gap-1.5 truncate text-sm">
            {email ? (
              <>
                <Mail className="size-3.5 shrink-0" />
                {email}
              </>
            ) : (
              <>
                <KeyRound className="size-3.5 shrink-0" />
                {t('username', { name: subject })}
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="border-border-base mt-4 grid gap-x-8 gap-y-3 border-t pt-3 sm:grid-cols-2">
        <Row label={t('signedInWith')} value={t(`providers.${provider}`)} />
        <Row label={t('since')} value={format.dateTime(user.createdAt, 'dayMonthYear')} />
      </dl>
    </Card>
  )
}

/** Label above value: side by side, one pair's value reads as the next one's label. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-text-subtle text-xs">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  )
}

function Avatar({ user }: { user: User }) {
  if (user.imageUrl) {
    return (
      // A Google avatar is a remote URL on a host we do not control; plain
      // `img` keeps it out of the image optimiser's allowlist.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.imageUrl}
        alt=""
        width={56}
        height={56}
        className="border-border-base size-14 shrink-0 rounded-full border object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      className="bg-accent text-accent-text flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
    >
      {[...user.displayName.trim()][0]?.toUpperCase() ?? '?'}
    </span>
  )
}
