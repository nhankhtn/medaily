import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { toast } from 'sonner'
import { deliveryUrl } from '@/lib/media/image-url'
import { shrinkImage } from '@/lib/media/shrink-image'
import { requestNoteImageUpload } from '@/server/actions/media'
import type { UploadTicket } from '@/server/services/media'

const MAX_BYTES = 15 * 1024 * 1024

export type ImageWording = { tooLarge: string; failed: string; uploading: string }

type Action =
  | { add: { id: object; pos: number; element: HTMLElement } }
  | { remove: { id: object } }

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
          return mapped.add(tr.doc, [
            Decoration.widget(action.add.pos, action.add.element, { id: action.add.id }),
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

function placeholderElement(label: string) {
  const element = document.createElement('div')
  element.className = 'md-image-uploading'
  const text = document.createElement('span')
  text.className = 'md-image-uploading-label'
  text.textContent = label
  element.append(text)
  return { element, say: (next: string) => void (text.textContent = next) }
}

/**
 * `XMLHttpRequest` rather than `fetch`: only it reports how much of the body
 * has gone out, and a picture that sits there for ten seconds with no number
 * on it is indistinguishable from one that is stuck.
 */
function send(
  file: File,
  ticket: UploadTicket,
  onProgress: (percent: number) => void,
): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', ticket.apiKey)
  form.append('timestamp', String(ticket.timestamp))
  form.append('folder', ticket.folder)
  form.append('signature', ticket.signature)

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `https://api.cloudinary.com/v1_1/${ticket.cloudName}/image/upload`)

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('error', () => reject(new Error('upload failed: network')))
    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`upload failed: ${request.status}`))
        return
      }
      try {
        const asset = JSON.parse(request.responseText) as { public_id: string }
        resolve(deliveryUrl(ticket.cloudName, asset.public_id, 'full'))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('upload failed: bad response'))
      }
    })
    request.send(form)
  })
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
    const { element, say: label } = placeholderElement(say.uploading)
    editor.view.dispatch(editor.view.state.tr.setMeta(key, { add: { id, pos: at, element } }))

    try {
      // Shrunk first: the delivery URL caps every note image at 2000px, so the
      // megapixels past that are carried up the slowest link in the chain and
      // then discarded. The label goes up before it, because re-encoding a
      // twelve-megapixel photo is itself a visible pause.
      const smaller = await shrinkImage(file)
      const src = await send(smaller, ticket.ticket, (percent) => label(`${percent}%`))

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
