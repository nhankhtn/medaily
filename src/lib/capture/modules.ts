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
 * The destinations the menu offers.
 *
 * Never the assistant: the box already opens on it, so listing it would be an
 * entry for where you already are. It is reached by closing the menu, not by
 * choosing it. The rest are the places a note gets *filed*, which is a real
 * choice and the only one worth a list.
 */
export const FILING_MODULES: CaptureModule[] = CAPTURE_MODULES.filter(
  (module) => module.key !== 'assistant',
)

/**
 * The two destinations that write something down.
 *
 * `review` is in the menu but not here: it reads, like the assistant does, so
 * there is nothing to hand it. These are the ones the agent can send a note to
 * without being asked, and a name off a wire is checked before it is believed.
 */
export type FilingTarget = Extract<CaptureModuleKey, 'finance' | 'plan'>

export function isFilingTarget(value: unknown): value is FilingTarget {
  return value === 'finance' || value === 'plan'
}

/**
 * Whether the assistant can be the box's home. It answers from a separate
 * service, which a deploy may not have; without it the menu comes first, as
 * it did before there was an assistant at all.
 */
export function assistantModule(available: boolean): CaptureModule | null {
  if (!available) return null
  return CAPTURE_MODULES.find((module) => module.key === 'assistant') ?? null
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
