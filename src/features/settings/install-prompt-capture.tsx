'use client'

import { useEffect } from 'react'
import { bindInstallPromptListeners } from '@/features/settings/install-capability'

/** Keeps the Chromium install event so Settings and the post-tour dialog share it. */
export function InstallPromptCapture() {
  useEffect(() => bindInstallPromptListeners(), [])
  return null
}
