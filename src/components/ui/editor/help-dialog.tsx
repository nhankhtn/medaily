'use client'

import { CircleQuestionMark } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

/**
 * What the editor can do, from inside the editor.
 *
 * None of it is guessable. Nothing on screen says that a slash opens a menu,
 * and the question people actually arrive with — "how do I make a table" —
 * has an answer no amount of staring at the box reveals.
 *
 * It describes this editor rather than Markdown. What is typed here is stored
 * as Markdown, but a table is made from the slash menu and never by drawing
 * pipes, so a page of Markdown syntax would be a page of things that mostly
 * do not work.
 */

/**
 * Shorthands that turn into something as you type them. The left side is
 * keystrokes, not prose, so it stays here rather than in `messages` — and the
 * right side is the block it becomes, which the slash menu already names.
 */
const TYPING_RULES = [
  { typed: '# ', becomes: 'h1' },
  { typed: '## ', becomes: 'h2' },
  { typed: '- ', becomes: 'bullet' },
  { typed: '1. ', becomes: 'ordered' },
  { typed: '[] ', becomes: 'task' },
  { typed: '> ', becomes: 'quote' },
  { typed: '```', becomes: 'code' },
] as const

export function EditorHelpDialog() {
  const t = useTranslations('editor')

  const sections = [
    { title: t('help.slashTitle'), body: t('help.slashBody') },
    { title: t('help.tableTitle'), body: t('help.tableBody') },
    { title: t('help.formatTitle'), body: t('help.formatBody') },
    { title: t('help.imageTitle'), body: t('help.imageBody') },
    { title: t('help.moveTitle'), body: t('help.moveBody') },
  ]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          /*
           * `-` on mousedown: the editor takes focus back on click anyway, and
           * without this the selection is dropped first, which closes the
           * bubble toolbar the panel is partly there to explain.
           */
          onMouseDown={(event) => event.preventDefault()}
          aria-label={t('help.open')}
          title={t('help.open')}
          className="text-text-subtle hover:text-text hover:bg-inset-hover absolute top-1.5 right-1.5 z-10 flex size-6 items-center justify-center rounded-full"
        >
          <CircleQuestionMark className="size-4" />
        </button>
      </DialogTrigger>

      <DialogContent title={t('help.title')} description={t('help.intro')}>
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <p className="text-text-muted mt-1 text-sm leading-relaxed">{section.body}</p>
            </section>
          ))}

          <section>
            <h3 className="text-sm font-semibold">{t('help.rulesTitle')}</h3>
            <ul className="divide-border-base mt-1 divide-y">
              {TYPING_RULES.map((rule) => (
                <li key={rule.typed} className="flex items-center gap-3 py-1.5">
                  <code className="bg-surface-2 shrink-0 rounded px-1.5 py-0.5 text-xs">
                    {rule.typed}
                  </code>
                  <span className="text-text-muted min-w-0 flex-1 truncate text-sm">
                    {t(rule.becomes)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
