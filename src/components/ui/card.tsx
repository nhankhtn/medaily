import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-[var(--radius)] border border-border-base bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  action,
  className,
  ...props
}: React.ComponentProps<'header'> & { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header
      className={cn('flex items-center justify-between gap-3 px-4 pt-4 pb-2', className)}
      {...props}
    >
      <h2 className="text-sm font-semibold tracking-wide text-text-muted uppercase">{title}</h2>
      {action}
    </header>
  )
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />
}
