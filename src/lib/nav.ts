import {
  Activity,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  GraduationCap,
  Heart,
  Home,
  NotebookPen,
  Repeat,
  Settings,
  Target,
  Timer,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { PATHS } from '@/lib/paths'

/**
 * Spec 26.4 — navigation is a registry, so a new module adds one entry instead
 * of edits scattered across the shell.
 */
export type NavGroup = 'core' | 'life' | 'insight'

export type NavItem = {
  key: string
  href: string
  icon: LucideIcon
  group: NavGroup
  /** Shown in the mobile bottom bar (spec 22.3). Max 4 + More. */
  bottomBar?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', href: PATHS.home, icon: Home, group: 'core', bottomBar: true },
  { key: 'daily', href: PATHS.daily, icon: ClipboardList, group: 'core', bottomBar: true },
  { key: 'habits', href: PATHS.habits, icon: Repeat, group: 'core', bottomBar: true },
  { key: 'goals', href: PATHS.goals, icon: Target, group: 'core' },
  { key: 'projects', href: PATHS.projects, icon: FolderKanban, group: 'core' },
  { key: 'learning', href: PATHS.learning, icon: GraduationCap, group: 'core' },
  { key: 'timer', href: PATHS.timer, icon: Timer, group: 'core' },
  { key: 'health', href: PATHS.health, icon: Heart, group: 'life' },
  { key: 'finance', href: PATHS.finance, icon: Wallet, group: 'life', bottomBar: true },
  { key: 'journal', href: PATHS.journal, icon: NotebookPen, group: 'life' },
  { key: 'calendar', href: PATHS.calendar(), icon: CalendarDays, group: 'life' },
  { key: 'people', href: PATHS.people, icon: Users, group: 'life' },
  { key: 'career', href: PATHS.career, icon: Briefcase, group: 'life' },
  { key: 'analytics', href: PATHS.analytics, icon: BarChart3, group: 'insight' },
  { key: 'reviews', href: PATHS.reviews, icon: BookOpen, group: 'insight' },
  { key: 'settings', href: PATHS.settings, icon: Settings, group: 'insight' },
]

export const NAV_GROUPS: { group: NavGroup; labelKey: string }[] = [
  { group: 'core', labelKey: 'groupCore' },
  { group: 'life', labelKey: 'groupLife' },
  { group: 'insight', labelKey: 'groupInsight' },
]

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((i) => i.bottomBar)
export const MORE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.bottomBar)
export const ACTIVITY_ICON = Activity
