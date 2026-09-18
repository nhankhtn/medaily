import { Bot, LineChart, ListChecks, Wallet, type LucideIcon } from 'lucide-react'

/**
 * What `/` offers in the capture box.
 *
 * A registry, like `NAV_ITEMS`: adding a module is one entry here plus a branch
 * in the box's dispatch, rather than edits scattered through the UI.
 *
 * Label and example come from `capture.modules.<key>` and
 * `capture.examples.<key>`. The box names its own destinations rather than
 * borrowing from `nav`: not every destination is a page, and the one that
 * files goals and tasks together answers to no single nav entry.
 */
export type CaptureModuleKey = 'finance' | 'plan' | 'review' | 'assistant'

export type CaptureModule = {
  key: CaptureModuleKey
  icon: LucideIcon
  /** Extra words the slash filter should match, beyond the translated label. */
  aliases: string[]
}

export const CAPTURE_MODULES: CaptureModule[] = [
  {
    key: 'finance',
    icon: Wallet,
    aliases: ['finance', 'money', 'chi', 'thu', 'tien', 'tài chính', 'chi tiêu'],
  },
  {
    key: 'plan',
    icon: ListChecks,
    aliases: [
      'plan',
      'goal',
      'todo',
      'task',
      'muc tieu',
      'mục tiêu',
      'viec',
      'việc',
      'can lam',
      'cần làm',
      'ke hoach',
      'kế hoạch',
    ],
  },
  {
    key: 'review',
    icon: LineChart,
    aliases: [
      'review',
      'tong ket',
      'tổng kết',
      'nhin lai',
      'nhìn lại',
      'tuan',
      'tuần',
      'thang',
      'tháng',
    ],
  },
  {
    key: 'assistant',
    icon: Bot,
    aliases: [
      'assistant',
      'agent',
      'ai',
      'hoi',
      'hỏi',
      'tro ly',
      'trợ lý',
      'chat',
    ],
  },
]

/**
 * The destinations actually on offer. The assistant answers from a separate
 * service, which a deploy may not have; the others run in this app and are
 * always there.
 */
export function availableModules(assistant: boolean): CaptureModule[] {
  return assistant ? CAPTURE_MODULES : CAPTURE_MODULES.filter((m) => m.key !== 'assistant')
}

/**
 * The slash token being typed, or null when the caret is not in one. Only a
 * leading `/` opens the menu: a slash inside a note is just a slash.
 */
export function slashQuery(text: string): string | null {
  if (!text.startsWith('/')) return null
  const token = text.slice(1)
  // The menu closes once the token is finished — a space means the user moved on.
  return /\s/.test(token) ? null : token
}

export function matchModules(
  query: string,
  labelOf: (module: CaptureModule) => string,
  modules: CaptureModule[] = CAPTURE_MODULES,
) {
  const needle = query.trim().toLowerCase()
  if (needle === '') return modules

  return modules.filter((module) =>
    [labelOf(module), module.key, ...module.aliases].some((candidate) =>
      candidate.toLowerCase().includes(needle),
    ),
  )
}
