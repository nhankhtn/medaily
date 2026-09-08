import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export default async function NotFound() {
  const t = await getTranslations('common')
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="text-2xl font-semibold">404</h1>
      <Button asChild variant="outline">
        <Link href="/">{t('today')}</Link>
      </Button>
    </div>
  )
}
