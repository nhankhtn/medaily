'use client'

import { pickProvider } from './provider'

/**
 * The one thing the root layout renders.
 *
 * It is a direct export of a `'use client'` module on purpose. Next builds a
 * client reference for each *export* of such a module, not for the properties
 * of an object it exports — so rendering `<provider.Mount />` from a server
 * component reads `undefined` and throws at render time, with a type checker
 * and a build that both say everything is fine. Choosing the provider happens
 * on this side of the boundary, where an object with a component on it is an
 * ordinary object again.
 */
export function AnalyticsMount() {
  const provider = pickProvider()
  return <provider.Mount />
}
