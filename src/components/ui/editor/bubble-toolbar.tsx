'use client'

import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Bold, Check, Code, Italic, Link2, Link2Off, Strikethrough, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The bar that rises over a selection, as Notion's does.
 *
 * Asking for a link swaps the bar's contents for a field rather than opening a
 * dialog: the selection stays put, and the bar is already where the eye is.
 */
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const t = useTranslations('editor')
  // The bar has to redraw when the selection moves; an editor does not
  // re-render React on its own.
  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      strike: current.isActive('strike'),
      code: current.isActive('code'),
      link: current.isActive('link'),
    }),
  })
  const [linking, setLinking] = useState(false)
  const [href, setHref] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (linking) input.current?.focus()
  }, [linking])

  const applyLink = () => {
    const url = href.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (url === '') chain.unsetLink().run()
    else chain.setLink({ href: /^\w+:/.test(url) ? url : `https://${url}` }).run()
    setLinking(false)
    setHref('')
  }

  return (
    <BubbleMenu
      editor={editor}
      // A selection inside a code block is code; there is nothing to embolden.
      shouldShow={({ editor: active, from, to }) =>
        from !== to && !active.isActive('codeBlock') && !active.isActive('horizontalRule')
      }
      options={{ placement: 'top', offset: 8 }}
      className="glass-chip flex items-center gap-0.5 rounded-full p-1 shadow-lg"
      onKeyDown={(event) => {
        if (!linking) return
        if (event.key === 'Enter') {
          event.preventDefault()
          applyLink()
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setLinking(false)
          editor.commands.focus()
        }
      }}
    >
      {linking ? (
        <>
          <input
            ref={input}
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder={t('linkPlaceholder')}
            className="text-text placeholder:text-text-subtle w-44 bg-transparent px-2.5 py-1 text-base outline-none sm:w-56 sm:text-sm"
          />
          <ToolButton label={t('linkApply')} onClick={applyLink}>
            <Check className="size-4" />
          </ToolButton>
          <ToolButton
            label={t('linkCancel')}
            onClick={() => {
              setLinking(false)
              editor.commands.focus()
            }}
          >
            <X className="size-4" />
          </ToolButton>
        </>
      ) : (
        <>
          <ToolButton
            label={t('bold')}
            active={marks.bold}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolButton>
          <ToolButton
            label={t('italic')}
            active={marks.italic}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </ToolButton>
          <ToolButton
            label={t('strike')}
            active={marks.strike}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="size-4" />
          </ToolButton>
          <ToolButton
            label={t('inlineCode')}
            active={marks.code}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="size-4" />
          </ToolButton>
          <span className="bg-border-strong mx-0.5 h-4 w-px" aria-hidden />
          {marks.link ? (
            <ToolButton
              label={t('linkRemove')}
              onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
            >
              <Link2Off className="size-4" />
            </ToolButton>
          ) : (
            <ToolButton
              label={t('link')}
              onClick={() => {
                setHref(editor.getAttributes('link').href ?? '')
                setLinking(true)
              }}
            >
              <Link2 className="size-4" />
            </ToolButton>
          )}
        </>
      )}
    </BubbleMenu>
  )
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Without this the selection collapses before the command can read it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-full transition-colors',
        active ? 'bg-accent-soft text-accent-text' : 'text-text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
