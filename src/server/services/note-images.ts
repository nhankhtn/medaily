import { folderFor, readCloudinaryConfig } from '@/lib/media/cloudinary'
import { findTextMatching, textColumnsByTable } from '@/server/repositories/text-scan'
import { destroyAsset, listAssets } from '@/server/services/media'
import { EXPORT_TABLES } from '@/server/services/export'

/**
 * How long an upload is left alone before it counts as unreferenced.
 *
 * A picture pasted into a note that has not been saved yet is exactly that —
 * on Cloudinary, named by nothing. The grace period is what keeps the sweep
 * from deleting the image out from under someone still writing.
 */
const GRACE_MS = 24 * 60 * 60 * 1000

export type SweepResult = { scanned: number; removed: number; freedBytes: number }

/**
 * Whether one stored picture has become rubbish.
 *
 * Both conditions matter and for different reasons: the reference check is
 * what makes a delete correct, the age check is what makes it safe while
 * somebody is still writing the note that will point at it.
 */
export function isOrphan(
  asset: { publicId: string; createdAt: Date },
  referenced: ReadonlySet<string>,
  now: number,
  graceMs: number = GRACE_MS,
): boolean {
  if (referenced.has(asset.publicId)) return false
  return now - asset.createdAt.getTime() >= graceMs
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Every note-image id this user's own text still points at.
 *
 * No user filter is needed: the folder path has the user's own id in it, so a
 * row anywhere that mentions it is theirs by construction.
 */
async function referencedIds(folder: string): Promise<Set<string>> {
  const pattern = `%${folder}/%`
  const finder = new RegExp(`${escapeRegExp(folder)}/([A-Za-z0-9_-]+)`, 'g')
  const columnsOf = await textColumnsByTable()
  const found = new Set<string>()

  /*
   * Which tables to read is policy and lives here; how to read them is SQL and
   * lives in the repository. `EXPORT_TABLES` is the list of what a person
   * owns, kept current because export depends on it — so a new table with an
   * editor on it is covered without this file being remembered.
   */
  for (const table of EXPORT_TABLES) {
    const blob = await findTextMatching(table, columnsOf.get(table) ?? [], pattern)
    if (!blob) continue
    for (const match of blob.matchAll(finder)) found.add(`${folder}/${match[1]}`)
  }

  return found
}

/**
 * Deletes note images nothing points at any more.
 *
 * This is the only thing that ever removes them. A picture is referenced only
 * by the Markdown that mentions it, so there is no row to hang a delete off:
 * abandoning an unsaved note, removing a picture from a saved one, and
 * deleting the note outright all leave the same orphan, and one comparison
 * covers all three.
 */
export async function sweepNoteImages(userId: string): Promise<SweepResult> {
  const config = readCloudinaryConfig()
  if (!config.configured) return { scanned: 0, removed: 0, freedBytes: 0 }

  const folder = folderFor(config.baseFolder, 'notes', userId, userId)
  const assets = await listAssets(`${folder}/`)
  if (assets.length === 0) return { scanned: 0, removed: 0, freedBytes: 0 }

  // Deliberately outside the try below: a reference scan that fails must stop
  // the sweep, never be read as "nothing points at any of these".
  const referenced = await referencedIds(folder)

  const now = Date.now()
  let removed = 0
  let freedBytes = 0

  for (const asset of assets) {
    if (!isOrphan(asset, referenced, now)) continue

    try {
      await destroyAsset(asset.publicId)
      removed += 1
      freedBytes += asset.bytes
    } catch (error) {
      console.error('[media] could not remove orphaned note image:', asset.publicId, error)
    }
  }

  return { scanned: assets.length, removed, freedBytes }
}
