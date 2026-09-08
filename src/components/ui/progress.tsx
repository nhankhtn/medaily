import { cn } from '@/lib/utils'

export function Progress({
  value,
  tone = 'accent',
  className,
  label,
}: {
  /** 0..100. Null renders an empty track rather than a zero bar. */
  value: number | null
  tone?: 'accent' | 'good' | 'warn' | 'bad'
  className?: string
  label?: string
}) {
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value))
  const toneClass = {
    accent: 'bg-accent',
    good: 'bg-good',
    warn: 'bg-warn',
    bad: 'bg-bad',
  }[tone]

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
      role="progressbar"
      aria-valuenow={value ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width]', toneClass)} style={{ width: `${pct}%` }} />
    </div>
  )
}
