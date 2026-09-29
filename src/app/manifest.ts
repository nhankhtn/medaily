import type { MetadataRoute } from 'next'

/**
 * `handle_links` is a real manifest member that Next's type does not carry,
 * so it is added on the way out rather than cast into the literal — the
 * literal keeps its checking, and the one unchecked key is visible here.
 */
type Manifest = MetadataRoute.Manifest & { handle_links?: 'auto' | 'preferred' | 'not-preferred' }

/** Installable as a PWA (spec 22.3). The offline shell arrives with phase 7. */
export default function manifest(): Manifest {
  return {
    name: 'Personal OS',
    short_name: 'Personal OS',
    description: 'Track daily performance, understand behaviour, manage goals.',
    start_url: '/daily',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#4f5fd7',
    orientation: 'portrait',
    // Stated rather than inferred. It defaults to the directory `start_url`
    // sits in, so moving the start page one level down would quietly drop
    // every other screen out of the installed app and into a browser tab.
    scope: '/',
    /*
     * Links into `scope` open the installed app rather than a browser tab.
     *
     * The one that made this worth setting: paying from the transfer sheet
     * hands off to the bank app with a `url` to come back to, and without
     * this that return lands in Chrome — a second copy of medaily beside the
     * installed one. It applies to every link in, though, not just that one,
     * which is the behaviour an installed app should have anyway.
     *
     * Android only. An iOS home-screen app never registers as a handler for
     * its own addresses, so there the return goes to Safari whatever is
     * written here; what saves that case is the transfer sheet never leaving
     * the app in the first place.
     */
    handle_links: 'preferred',
    icons: [
      // One scalable file rather than a ladder of PNGs: every browser that can
      // install a PWA can rasterise SVG.
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      // Android masks the icon to the launcher's shape. Without a maskable
      // one it letterboxes ours inside a white tile instead, which is the
      // look that marks an installed web app out from the real apps.
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
