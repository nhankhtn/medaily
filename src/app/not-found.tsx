import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/paths'

export default async function NotFound() {
  const t = await getTranslations('common')

  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <div>
        <p className="text-lg font-medium">{t('notFound')}</p>
        <p className="mt-1 max-w-prose text-sm text-text-muted">{t('notFoundHint')}</p>
      </div>
      <Button asChild>
        <Link href={PATHS.home}>{t('backHome')}</Link>
      </Button>
    </div>
  )
}
