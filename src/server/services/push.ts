import { log } from '@/lib/log'
import { deletePushDevice, listPushDevices } from '@/server/repositories/push'
import { accessToken, readServiceAccount, SCOPES } from './google-auth'

/**
 * Sending a notification, over FCM's HTTP v1 API.
 *
 * **Data-only, never `notification`.** A message carrying a `notification`
 * block is drawn by the browser itself, which means the words are decided here
 * and cannot be changed, counted or collapsed on the device. Data-only hands
 * the payload to the service worker instead, and `sw.js` draws it — which is
 * also what keeps the Firebase SDK out of that file. It is plain JS with no
 * build step on purpose, and `importScripts` of a compat bundle would end
 * that.
 *
 * The price of data-only is a rule that must not be broken: a push event has
 * to produce a visible notification. A browser that receives pushes which
 * show nothing will revoke the permission, so `sw.js` always calls
 * `showNotification`, even when the payload makes no sense to it.
 */

const FCM = 'https://fcm.googleapis.com/v1/projects'

/** What a device is told. Short — the app fetches the rest when opened. */
export type PushPayload = {
  title: string
  body: string
  /** Where tapping it should land. */
  url: string
  /**
   * Notifications sharing a tag replace one another instead of stacking. One
   * room is one line on the lock screen however many messages arrive.
   */
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

/**
 * Tells everybody on this list, on every device they have registered.
 *
 * Never throws. It is called from the path that sends a message, and a message
 * that failed to save is a problem — a message that saved and did not buzz a
 * phone is not one worth failing the send over.
 */
export async function notify(userIds: string[], payload: PushPayload): Promise<PushResult> {
  const account = readServiceAccount()
  if (!account || userIds.length === 0) return NOTHING

  try {
    const devices = await listPushDevices({ userIds })
    if (devices.length === 0) return NOTHING

    const token = await accessToken(account, SCOPES.messaging)
    const result = { ...NOTHING }

    // One request per device: FCM's batch endpoint is gone, and a room holds
    // few enough phones that the simple thing is also the right one.
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
          // Every value a string: FCM rejects a data payload that holds
          // anything else, and the error says only "invalid argument".
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
              // Four hours. A notification about a message is worth waking a
              // phone that was off overnight; it is not worth doing so a week
              // later, when the conversation has moved on.
              TTL: '14400',
              Urgency: 'high',
            },
          },
        },
      }),
    })

    if (response.ok) return 'sent'

    /*
     * A token the browser has thrown away — reinstalled, storage cleared,
     * permission revoked. Dead for everyone, so it goes now rather than being
     * retried nightly for as long as the row exists.
     */
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
