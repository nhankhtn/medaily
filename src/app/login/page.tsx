import { getTranslations } from 'next-intl/server'
import { Logo } from '@/components/brand/logo'
import { Card, CardBody } from '@/components/ui/card'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { GoogleButton } from '@/features/auth/google-button'
import { LoginForm } from '@/features/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const [t, params] = await Promise.all([getTranslations('auth'), searchParams])

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <Logo size={40} className="rounded-xl" />
            <LocaleSwitcher />
          </div>

          <h1 className="text-2xl font-semibold">{t('title')}</h1>

          <GoogleButton next={params.next} />

          <LoginForm next={params.next} />
        </CardBody>
      </Card>
    </div>
  )
}
