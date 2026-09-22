'use client'

import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Table as TableIcon,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { cn } from '@/lib/utils'

/** One entry of the `/` menu: what it says, what it matches, what it does. */
export type BlockCommand = {
  id: string
  label: string
  hint: string
  /** Extra words that should find this entry, on top of its label. */
  keywords: string
  icon: LucideIcon
  run: (editor: Editor, range: Range) => void
}

/**
 * The blocks `/` can insert, named in the reader's language.
 *
 * `t` is handed in rather than read here: the menu is rendered outside the
 * React tree that holds the locale, so the strings have to arrive already
 * translated from the component that owns the editor.
 */
export function blockCommands(t: (key: string) => string): BlockCommand[] {
  const at = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

  return [
    {
      id: 'text',
      label: t('text'),
      hint: t('textHint'),
      keywords: 'paragraph plain van ban doan',
      icon: Type,
      run: (editor, range) => at(editor, range).setNode('paragraph').run(),
    },
    {
      id: 'h1',
      label: t('h1'),
      hint: t('h1Hint'),
      keywords: 'heading title tieu de lon #',
      icon: Heading1,
      run: (editor, range) => at(editor, range).setNode('heading', { level: 1 }).run(),
    },
    {
      id: 'h2',
      label: t('h2'),
      hint: t('h2Hint'),
      keywords: 'heading subtitle tieu de vua ##',
      icon: Heading2,
      run: (editor, range) => at(editor, range).setNode('heading', { level: 2 }).run(),
    },
    {
      id: 'h3',
      label: t('h3'),
      hint: t('h3Hint'),
      keywords: 'heading tieu de nho ###',
      icon: Heading3,
      run: (editor, range) => at(editor, range).setNode('heading', { level: 3 }).run(),
    },
    {
      id: 'bullet',
      label: t('bullet'),
      hint: t('bulletHint'),
      keywords: 'unordered list dau dong gach dau -',
      icon: List,
      run: (editor, range) => at(editor, range).toggleBulletList().run(),
    },
    {
      id: 'ordered',
      label: t('ordered'),
      hint: t('orderedHint'),
      keywords: 'numbered list danh sach so 1.',
      icon: ListOrdered,
      run: (editor, range) => at(editor, range).toggleOrderedList().run(),
    },
    {
      id: 'task',
      label: t('task'),
      hint: t('taskHint'),
      keywords: 'todo checkbox check viec can lam',
      icon: ListTodo,
      run: (editor, range) => at(editor, range).toggleTaskList().run(),
    },
    {
      id: 'quote',
      label: t('quote'),
      hint: t('quoteHint'),
      keywords: 'blockquote trich dan >',
      icon: Quote,
      run: (editor, range) => at(editor, range).toggleBlockquote().run(),
    },
    {
      id: 'code',
      label: t('code'),
      hint: t('codeHint'),
      keywords: 'codeblock snippet ma nguon ```',
      icon: Code,
      run: (editor, range) => at(editor, range).toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      label: t('divider'),
      hint: t('dividerHint'),
      keywords: 'horizontal rule line duong ke ---',
      icon: Minus,
      run: (editor, range) => at(editor, range).setHorizontalRule().run(),
    },
    {
      id: 'table',
      label: t('table'),
      hint: t('tableHint'),
      keywords: 'grid bang',
      icon: TableIcon,
      run: (editor, range) =>
        at(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
  ]
}

/** Case- and accent-insensitive, so `/tieu` finds `Tiêu đề`. */
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}

export function filterCommands(commands: BlockCommand[], query: string): BlockCommand[] {
  const needle = fold(query.trim())
  if (needle === '') return commands
  return commands.filter((command) =>
    fold(`${command.label} ${command.keywords} ${command.id}`).includes(needle),
  )
}

type MenuHandle = { onKeyDown: (event: KeyboardEvent) => boolean }

type MenuProps = {
  items: BlockCommand[]
  command: (item: BlockCommand) => void
  empty: string
}

const SlashMenu = forwardRef<MenuHandle, MenuProps>(function SlashMenu(
  { items, command, empty },
  ref,
) {
  const [active, setActive] = useState(0)

  // A narrowed list can be shorter than where the cursor was.
  useEffect(() => setActive(0), [items])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false

      if (event.key === 'ArrowUp') {
        setActive((index) => (index + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setActive((index) => (index + 1) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  return (
    <div className="glass-chip z-50 max-h-72 w-64 overflow-y-auto rounded-[var(--radius)] p-1 shadow-lg">
      {items.length === 0 ? (
        <p className="text-text-subtle px-2 py-3 text-sm">{empty}</p>
      ) : (
        items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            // The editor keeps focus, so the menu never steals the caret.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => command(item)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-0.35rem)] px-2 py-1.5 text-left',
              index === active ? 'bg-accent-soft text-text' : 'text-text-muted',
            )}
          >
            <span className="glass-inset text-text flex size-7 shrink-0 items-center justify-center rounded-md">
              <item.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="text-text block truncate text-sm">{item.label}</span>
              <span className="text-text-subtle block truncate text-xs">{item.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  )
})

/**
 * `/` opens a block picker, the way Notion's does.
 *
 * `commands` and `empty` are read through functions rather than captured:
 * the extension is built once with the editor, and the strings it shows have
 * to follow the locale without the editor being torn down and rebuilt — which
 * would lose the document and the caret.
 */
export function createSlashCommand({
  commands,
  empty,
}: {
  commands: () => BlockCommand[]
  empty: () => string
}) {
  return Extension.create({
    name: 'slashCommand',

    addProseMirrorPlugins() {
      const suggestion: Omit<SuggestionOptions<BlockCommand, BlockCommand>, 'editor'> = {
        char: '/',
        // Inside a code block a slash is a slash.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterCommands(commands(), query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let component: ReactRenderer<MenuHandle, MenuProps> | null = null
          let unmount: (() => void) | undefined

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: { items: props.items, command: props.command, empty: empty() },
              })
              unmount = props.mount(component.element)
            },
            onUpdate: (props) => {
              component?.updateProps({ items: props.items, command: props.command, empty: empty() })
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                unmount?.()
                unmount = undefined
                return true
              }
              return component?.ref?.onKeyDown(props.event) ?? false
            },
            onExit: () => {
              unmount?.()
              unmount = undefined
              component?.destroy()
              component = null
            },
          }
        },
      }

      return [Suggestion({ editor: this.editor, ...suggestion })]
    },
  })
}
