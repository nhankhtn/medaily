import { KeyRound, Mail } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { SessionProvider } from '@/lib/auth/session'
import { Card } from '@/components/ui/card'
import { ProfileAvatar } from '@/features/settings/profile-avatar'
import type { User } from '@/lib/db/schema'
import { isUploadedAvatar } from '@/lib/media/cloudinary'
import { mediaEnabled } from '@/server/services/media'

/**
 * Who you are signed in as. Name still follows the Google account; the photo
 * can be replaced here and survives the next sign-in.
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
        <ProfileAvatar
          imageUrl={user.imageUrl}
          displayName={user.displayName}
          enabled={mediaEnabled()}
          canRemove={isUploadedAvatar(user.imageUrl, user.id)}
        />
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
