/**
 * Copy that also works where `navigator.clipboard` is not there.
 *
 * The API is gated on a secure context, and the one place this matters most is
 * a phone pointed at `http://<lan-ip>:3000` — which is not one. The deprecated
 * path is the only thing standing between that and a number typed by hand.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Denied or unavailable; the fallback below may still go through.
  }

  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}
