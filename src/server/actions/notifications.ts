'use server'

import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import {
  markAllNotificationsRead,
  markNotificationsRead,
} from '@/server/repositories/notifications'
import { readInbox, type InboxItem } from '@/server/services/inbox'

export async function loadInbox(): Promise<{ items: InboxItem[]; unread: number }> {
  return readInbox(await getCurrentUserId())
}

export async function markNotificationRead(id: string): Promise<void> {
  const parsed = z.uuid().parse(id)
  await markNotificationsRead(await getCurrentUserId(), [parsed])
}

export async function markEveryNotificationRead(): Promise<void> {
  await markAllNotificationsRead(await getCurrentUserId())
}
