'use client'

import {
  Image as ImageIcon,
  Lock,
  LockOpen,
  LogOut,
  Pencil,
  Settings,
  Trash2,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Speaker } from '@/lib/chat/types'
import { PATHS } from '@/lib/paths'
import { deleteRoom, leaveRoom, removeMember, renameRoom } from '@/server/actions/chat'
import { InvitePanel } from './invite-panel'
import { RoomAvatarPicker } from './room-avatar'
import type { RoomEncryption } from '@/lib/chat/types'

type Panel = 'none' | 'invite' | 'rename' | 'members' | 'photo'

/**
 * What can be done to the room, rather than said in it — behind a gear beside
 * the title.
 *
 * Two layers, and the split is between choosing and doing. The popover is a
 * short menu: nothing in it is a question, so nothing in it earns a dimmed
 * page. The things that *are* questions — a name to type, an address to
 * invite, a list to take someone off — open a dialog with room to ask.
 *
 * Leaving and deleting go straight from the menu through `confirm`, because
 * the question they ask is the same one either way and has one word in it.
 */
export function RoomSettings({
  roomId,
  encryption,
  owner,
  title,
  avatarUrl,
  members,
  me,
}: {
  roomId: string
  encryption: RoomEncryption
  owner: boolean
  title: string | null
  avatarUrl: string | null
  members: Speaker[]
  me: string
}) {
  const t = useTranslations('chat')
  const tc = useTranslations('common')
  const router = useRouter()
  const [menu, setMenu] = useState(false)
  const [panel, setPanel] = useState<Panel>('none')
  const [name, setName] = useState(title ?? '')
  const [busy, setBusy] = useState(false)

  const open = (next: Panel) => {
    setMenu(false)
    setPanel(next)
  }

  const leave = async () => {
    if (!window.confirm(t('leaveConfirm'))) return
    if ((await leaveRoom(roomId)).ok) router.push(PATHS.chat)
  }

  const remove = async () => {
    if (!window.confirm(t('deleteConfirm'))) return
    const result = await deleteRoom(roomId)
    if (result.ok) router.push(PATHS.chat)
    else toast.error(tc('error'))
  }

  const rename = async () => {
    if (name.trim() === '' || busy) return
    setBusy(true)
    const result = await renameRoom({ roomId, title: name.trim() })
    setBusy(false)
    if (!result.ok) {
      toast.error(tc('error'))
      return
    }
    setPanel('none')
    router.refresh()
  }

  const kick = async (userId: string, who: string) => {
    if (!window.confirm(t('removeConfirm', { name: who }))) return
    const result = await removeMember({ roomId, userId })
    if (result.ok) router.refresh()
    else toast.error(tc('error'))
  }

  const item = 'w-full justify-start'

  return (
    <>
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="iconSm"
            title={t('roomSettings')}
            aria-label={t('roomSettings')}
          >
            <Settings className="size-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent aria-label={t('roomSettings')} className="w-56 p-1.5">
          <div className="flex flex-col">
            {/* A fact, not a control: it was settled when the room was made. */}
            {encryption === 'legacy' ? null : (
              <p className="text-text-subtle border-border-base mb-1 flex items-center gap-2 border-b px-2.5 pt-1 pb-2 text-xs">
                {encryption === 'locked' ? (
                  <Lock className="size-3.5" />
                ) : (
                  <LockOpen className="size-3.5" />
                )}
                {t(encryption === 'locked' ? 'roomLocked' : 'roomPlain')}
              </p>
            )}
            {owner ? (
              <>
                <Button variant="ghost" size="sm" className={item} onClick={() => open('invite')}>
                  <UserPlus className="size-4" />
                  {t('addMember')}
                </Button>
                <Button variant="ghost" size="sm" className={item} onClick={() => open('rename')}>
                  <Pencil className="size-4" />
                  {t('renameRoom')}
                </Button>
                <Button variant="ghost" size="sm" className={item} onClick={() => open('photo')}>
                  <ImageIcon className="size-4" />
                  {t('roomPhoto')}
                </Button>
                <Button variant="ghost" size="sm" className={item} onClick={() => open('members')}>
                  <UserMinus className="size-4" />
                  {t('manageMembers')}
                </Button>
              </>
            ) : null}

            <Button
              variant="ghost"
              size="sm"
              className={item}
              onClick={() => {
                setMenu(false)
                void leave()
              }}
            >
              <LogOut className="size-4" />
              {t('leave')}
            </Button>

            {/* Last, and the only one that takes the room from everybody. */}
            {owner ? (
              <Button
                variant="ghost"
                size="sm"
                className={`${item} text-bad hover:text-bad`}
                onClick={() => {
                  setMenu(false)
                  void remove()
                }}
              >
                <Trash2 className="size-4" />
                {t('deleteRoom')}
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={panel === 'invite'} onOpenChange={(next) => setPanel(next ? 'invite' : 'none')}>
        <DialogContent title={t('addMember')}>
          <InvitePanel roomId={roomId} />
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'photo'} onOpenChange={(next) => setPanel(next ? 'photo' : 'none')}>
        <DialogContent title={t('roomPhoto')}>
          <RoomAvatarPicker roomId={roomId} title={title ?? t('untitled')} avatarUrl={avatarUrl} />
        </DialogContent>
      </Dialog>

      <Dialog open={panel === 'rename'} onOpenChange={(next) => setPanel(next ? 'rename' : 'none')}>
        <DialogContent title={t('renameRoom')}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void rename()
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t('roomName')}</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoFocus
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setPanel('none')}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={busy || name.trim() === ''}>
                {tc('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={panel === 'members'}
        onOpenChange={(next) => setPanel(next ? 'members' : 'none')}
      >
        <DialogContent title={t('manageMembers')}>
          <ul className="divide-border-base divide-y">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-2">
                <Avatar name={member.name} src={member.imageUrl} className="size-7" />
                <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                {/* Not yourself: leaving is the door marked for that. */}
                {member.id === me ? null : (
                  <Button
                    variant="ghost"
                    size="iconSm"
                    aria-label={t('removeMember')}
                    onClick={() => void kick(member.id, member.name)}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
