import { LineChart, Wallet, type LucideIcon } from 'lucide-react'

/**
 * What `/` offers in the capture box.
 *
 * A registry, like `NAV_ITEMS`: adding a module is one entry here plus a branch
 * in the box's dispatch, rather than edits scattered through the UI.
 */
export type CaptureModuleKey = 'finance' | 'review'

export type CaptureModule = {
  key: CaptureModuleKey
  icon: LucideIcon
  /** Label and example come from `nav.<key>` and `capture.examples.<key>`. */
  labelKey: string
  /** Extra words the slash filter should match, beyond the translated label. */
  aliases: string[]
}

export const CAPTURE_MODULES: CaptureModule[] = [
  {
    key: 'finance',
    icon: Wallet,
    labelKey: 'finance',
    aliases: ['finance', 'money', 'chi', 'thu', 'tien', 'tài chính', 'chi tiêu'],
  },
  {
    key: 'review',
    icon: LineChart,
    labelKey: 'reviews',
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
]

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

export function matchModules(query: string, labelOf: (module: CaptureModule) => string) {
  const needle = query.trim().toLowerCase()
  if (needle === '') return CAPTURE_MODULES

  return CAPTURE_MODULES.filter((module) =>
    [labelOf(module), module.key, ...module.aliases].some((candidate) =>
      candidate.toLowerCase().includes(needle),
    ),
  )
}
