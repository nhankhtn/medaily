import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes as prismThemes } from 'prism-react-renderer'

/**
 * The documents themselves live one level up, in docs/. This folder only
 * renders them, so they stay readable on GitHub and in the editor exactly as
 * before — edit the .md files there, never copies here.
 *
 * The build lands in the app's `public/docs/` and is served by Next at /docs,
 * behind the same session check as every other page (see src/proxy.ts).
 */
const config: Config = {
  title: 'Medaily Docs',
  tagline: 'Features, database, realtime',

  url: 'http://localhost',
  baseUrl: '/docs/',
  // `/docs/features` → `features.html`, which next.config.ts rewrites to.
  // With a trailing slash, Next's own redirect would strip it again.
  trailingSlash: false,
  noIndex: true,

  onBrokenLinks: 'throw',

  i18n: { defaultLocale: 'en', locales: ['en'] },

  markdown: {
    // .md files are parsed as plain CommonMark, so a stray `<` or `{` in the
    // prose cannot break the build the way MDX would.
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'throw' },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      { hashed: true, indexBlog: false, docsDir: '..', docsRouteBasePath: '/', highlightSearchTermsOnTargetPage: true },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '..',
          exclude: ['site/**'],
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        pages: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: 'Medaily Docs',
      items: [{ type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' }],
    },
    docs: { sidebar: { hideable: true } },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'sql', 'json', 'typescript'],
    },
    mermaid: { theme: { light: 'neutral', dark: 'dark' } },
  } satisfies Preset.ThemeConfig,
}

export default config
