import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { toast } from 'sonner'
import { deliveryUrl } from '@/lib/media/image-url'
import { requestNoteImageUpload } from '@/server/actions/media'
import type { UploadTicket } from '@/server/services/media'

const MAX_BYTES = 15 * 1024 * 1024

export type ImageWording = { tooLarge: string; failed: string }

type Action = { add: { id: object; pos: number } } | { remove: { id: object } }

const key = new PluginKey<DecorationSet>('imageUpload')

/**
 * A box holding the image's place while the file goes up.
 *
 * It is a decoration and not a node, so the document never holds a
 * half-finished image: an upload that fails leaves nothing behind, and a save
 * that fires mid-upload cannot write a temporary URL into the Markdown.
 * Mapping it through every transaction is also what lets someone keep typing
 * while a photo uploads — the image still lands where it was dropped.
 */
function placeholders() {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const mapped = set.map(tr.mapping, tr.doc)
        const action = tr.getMeta(key) as Action | undefined
        if (!action) return mapped

        if ('add' in action) {
          const element = document.createElement('div')
          element.className = 'md-image-uploading'
          return mapped.add(tr.doc, [
            Decoration.widget(action.add.pos, element, { id: action.add.id }),
          ])
        }
        return mapped.remove(
          mapped.find(undefined, undefined, (spec) => spec.id === action.remove.id),
        )
      },
    },
    props: { decorations: (state) => key.getState(state) },
  })
}

function placeholderAt(state: EditorState, id: object): number | null {
  const [found] = key.getState(state)?.find(undefined, undefined, (spec) => spec.id === id) ?? []
  return found ? found.from : null
}

async function send(file: File, ticket: UploadTicket): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', ticket.apiKey)
  form.append('timestamp', String(ticket.timestamp))
  form.append('folder', ticket.folder)
  form.append('signature', ticket.signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) throw new Error(`upload failed: ${response.status}`)

  const asset = (await response.json()) as { public_id: string }
  return deliveryUrl(ticket.cloudName, asset.public_id, 'full')
}

async function uploadImages(editor: Editor, files: File[], at: number, say: ImageWording) {
  const images = files.filter((file) => file.type.startsWith('image/'))
  if (images.length === 0) return
  if (images.some((file) => file.size > MAX_BYTES)) {
    toast.error(say.tooLarge)
    return
  }

  // One signature covers the whole paste; Cloudinary honours it for an hour.
  const ticket = await requestNoteImageUpload()
  if (!ticket.ok) {
    toast.error(say.failed)
    return
  }

  for (const file of images) {
    const id = {}
    editor.view.dispatch(editor.view.state.tr.setMeta(key, { add: { id, pos: at } }))

    try {
      const src = await send(file, ticket.ticket)
      const pos = placeholderAt(editor.view.state, id)
      editor.view.dispatch(editor.view.state.tr.setMeta(key, { remove: { id } }))
      if (pos !== null) {
        editor.commands.insertContentAt(pos, { type: 'image', attrs: { src, alt: file.name } })
      }
    } catch (error) {
      console.error('[editor] image upload failed:', error)
      editor.view.dispatch(editor.view.state.tr.setMeta(key, { remove: { id } }))
      toast.error(say.failed)
    }
  }
}

const imagesIn = (list: FileList | undefined | null) =>
  [...(list ?? [])].filter((file) => file.type.startsWith('image/'))

/** Paste or drop a picture and it uploads, rather than being quietly dropped. */
export function createImageUpload(say: () => ImageWording) {
  return Extension.create({
    name: 'imageUpload',
    addProseMirrorPlugins() {
      const editor = this.editor
      return [
        placeholders(),
        new Plugin({
          props: {
            handlePaste(view, event) {
              const files = imagesIn(event.clipboardData?.files)
              if (files.length === 0) return false
              event.preventDefault()
              void uploadImages(editor, files, view.state.selection.from, say())
              return true
            },
            handleDrop(view, event, _slice, moved) {
              if (moved) return false
              const files = imagesIn(event.dataTransfer?.files)
              if (files.length === 0) return false
              event.preventDefault()
              const at =
                view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
                view.state.selection.from
              void uploadImages(editor, files, at, say())
              return true
            },
          },
        }),
      ]
    },
  })
}
