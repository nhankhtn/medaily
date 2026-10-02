import { confettiFrom, haptic } from '@/features/daily/celebrate'
import type { EasterEgg } from './motion'

const BALLOONS = 9

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Appended to `<body>` like the daily confetti, so no render is ever waiting on it. */
function balloons() {
  for (let i = 0; i < BALLOONS; i++) {
    const node = document.createElement('div')
    node.className = 'chat-balloon'
    node.setAttribute('aria-hidden', 'true')
    node.textContent = '🎈'
    node.style.left = `${8 + Math.random() * 84}vw`
    node.style.setProperty('--sway', `${Math.round(Math.random() * 60 - 30)}px`)
    node.style.animationDelay = `${Math.round(Math.random() * 600)}ms`
    node.addEventListener('animationend', () => node.remove(), { once: true })
    document.body.appendChild(node)
    // A tab hidden mid-flight never fires `animationend`.
    window.setTimeout(() => node.remove(), 6000)
  }
}

/** Purely local: reads text already on screen and sends nothing anywhere. */
export function celebrate(egg: EasterEgg, from: Element | null) {
  if (reducedMotion() || document.visibilityState !== 'visible') return
  if (egg === 'balloons') balloons()
  else if (from) confettiFrom(from)
  haptic()
}
