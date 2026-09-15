import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from 'sonner'
import { RequestIdProvider } from '@/components/shell/request-id'
import { FORMATS } from '@/lib/format/dates'
import { REQUEST_ID_HEADER } from '@/lib/request-id'
import { themeBootScript } from '@/lib/themes'
import { getShellSettings, getShellTheme } from '@/server/services/settings'
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
  // The soft keyboard shrinks the layout viewport, so a bottom sheet stays
  // above it and `dvh` means what it says while someone is typing.
  interactiveWidget: 'resizes-content',
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
  const [locale, messages, settings, theme, requestHeaders] = await Promise.all([
    getLocale(),
    getMessages(),
    getShellSettings(),
    getShellTheme(),
    headers(),
  ])

  return (
    <html
      lang={locale}
      data-theme-pref={theme}
      data-density={settings.density}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          formats={FORMATS}
          timeZone={settings.timezone}
        >
          <RequestIdProvider value={requestHeaders.get(REQUEST_ID_HEADER)}>
            {children}
          </RequestIdProvider>
          <Toaster position="top-center" closeButton richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
