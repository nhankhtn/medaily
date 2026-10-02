import { cn } from '@/lib/utils'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * A number whose digits roll to their new value, odometer style.
 *
 * Columns are keyed from the right, so 9 → 10 rolls the units and grows a tens
 * column instead of re-rolling everything. The text itself is in a sr-only
 * span; the columns are decoration.
 */
export function RollingNumber({ value, className }: { value: string; className?: string }) {
  const chars = value.split('')

  return (
    <span className={cn('inline-flex tabular-nums', className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className="inline-flex leading-none">
        {chars.map((char, index) => {
          const slot = chars.length - index
          if (!/\d/.test(char)) return <span key={`s${slot}`}>{char}</span>
          return (
            <span key={`d${slot}`} className="relative inline-block h-[1em] overflow-hidden">
              <span className="invisible">0</span>
              <span
                className="rolling-digit absolute inset-x-0 top-0 flex flex-col"
                style={{ transform: `translateY(-${Number(char) * 10}%)` }}
              >
                {DIGITS.map((digit) => (
                  <span key={digit} className="h-[1em]">
                    {digit}
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}
