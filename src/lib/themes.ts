/**
 * The themes the app ships with.
 *
 * Adding one is two edits and no migration: an entry here, and a block of
 * tokens in globals.css under `[data-theme='<id>']`. The stored preference is
 * free text validated against this list, the toggle builds itself from it, and
 * the contrast test reads the CSS so an unreadable palette fails the suite.
 */

export type ThemeId = 'light' | 'dark' | 'pink'

/** What the user chose. `system` follows the operating system. */
export type ThemePreference = ThemeId | 'system'

export type Theme = {
  id: ThemeId
  /**
   * The palette the browser should assume for scrollbars, form controls and
   * charts. A theme is a set of colours; this says which end of the scale it
   * sits at.
   */
  base: 'light' | 'dark'
  labelKey: string
}

export const THEMES: readonly Theme[] = [
  { id: 'light', base: 'light', labelKey: 'themeLight' },
  { id: 'dark', base: 'dark', labelKey: 'themeDark' },
  { id: 'pink', base: 'light', labelKey: 'themePink' },
] as const

export const DEFAULT_THEME: ThemePreference = 'system'

/**
 * Mirrors the stored preference, the way the locale cookie does. The sign-in
 * page has no session and so no settings row to read: without this it would
 * always render in the system theme, and signing in would change the colours
 * under you.
 */
export const THEME_COOKIE = 'medaily_theme'

export const THEME_IDS = THEMES.map((theme) => theme.id)

/** `system` first: it is the default, and the one most people leave alone. */
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', ...THEME_IDS]

export const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value)

export const themeOf = (id: ThemeId): Theme =>
  THEMES.find((theme) => theme.id === id) ?? (THEMES[0] as Theme)

/** Ids whose palette is dark, which is what the `dark:` variant keys off. */
export const DARK_THEME_IDS = THEMES.filter((theme) => theme.base === 'dark').map(
  (theme) => theme.id,
)

/**
 * Resolves the preference to a concrete theme before first paint, so the page
 * never flashes the wrong palette. It runs inline in <head>, before React, and
 * is built from the registry so a new dark-based theme needs no edit here.
 */
export function themeBootScript(): string {
  return `(function(){try{
var r=document.documentElement,p=r.dataset.themePref||'system',
d=${JSON.stringify(DARK_THEME_IDS)},
id=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;
r.dataset.theme=id;r.classList.toggle('dark',d.indexOf(id)>-1)
}catch(e){}})()`.replace(/\n/g, '')
}
