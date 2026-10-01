import type { StickerId } from '@/lib/chat/stickers'

/**
 * The pack, drawn rather than fetched.
 *
 * Flat shapes on a coloured disc, in the app's own palette, so they sit beside
 * the rest of the interface instead of arriving from somebody else's design
 * language. Each is a plain `<svg>` — no sprite sheet, no network, and the
 * whole set is smaller than one PNG would be.
 *
 * Replacing these with a bought set means changing this file and leaving the
 * ids alone: `lib/chat/stickers.ts` is the vocabulary, this is only the ink.
 */
const ART: Record<StickerId, { hue: string; draw: React.ReactNode }> = {
  like: {
    hue: '#3b82f6',
    draw: (
      <path
        d="M22 44V30h5l6-12a4 4 0 0 1 7 3l-2 9h11a4 4 0 0 1 4 5l-3 12a5 5 0 0 1-5 4H22Z"
        fill="#fff"
      />
    ),
  },
  love: {
    hue: '#ef4444',
    draw: (
      <path d="M32 50S14 39 14 28a9 9 0 0 1 18-4 9 9 0 0 1 18 4c0 11-18 22-18 22Z" fill="#fff" />
    ),
  },
  laugh: {
    hue: '#f59e0b',
    draw: (
      <>
        <path d="M16 30h32c0 11-7 18-16 18s-16-7-16-18Z" fill="#fff" />
        <path d="M22 38h20c-2 5-6 8-10 8s-8-3-10-8Z" fill="#f59e0b" />
        <path
          d="M18 22c3-3 7-3 10 0M36 22c3-3 7-3 10 0"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  sad: {
    hue: '#6366f1',
    draw: (
      <>
        <circle cx="24" cy="26" r="3.5" fill="#fff" />
        <circle cx="40" cy="26" r="3.5" fill="#fff" />
        <path
          d="M22 44c3-5 7-7 10-7s7 2 10 7"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M24 32v8a2.5 2.5 0 0 1-5 0v-8Z" fill="#fff" opacity=".8" />
      </>
    ),
  },
  angry: {
    hue: '#dc2626',
    draw: (
      <>
        <path d="M17 20l11 6M47 20l-11 6" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="25" cy="32" r="3.5" fill="#fff" />
        <circle cx="39" cy="32" r="3.5" fill="#fff" />
        <path
          d="M22 45c4-4 16-4 20 0"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  fire: {
    hue: '#f97316',
    draw: (
      <path
        d="M32 12c8 8 12 14 12 21a12 12 0 0 1-24 0c0-4 2-7 5-10 1 3 3 4 4 3 2-2-1-8 3-14Z"
        fill="#fff"
      />
    ),
  },
  clap: {
    hue: '#eab308',
    draw: (
      <>
        <path
          d="M24 46V28a3 3 0 0 1 6 0v10M30 38V24a3 3 0 0 1 6 0v14M36 38V27a3 3 0 0 1 6 0v17a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8"
          fill="#fff"
        />
        <path
          d="M18 20l-3-5M32 14v-5M46 20l3-5"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </>
    ),
  },
  party: {
    hue: '#a855f7',
    draw: (
      <>
        <path d="M14 50l12-28 14 14-26 14Z" fill="#fff" />
        <circle cx="44" cy="18" r="3" fill="#fff" />
        <circle cx="50" cy="30" r="2.5" fill="#fff" />
        <circle cx="36" cy="12" r="2.5" fill="#fff" />
      </>
    ),
  },
  coffee: {
    hue: '#92400e',
    draw: (
      <>
        <path d="M18 26h26v12a10 10 0 0 1-10 10h-6a10 10 0 0 1-10-10V26Z" fill="#fff" />
        <path d="M44 30h4a5 5 0 0 1 0 10h-4" stroke="#fff" strokeWidth="3.5" fill="none" />
        <path
          d="M26 20c0-3 4-3 4-6M34 20c0-3 4-3 4-6"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
  },
  sleep: {
    hue: '#0ea5e9',
    draw: (
      <>
        <path d="M40 14a20 20 0 1 0 10 28A22 22 0 0 1 40 14Z" fill="#fff" />
        <path
          d="M44 20h8l-8 8h8"
          stroke="#fff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
  },
  run: {
    hue: '#10b981',
    draw: (
      <>
        <circle cx="38" cy="17" r="5" fill="#fff" />
        <path
          d="M34 26l-8 6 4 8-6 10M34 26l8 4 2 9M26 32l-9 2"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
  },
  ok: {
    hue: '#14b8a6',
    draw: (
      <path
        d="M18 33l10 10 18-20"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
}

export function StickerArt({ id, size = 96 }: { id: StickerId; size?: number }) {
  const art = ART[id]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="presentation" aria-hidden>
      <circle cx="32" cy="32" r="30" fill={art.hue} />
      {art.draw}
    </svg>
  )
}
