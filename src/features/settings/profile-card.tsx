import { KeyRound, Mail } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { SessionProvider } from '@/lib/auth/session'
import { Card } from '@/components/ui/card'
import { ProfileAvatar } from '@/features/settings/profile-avatar'
import { ProfileEdit } from '@/features/settings/profile-edit'
import type { User } from '@/lib/db/schema'
import { isUploadedAvatar } from '@/lib/media/cloudinary'
import { mediaEnabled } from '@/server/services/media'

/**
 * Who you are signed in as. The photo is changed on the circle. History sits
 * at the end of the row, and the pencil that edits the name is under it.
 */
export async function ProfileCard({
  user,
  provider,
  subject,
  actions,
}: {
  user: User
  provider: SessionProvider
  subject: string
  /** The history button, drawn above the pencil. */
  actions?: React.ReactNode
}) {
  const [t, format] = await Promise.all([getTranslations('settings.profile'), getFormatter()])
  const email = user.email ?? (provider === 'google' ? subject : null)

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <ProfileAvatar
          imageUrl={user.imageUrl}
          displayName={user.displayName}
          enabled={mediaEnabled()}
          canRemove={isUploadedAvatar(user.imageUrl, user.id)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{user.displayName}</p>
          {user.username ? (
            <p className="text-text-subtle truncate text-sm">@{user.username}</p>
          ) : null}
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
        <div className="flex shrink-0 flex-col items-center">
          {actions}
          <ProfileEdit displayName={user.displayName} username={user.username} />
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
