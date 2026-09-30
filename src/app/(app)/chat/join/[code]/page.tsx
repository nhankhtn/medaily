import { notFound, redirect } from 'next/navigation'
import { chatEnabled } from '@/lib/chat/provider'
import { PATHS } from '@/lib/paths'

/**
 * Where an invite link lands, and it does not stay there.
 *
 * It used to be a page of its own holding one button. That meant somebody
 * arriving from a chat app saw a screen with no rooms, no back, and nothing
 * but "join" — an invitation that could not say what it was to. The list is
 * the place to answer that, so the code is handed to it and the question is
 * asked in a dialog over the rooms the person already has.
 *
 * Still a redirect rather than an accept: a link pasted into a chat app is
 * fetched by its preview bot before a person ever clicks it, and an invite
 * spent on that GET would be gone by the time they did.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  if (!chatEnabled()) notFound()

  const { code } = await params
  redirect(PATHS.chatWithInvite(code))
}
