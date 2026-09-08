import { BottomNav } from '@/components/shell/bottom-nav'
import { Header } from '@/components/shell/header'
import { Sidebar } from '@/components/shell/sidebar'
import { today } from '@/lib/dates'
import { dayContextOf, getSettings } from '@/server/services/settings'

/**
 * The application shell. It lives in a route group so the sign-in page renders
 * on its own, without navigation to a place the visitor cannot reach yet.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const logicalToday = today(dayContextOf(settings))

  return (
    <>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header today={logicalToday} theme={settings.theme} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 md:pb-8">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </>
  )
}
