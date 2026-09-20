'use client'

import * as React from 'react'
import { formatDate } from '@/lib/format/dates'
import type { ISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Native `<input type="date">` always paints the OS locale string — on a
 * Vietnamese iPhone that is "ngày 20 thg 9, 2026", which blows out a narrow
 * row. The real control stays for the picker and the form value; what you
 * see is always `dd/mm/yyyy`, matching `formatDate`.
 */
export function DateInput({
  className,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const controlled = value !== undefined
  const [inner, setInner] = React.useState(stringify(defaultValue))
  const shown = controlled ? stringify(value) : inner

  /*
   * A controlled field rewrites `inner` only through `value`. An uncontrolled
   * one also has to clear when its form resets — same trick as MoneyInput.
   */
  React.useEffect(() => {
    if (controlled) return
    const form = inputRef.current?.form
    if (!form) return
    const onReset = () => queueMicrotask(() => setInner(stringify(defaultValue)))
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [controlled, defaultValue])

  return (
    <div className={cn('group relative', className)}>
      <div
        aria-hidden
        className={cn(
          'glass flex h-10 w-full items-center rounded-[var(--radius)] border-border-strong px-2.5 text-base tabular-nums sm:h-11 sm:px-3',
          'group-focus-within:border-accent group-focus-within:inset-ring-accent group-focus-within:inset-ring-1',
          shown ? 'text-text' : 'text-text-subtle',
          disabled && 'opacity-50',
        )}
      >
        {shown ? formatDate(shown as ISODate) : 'dd/mm/yyyy'}
      </div>
      <input
        {...props}
        ref={inputRef}
        type="date"
        disabled={disabled}
        value={controlled ? value : undefined}
        defaultValue={controlled ? undefined : defaultValue}
        onChange={(event) => {
          if (!controlled) setInner(event.target.value)
          onChange?.(event)
        }}
        onBlur={onBlur}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function stringify(value: React.ComponentProps<'input'>['value'] | React.ComponentProps<'input'>['defaultValue']) {
  if (value == null) return ''
  return String(value)
}
