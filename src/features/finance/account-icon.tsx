import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { AccountType } from '@/lib/finance/account-types'
import { cn } from '@/lib/utils'

/** The brand colour is the tile, so the glyph on top stays white in both themes. */
const MARKS: Record<AccountType, { icon: LucideIcon; color: string }> = {
  cash: { icon: Banknote, color: '#3f7d58' },
  bidv: { icon: Landmark, color: '#00857c' },
  vcb: { icon: Landmark, color: '#00713f' },
  vib: { icon: Landmark, color: '#e35205' },
  bank: { icon: Landmark, color: '#5b6b7c' },
  momo: { icon: Wallet, color: '#a50064' },
  e_wallet: { icon: Wallet, color: '#6d55c9' },
  credit_card: { icon: CreditCard, color: '#b4553d' },
  investment: { icon: TrendingUp, color: '#2f6f9f' },
  loan: { icon: HandCoins, color: '#8a6d3b' },
}

/**
 * The real logo, where there is one — see `public/brands/README.md` for where
 * each file came from. Drop a file in that folder and add a line here and the
 * glyph above steps aside. `bleed` is for a logo that is already a full tile
 * (Momo's app icon); the rest are marks that need white behind them.
 */
const BRANDS: Partial<Record<AccountType, { src: string; bleed?: boolean }>> = {
  bidv: { src: '/brands/bidv.svg' },
  vcb: { src: '/brands/vcb.svg' },
  vib: { src: '/brands/vib.png' },
  momo: { src: '/brands/momo.png', bleed: true },
}

export function accountMark(type: AccountType) {
  return MARKS[type]
}

export function accountBrand(type: AccountType) {
  return BRANDS[type]
}

export function AccountIcon({ type, className }: { type: AccountType; className?: string }) {
  const tile = cn(
    'flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)]',
    className,
  )
  const brand = BRANDS[type]

  if (brand) {
    return (
      <span
        className={cn(
          tile,
          'overflow-hidden bg-white ring-1 ring-black/10',
          !brand.bleed && 'p-0.5',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 32px mark; the optimiser has nothing to do */}
        <img src={brand.src} alt="" className="size-full object-contain" />
      </span>
    )
  }

  const { icon: Icon, color } = MARKS[type]

  return (
    <span aria-hidden style={{ backgroundColor: color }} className={cn(tile, 'text-white')}>
      <Icon className="size-4" strokeWidth={2.25} />
    </span>
  )
}
