import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'next-env.d.ts', 'backups/**'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      /**
       * Domain code must not construct "now" ad hoc: every date decision goes
       * through lib/dates so the user's timezone and rollover hour apply
       * (spec 20.1).
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use lib/dates (today/logicalDateOf) so the user timezone and rollover apply.',
        },
      ],
    },
  },
  {
    // The date library itself, plus writes that record a real wall-clock instant.
    files: [
      'src/lib/dates/**',
      'src/i18n/**',
      'src/features/ai/**',
      'src/server/**',
      'src/app/api/**',
      'scripts/**',
      'tests/**',
      '*.config.*',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
]

export default config
