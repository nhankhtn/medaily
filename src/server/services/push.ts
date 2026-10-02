import { log } from '@/lib/log'
import { deletePushDevice, listPushDevices } from '@/server/repositories/push'
import { accessToken, readServiceAccount, SCOPES } from './google-auth'

/**
 * FCM HTTP v1. **Data-only, never `notification`** — so `sw.js` draws it and
 * stays free of the Firebase SDK. The price is that every push must end in a
 * visible notification or the browser revokes the permission.
 * See docs/reference/realtime/push-notifications.md.
 */

const FCM = 'https://fcm.googleapis.com/v1/projects'

/** Short: the app fetches the rest when opened. */
export type PushPayload = {
  title: string
  body: string
  /** Where tapping it should land. */
  url: string
  /** Shared tags replace rather than stack: one room, one line. */
  tag: string
  /**
   * The picture drawn beside it, where the conversation has a face of its own.
   * Absent falls back to the app's icon in the worker — which is what every
   * notification used to show, and what makes three rooms look like one app
   * talking rather than three conversations.
   */
  icon?: string
}

export type PushResult = { sent: number; dropped: number; failed: number }

const NOTHING: PushResult = { sent: 0, dropped: 0, failed: 0 }

/** Never throws: a saved message that did not buzz a phone is not a failure. */
export async function notify(userIds: string[], payload: PushPayload): Promise<PushResult> {
  const account = readServiceAccount()
  if (!account || userIds.length === 0) return NOTHING

  try {
    const devices = await listPushDevices({ userIds })
    if (devices.length === 0) return NOTHING

    const token = await accessToken(account, SCOPES.messaging)
    const result = { ...NOTHING }

    // One request per device — FCM's batch endpoint is gone.
    await Promise.all(
      devices.map(async (device) => {
        const outcome = await send(account.projectId, token, device.token, payload)
        if (outcome === 'sent') result.sent += 1
        else if (outcome === 'dropped') result.dropped += 1
        else result.failed += 1
      }),
    )

    return result
  } catch (error) {
    await log.error('push', 'could not notify', error)
    return { ...NOTHING, failed: 1 }
  }
}

async function send(
  projectId: string,
  bearer: string,
  deviceToken: string,
  payload: PushPayload,
): Promise<'sent' | 'dropped' | 'failed'> {
  try {
    const response = await fetch(`${FCM}/${projectId}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          // Every value a string, or FCM answers "invalid argument".
          // Every value a string, and a key left out rather than sent empty:
          // FCM rejects a data payload holding anything but strings, and an
          // empty one would reach the worker as a picture that cannot load.
          data: {
            title: payload.title,
            body: payload.body,
            url: payload.url,
            tag: payload.tag,
            ...(payload.icon ? { icon: payload.icon } : {}),
          },
          webpush: {
            headers: {
              // Four hours: worth waking a phone left overnight, not a week on.
              TTL: '14400',
              Urgency: 'high',
            },
          },
        },
      }),
    })

    if (response.ok) return 'sent'

    // Thrown away by the browser: dead for everyone, so it goes now.
    if (response.status === 404 || response.status === 403) {
      await deletePushDevice(deviceToken)
      return 'dropped'
    }

    await log.error('push', `fcm refused a device: ${response.status}`, {
      body: (await response.text()).slice(0, 500),
    })
    return 'failed'
  } catch (error) {
    await log.error('push', 'fcm could not be reached', error)
    return 'failed'
  }
}
