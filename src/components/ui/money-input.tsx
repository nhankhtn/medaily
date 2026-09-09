'use client'

import { useLocale } from 'next-intl'
import * as React from 'react'
import { Input } from '@/components/ui/input'
import {
  caretAfterDigits,
  countDigits,
  formatMoneyInput,
  moneySeparators,
  parseMoneyInput,
} from '@/lib/format/money'

/**
 * A money field that reads like money while it is being typed: `100000` shows
 * as `100.000` in Vietnamese and `100,000` in English, regrouped on every
 * keystroke.
 *
 * `type="number"` cannot do this — a browser number input treats its own
 * locale's group separator as invalid and then reports an empty value — so the
 * visible field is text and a hidden sibling carries the plain number under
 * `name`. Every form here already reads `Number(formData.get(name))`, which
 * keeps working untouched.
 */
export function MoneyInput({
  name,
  defaultValue,
  allowNegative = false,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type' | 'defaultValue' | 'value' | 'onChange'> & {
  name: string
  defaultValue?: number | null
  /** Only balances may go below zero; amounts and prices never do. */
  allowNegative?: boolean
}) {
  const locale = useLocale()
  const separators = React.useMemo(() => moneySeparators(locale), [locale])

  const initialText = React.useMemo(
    () =>
      defaultValue === null || defaultValue === undefined
        ? ''
        : formatMoneyInput(String(defaultValue), separators),
    [defaultValue, separators],
  )

  const [text, setText] = React.useState(initialText)
  const inputRef = React.useRef<HTMLInputElement>(null)
  /** Digits left of the caret, so regrouping does not drag it backwards. */
  const caretDigits = React.useRef<number | null>(null)

  React.useEffect(() => {
    const element = inputRef.current
    const digitsBefore = caretDigits.current
    caretDigits.current = null
    if (!element || digitsBefore === null) return
    const position = caretAfterDigits(element.value, digitsBefore)
    element.setSelectionRange(position, position)
  }, [text])

  /*
   * The field is controlled, so `form.reset()` alone would leave the typed
   * amount on screen after a save. Clear it when its form resets.
   */
  React.useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const onReset = () => setText(initialText)
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [initialText])

  const reformat = (value: string) =>
    setText(formatMoneyInput(parseMoneyInput(value, separators, allowNegative), separators))

  // A lone minus sign is not a number yet, so it submits as empty.
  const raw = parseMoneyInput(text, separators, allowNegative)

  return (
    <>
      {/*
       * The carrier comes first on purpose. Tailwind's `space-y-*` puts its
       * gap on `> :not(:last-child)`, so a hidden sibling *after* the visible
       * field would stop that field being `:last-child` and leave 6px of dead
       * space under it — enough to knock the whole group out of an
       * `items-end` row. Ordered this way the visible input stays last and
       * the component occupies exactly the space a plain `<Input>` would.
       */}
      <input type="hidden" name={name} value={raw === '-' ? '' : raw} />
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const element = event.target
          caretDigits.current = countDigits(
            element.value.slice(0, element.selectionStart ?? element.value.length),
          )
          reformat(element.value)
        }}
        // A trailing separator is a half-typed decimal; drop it on the way out.
        onBlur={(event) => {
          reformat(event.target.value)
          props.onBlur?.(event)
        }}
        className={className}
      />
    </>
  )
}
