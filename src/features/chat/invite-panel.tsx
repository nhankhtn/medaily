'use client'

import { Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PATHS } from '@/lib/paths'
import { createInvite } from '@/server/actions/chat'
import { inviteMember, searchInvitees } from '@/server/actions/room-invite'

type Person = {
  id: string
  displayName: string
  username: string | null
  email: string | null
}

/**
 * Making a way in.
 *
 * A name or an address finds a person who already has an account, and they
 * choose whether to sit down. The link is the other way: one use, two days,
 * handed over by whoever asked for it.
 */
export function InvitePanel({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [looking, setLooking] = useState(false)
  const [looked, setLooked] = useState(false)

  useEffect(() => {
    const needle = query.trim()
    if (needle.length < 2) {
      setPeople([])
      setLooked(false)
      return
    }
    let dropped = false
    const timer = setTimeout(() => {
      setLooking(true)
      void searchInvitees({ roomId, query: needle }).then((result) => {
        if (dropped) return
        setLooking(false)
        setLooked(true)
        setPeople(result.ok ? result.people : [])
      })
    }, 300)
    return () => {
      dropped = true
      clearTimeout(timer)
    }
  }, [query, roomId])

  const send = async (person: Person) => {
    setBusy(true)
    const result = await inviteMember({ roomId, userId: person.id })
    setBusy(false)
    if (result.ok) {
      toast.success(t('inviteSent'))
      setQuery('')
      setPeople([])
      setLooked(false)
      return
    }
    const key =
      result.error === 'already_invited'
        ? 'alreadyInvited'
        : result.error === 'already_member'
          ? 'alreadyMember'
          : result.error === 'rate_limited'
            ? 'tooFast'
            : 'sendFailed'
    toast.error(t(key))
  }

  /**
   * Puts the link on the clipboard, and says so only if it got there.
   *
   * Safari allows a clipboard write while the tap that asked for it is still
   * "active", and the invite has to be made on the server first — by the time
   * that round trip answers, the tap has expired and the write is refused. So
   * the write is started inside the tap and handed a promise of the text,
   * which is the one shape WebKit accepts; `writeText` is for the browsers
   * that have no `ClipboardItem` and do not mind the wait.
   */
  const copyLink = async (link: Promise<string>): Promise<boolean> => {
    try {
      if (typeof ClipboardItem === 'function') {
        const text = link.then((value) => new Blob([value], { type: 'text/plain' }))
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
      } else {
        await navigator.clipboard.writeText(await link)
      }
      return true
    } catch (error) {
      console.error('[chat] could not reach the clipboard:', error)
      return false
    }
  }

  const make = async () => {
    setBusy(true)
    const made = createInvite({ roomId })

    const copied = copyLink(
      made.then((result) =>
        result.ok ? `${window.location.origin}${PATHS.chatJoin(result.code)}` : '',
      ),
    )

    const result = await made
    setBusy(false)

    if (!result.ok) {
      toast.error(t(result.error === 'rate_limited' ? 'tooFast' : 'sendFailed'))
      return
    }

    const link = `${window.location.origin}${PATHS.chatJoin(result.code)}`
    if (await copied) toast.success(t('linkCopied'), { description: link })
    else toast.warning(t('copyBlocked'), { description: link, duration: 20000 })
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">{t('findMember')}</span>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          autoFocus
          maxLength={200}
        />
      </label>

      {looking ? <p className="text-text-subtle text-sm">{t('searching')}</p> : null}
      {looked && !looking && people.length === 0 ? (
        <p className="text-text-subtle text-sm">{t('noMatch')}</p>
      ) : null}

      {people.length > 0 ? (
        <ul className="divide-border-base divide-y">
          {people.map((person) => (
            <li key={person.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{person.displayName}</p>
                <p className="text-text-subtle truncate text-xs">
                  {person.username ? `@${person.username}` : null}
                  {person.username && person.email ? ' · ' : null}
                  {person.email}
                </p>
              </div>
              <Button size="sm" disabled={busy} onClick={() => void send(person)}>
                {t('inviteThem')}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button variant="outline" size="sm" disabled={busy} onClick={() => void make()}>
        <Link2 className="size-4" />
        {t('inviteLink')}
      </Button>
    </div>
  )
}
