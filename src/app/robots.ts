import type { MetadataRoute } from 'next'
import { PATHS } from '@/lib/paths'

/**
 * Three pages are for the open web: what the app is, and the two documents a
 * person reads before deciding to hand over a journal and a ledger. Everything
 * else is somebody's private data and redirects to sign-in anyway.
 *
 * Sign-in is allowed too, but not for indexing: `Disallow` stops the fetch,
 * not the listing, and a URL linked from elsewhere can still surface as a bare
 * result. The root layout marks every page `noindex`; the welcome and legal
 * pages override it. A page a robot may not fetch is a page whose `noindex`
 * it never reads, so the ones meant to stay out of the index still have to be
 * fetchable.
 *
 * The bare address and the preview picture are here for a different reason:
 * the scraper behind a chat app's link card reads this file first. `/` is what
 * anyone actually pastes, and blocking it is why a link shared to Messenger
 * arrived as plain text while Zalo — which does not ask — showed the card.
 *
 * `$` anchors the match to the end of the path, so this opens the root and not
 * the app behind it. A parser that does not know `$` reads it as a prefix that
 * matches nothing, which leaves the root shut rather than opening anything
 * that should stay closed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/$', PATHS.welcome, PATHS.legalRoot, PATHS.login, '/opengraph-image'],
      disallow: '/',
    },
  }
}
