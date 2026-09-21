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
  /**
   * What makes "Add to Home Screen" open as an app on iOS, which reads the
   * manifest for almost nothing — `display: standalone` there is ignored, and
   * without this the icon opens Safari with its address bar.
   *
   * It is also what keeps the offline queue: iOS clears script-writable
   * storage for a site untouched for about a week, and an installed web app
   * is outside that rule. On Android the manifest already does this job.
   *
   * `default`, not `black-translucent`: translucent puts the page under the
   * status bar, and nothing here reads `safe-area-inset-top` — the header
   * would sit behind the clock.
   */
  appleWebApp: { title: 'Personal OS', statusBarStyle: 'default' },
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
