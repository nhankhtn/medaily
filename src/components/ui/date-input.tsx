'use client'

import { CalendarDays } from 'lucide-react'
import * as React from 'react'
import { formatDate } from '@/lib/format/dates'
import type { ISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Native `<input type="date">` always paints the OS locale string — on a
 * Vietnamese iPhone that is "ngày 20 thg 9, 2026", which blows out a narrow
 * row. The real control stays for the picker and the form value; what you
 * see is always `dd/mm/yyyy`, matching `formatDate`.
 *
 * The native calendar glyph is only a few pixels wide once the input is
 * invisible, so taps on the date text do nothing useful. We stretch the
 * picker indicator across the field and call `showPicker()` on press so the
 * whole control opens the calendar.
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

  const openPicker = () => {
    const input = inputRef.current
    if (!input || disabled) return
    try {
      input.showPicker()
    } catch {
      /* Older engines — fall through to the stretched native indicator. */
      input.focus()
    }
  }

  return (
    <div
      className={cn(
        // Height lives on the wrapper so callers (e.g. draft rows with `h-9`)
        // shrink the whole control; the face fills it instead of overflowing.
        // Wrapper ignores pointers so a near-invisible native input is the
        // only hit target — otherwise elementFromPoint lands on this box and
        // the picker never opens.
        'group pointer-events-none relative h-10 w-full sm:h-11',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'glass border-border-strong flex h-10 w-full items-center gap-2 rounded-[var(--radius)] pr-2.5 pl-2.5 text-base tabular-nums sm:h-11 sm:pr-3 sm:pl-3',
          'group-focus-within:border-accent group-focus-within:inset-ring-accent group-focus-within:inset-ring-1',
          shown ? 'text-text' : 'text-text-subtle',
          disabled && 'opacity-50',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {shown ? formatDate(shown as ISODate) : 'dd/mm/yyyy'}
        </span>
        <CalendarDays className="text-text-muted size-4 shrink-0" />
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
        className={cn(
          // Keep a hair of opacity so WebKit still hit-tests the full box;
          // `opacity-0` collapses the tappable region to the tiny glyph.
          // Re-enable pointers here — the wrapper turned them off.
          'absolute inset-0 z-10 h-full w-full cursor-pointer opacity-[0.01] disabled:cursor-not-allowed',
          '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
          '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
        )}
      />
    </div>
  )
}

function stringify(
  value: React.ComponentProps<'input'>['value'] | React.ComponentProps<'input'>['defaultValue'],
) {
  if (value == null) return ''
  return String(value)
}
