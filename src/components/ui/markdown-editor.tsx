'use client'

import { Extension } from '@tiptap/core'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { GripVertical, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef } from 'react'
import { Markdown } from 'tiptap-markdown'
import { BubbleToolbar } from '@/components/ui/editor/bubble-toolbar'
import { createImageUpload } from '@/components/ui/editor/image-upload'
import {
  blockCommands,
  createSlashCommand,
  type BlockCommand,
} from '@/components/ui/editor/slash-command'
import { cn } from '@/lib/utils'

/** What the editor shows in words, read at call time so a locale can change. */
type Wording = {
  commands: BlockCommand[]
  empty: string
  slash: string
  heading: string
  field: string | undefined
  imageTooLarge: string
  imageFailed: string
  imageUploading: string
}

/**
 * A box the editor reads its wording out of, written to from an effect.
 *
 * Not a ref and not state: the extensions are built once with the editor and
 * keep whatever they closed over, so a locale or placeholder that changes
 * later has to arrive through something they can read again — and rebuilding
 * them instead would throw away the document and the caret.
 */
function wordingBox(initial: Wording) {
  let held = initial
  return { read: () => held, write: (next: Wording) => void (held = next) }
}

/**
 * Built outside the component on purpose: these closures read the wording when
 * the reader opens the `/` menu or lands on an empty line, never while React
 * is rendering.
 */
function buildExtensions(wording: ReturnType<typeof wordingBox>) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Markdown has no underline, and a `<u>` in the stored text would not
      // survive the round trip through the reader.
      underline: false,
      codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
      link: { openOnClick: false, autolink: true },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // `allowBase64: false`: a pasted picture goes to Cloudinary and the
    // Markdown keeps a URL. Inlining the bytes would put a few megabytes of
    // base64 into a text column that every read of the note drags along.
    Image.configure({ allowBase64: false }),
    TightTaskList,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      showOnlyCurrent: false,
      placeholder: ({ editor, node, hasAnchor }) => {
        const say = wording.read()
        if (editor.isEmpty) return say.field || say.slash
        if (!hasAnchor) return ''
        return node.type.name === 'heading' ? say.heading : say.slash
      },
    }),
    // `html: false` keeps the editor to the same subset the reader renders —
    // raw HTML shows as text there, so it must not become live nodes here.
    Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
    createSlashCommand({
      commands: () => wording.read().commands,
      empty: () => wording.read().empty,
    }),
    createImageUpload(() => {
      const say = wording.read()
      return {
        tooLarge: say.imageTooLarge,
        failed: say.imageFailed,
        uploading: say.imageUploading,
      }
    }),
  ]
}

/**
 * A to-do list written back as a *tight* list, without a blank line between
 * items.
 *
 * tiptap-markdown marks its bullet and ordered lists tight but not its task
 * lists, and prosemirror-markdown then spaces every item out. Nothing renders
 * differently for it, but a note saved untouched would come back rewritten,
 * which makes every diff of a note unreadable.
 */
const TightTaskList = Extension.create({
  name: 'tightTaskList',
  addGlobalAttributes() {
    return [
      {
        types: ['taskList'],
        attributes: {
          tight: { default: true, parseHTML: () => true, renderHTML: () => ({}) },
        },
      },
    ]
  },
})

/** tiptap-markdown hangs its serializer off the editor without typing it. */
type MarkdownStorage = { getMarkdown: () => string }

function markdownOf(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown()
}

/**
 * A block editor in the shape people already know from Notion, storing plain
 * Markdown.
 *
 * What is on screen is the finished block, never its source: typing `# ` turns
 * the line into a heading and the `# ` is gone, `**bold**` closes into bold
 * text. `/` opens a block picker, a selection raises a formatting bar, and
 * hovering a block brings out a grip to drag it and a `+` to add one under it.
 *
 * The value in and out is still Markdown, so nothing else in the app has to
 * know: the document is parsed from Markdown on the way in and serialised back
 * on every edit. A value echoed straight back by the parent is ignored rather
 * than re-parsed — reparsing would rebuild the document under the caret.
 *
 * Typing Vietnamese is ProseMirror's own concern here, and it handles
 * composition natively; the one thing that would break Telex is replacing the
 * document mid-word, which the echo guard above prevents.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  label,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  disabled?: boolean
  className?: string
}) {
  const t = useTranslations('editor')

  /** What we last handed up, so a value echoed back is not a reason to redraw. */
  const emitted = useRef<string | null>(null)
  const [wording, extensions] = useMemo(() => {
    const box = wordingBox({
      commands: blockCommands(t),
      empty: t('noBlock'),
      slash: t('slashHint'),
      heading: t('headingHint'),
      field: placeholder,
      imageTooLarge: t('imageTooLarge'),
      imageFailed: t('imageFailed'),
      imageUploading: t('imageUploading'),
    })
    return [box, buildExtensions(box)] as const
    // Seeded once; every later change arrives through `write` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    wording.write({
      commands: blockCommands(t),
      empty: t('noBlock'),
      slash: t('slashHint'),
      heading: t('headingHint'),
      field: placeholder,
      imageTooLarge: t('imageTooLarge'),
      imageFailed: t('imageFailed'),
      imageUploading: t('imageUploading'),
    })
  }, [wording, t, placeholder])

  /** The block under the pointer, for the `+` to insert after. */
  const hovered = useRef<{ node: ProseMirrorNode | null; pos: number }>({ node: null, pos: 0 })

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: 'md-content',
      },
    },
    onCreate: () => {
      // The value as handed in, not as the editor would write it back.
      // Parsing normalises — a four-space list indent comes back as two — and
      // recording the normalised form here would make the sync effect below
      // see a difference and re-parse the document it had just built.
      emitted.current = value
    },
    onUpdate: ({ editor: changed }) => {
      const next = markdownOf(changed)
      emitted.current = next
      onChange(next)
    },
  })

  // Follow the value when it changes from elsewhere — a restored draft, a day
  // copied from yesterday, a dialog reopened on another note.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled)
  }, [editor, disabled])

  const addBelow = () => {
    if (!editor) return
    const { node, pos } = hovered.current
    if (!node) return
    const after = pos + node.nodeSize
    editor
      .chain()
      .focus()
      .insertContentAt(after, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
      .run()
  }

  return (
    <div
      className={cn(
        'glass-inset text-text border-border-strong relative w-full rounded-[var(--radius)] px-3 py-2',
        'focus-within:border-accent focus-within:inset-ring-accent focus-within:inset-ring-1',
        disabled && 'text-text-muted bg-surface-2',
        'md-editor',
        className,
      )}
    >
      <EditorContent editor={editor} />
      {editor && !disabled ? (
        <>
          <BubbleToolbar editor={editor} />
          <DragHandle
            editor={editor}
            nested
            onNodeChange={({ node, pos }) => {
              hovered.current = { node, pos }
            }}
            className="md-handle flex items-center gap-0.5 pr-1"
          >
            <button
              type="button"
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={addBelow}
              aria-label={t('addBlock')}
              title={t('addBlock')}
              className="text-text-subtle hover:text-text hover:bg-inset-hover flex size-5 items-center justify-center rounded"
            >
              <Plus className="size-4" />
            </button>
            <span
              aria-hidden
              title={t('dragBlock')}
              className="text-text-subtle hover:text-text hover:bg-inset-hover flex size-5 cursor-grab items-center justify-center rounded active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </span>
          </DragHandle>
        </>
      ) : null}
    </div>
  )
}
