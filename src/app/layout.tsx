import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from 'sonner'
import { themeBootScript } from '@/lib/themes'
import { getShellSettings } from '@/server/services/settings'
import './globals.css'

export const metadata: Metadata = {
  title: 'Personal OS',
  description: 'Track daily performance, understand behaviour, manage goals.',
  applicationName: 'Personal OS',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1f' },
  ],
}

/**
 * The theme is applied before first paint to avoid a flash. `system` is
 * resolved in the browser, because the server cannot know the OS preference.
 */
const themeScript = themeBootScript()

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, settings] = await Promise.all([
    getLocale(),
    getMessages(),
    getShellSettings(),
  ])

  return (
    <html
      lang={locale}
      data-theme-pref={settings.theme}
      data-density={settings.density}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={settings.timezone}>
          {children}
          <Toaster position="top-center" closeButton richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
