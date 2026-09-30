import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { JoinRoom } from '@/features/chat/join-room'
import { chatEnabled } from '@/lib/chat/provider'

/**
 * Where an invite link lands.
 *
 * It shows a button and nothing else happens on the way in. A link pasted into
 * a chat app is fetched by its preview bot before a person ever clicks it, and
 * a single-use invite spent on a GET would be gone by then.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (!chatEnabled()) notFound()

  const { code } = await params
  const t = await getTranslations('chat')

  return (
    <div className="mx-auto max-w-md space-y-4 pt-8">
      <h1 className="text-2xl font-semibold">{t('joinTitle')}</h1>
      <Card className="space-y-3 p-4">
        <p className="text-text-subtle text-sm leading-snug">{t('privacyNote')}</p>
        <JoinRoom code={code} />
      </Card>
    </div>
  )
}
