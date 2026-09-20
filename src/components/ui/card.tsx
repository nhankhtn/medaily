import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn('glass rounded-[var(--radius)]', className)}
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
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-2',
        className,
      )}
      {...props}
    >
      <h2 className="text-text-muted min-w-0 text-sm font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {action}
    </header>
  )
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />
}
