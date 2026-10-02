/** Save effects, appended to `<body>` and gone when done — never React state, never in a render's way. */

/** Streak lengths worth confetti; every other day gets the ripple only. */
const MILESTONES = new Set([3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 1000])

export const isMilestone = (streak: number) => MILESTONES.has(streak)

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function centreOf(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

function spawn(className: string, x: number, y: number, style: Record<string, string> = {}) {
  const node = document.createElement('div')
  node.className = className
  node.setAttribute('aria-hidden', 'true')
  node.style.left = `${x}px`
  node.style.top = `${y}px`
  for (const [key, value] of Object.entries(style)) node.style.setProperty(key, value)
  node.addEventListener('animationend', () => node.remove(), { once: true })
  document.body.appendChild(node)
  // A tab hidden mid-animation never fires `animationend`.
  window.setTimeout(() => node.remove(), 2000)
}

/** A ring crossing the glass from the Save button. */
export function rippleFrom(element: Element) {
  if (reducedMotion()) return
  const { x, y } = centreOf(element)
  spawn('daily-ripple', x, y)
}

const CONFETTI_TINTS = ['--accent', '--good', '--warn', '--bad']

export function confettiFrom(element: Element, pieces = 28) {
  if (reducedMotion()) return
  const { x, y } = centreOf(element)
  for (let i = 0; i < pieces; i++) {
    const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.4
    const distance = 90 + Math.random() * 120
    spawn('daily-confetti', x, y, {
      '--dx': `${Math.cos(angle) * distance}px`,
      // Biased upward, then gravity is the easing curve.
      '--dy': `${Math.sin(angle) * distance - 60}px`,
      '--rot': `${Math.round(Math.random() * 720 - 360)}deg`,
      background: `var(${CONFETTI_TINTS[i % CONFETTI_TINTS.length]})`,
    })
  }
}

/** A tap under the thumb, where the device has one. */
export function haptic(ms = 12) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
}
