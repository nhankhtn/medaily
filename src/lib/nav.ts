import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  GraduationCap,
  Heart,
  Home,
  NotebookPen,
  Repeat,
  Search,
  Settings,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

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
  { key: 'home', href: '/', icon: Home, group: 'core', bottomBar: true },
  { key: 'daily', href: '/daily', icon: ClipboardList, group: 'core', bottomBar: true },
  { key: 'habits', href: '/habits', icon: Repeat, group: 'core', bottomBar: true },
  { key: 'goals', href: '/goals', icon: Target, group: 'core', bottomBar: true },
  { key: 'projects', href: '/projects', icon: FolderKanban, group: 'core' },
  { key: 'learning', href: '/learning', icon: GraduationCap, group: 'core' },
  { key: 'health', href: '/health', icon: Heart, group: 'life' },
  { key: 'finance', href: '/finance', icon: Wallet, group: 'life' },
  { key: 'journal', href: '/journal', icon: NotebookPen, group: 'life' },
  { key: 'knowledge', href: '/knowledge', icon: Brain, group: 'life' },
  { key: 'calendar', href: '/calendar', icon: CalendarDays, group: 'life' },
  { key: 'people', href: '/people', icon: Users, group: 'life' },
  { key: 'career', href: '/career', icon: Briefcase, group: 'life' },
  { key: 'search', href: '/search', icon: Search, group: 'insight' },
  { key: 'analytics', href: '/analytics', icon: BarChart3, group: 'insight' },
  { key: 'reviews', href: '/reviews', icon: BookOpen, group: 'insight' },
  { key: 'settings', href: '/settings', icon: Settings, group: 'insight' },
]

export const NAV_GROUPS: { group: NavGroup; labelKey: string }[] = [
  { group: 'core', labelKey: 'groupCore' },
  { group: 'life', labelKey: 'groupLife' },
  { group: 'insight', labelKey: 'groupInsight' },
]

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((i) => i.bottomBar)
export const MORE_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.bottomBar)
export const ACTIVITY_ICON = Activity
