// ESLint finds likely bugs and enforces project rules. Run with `pnpm lint`.
// Docs: https://eslint.org/docs/latest/use/configure/
import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// --- Golden rule 1: no network access (see AGENTS.md) -----------------------
const NO_NETWORK = 'Glossa never uses the network at runtime (AGENTS.md, golden rule 1).'
const networkImportPaths = [
  ...['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns'].flatMap((name) => [
    { name, message: NO_NETWORK },
    { name: `node:${name}`, message: NO_NETWORK },
  ]),
  ...['undici', 'axios', 'node-fetch', 'ws'].map((name) => ({ name, message: NO_NETWORK })),
  { name: 'electron', importNames: ['net'], message: NO_NETWORK },
]
const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: NO_NETWORK,
}))

// --- Golden rule 3: src/core stays pure (see AGENTS.md) ---------------------
const PURE_CORE = 'src/core must stay pure TypeScript (AGENTS.md, golden rule 3).'
const impureImportPatterns = [
  {
    group: ['electron', 'electron/*', 'node:*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
    message: PURE_CORE,
  },
  { group: ['**/main/**', '**/preload/**', '**/renderer/**', '**/engine/**'], message: PURE_CORE },
]

export default defineConfig([
  globalIgnores(['out/', 'dist/', 'release/', 'coverage/', 'models/']),

  js.configs.recommended,
  tseslint.configs.recommended,

  // Main process, preload, and config files run in Node.js.
  {
    files: ['src/main/**', 'src/preload/**', '*.config.{ts,mts,mjs}'],
    languageOptions: { globals: globals.node },
  },

  // Windows run in a browser environment with React.
  {
    files: ['src/renderer/**'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended],
  },

  // No network code anywhere in the app.
  {
    files: ['src/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: networkImportPaths }],
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: NO_NETWORK },
      ],
    },
  },

  // src/core: no network AND no Electron/Node/React, and no hidden clock reads
  // (pass time in as a parameter so results are repeatable in tests).
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: networkImportPaths, patterns: impureImportPatterns },
      ],
      'no-restricted-globals': [
        'error',
        ...networkGlobals,
        ...['window', 'document', 'process', 'require', 'performance'].map((name) => ({
          name,
          message: PURE_CORE,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: NO_NETWORK },
        { object: 'Date', property: 'now', message: `${PURE_CORE} Pass time in instead.` },
      ],
    },
  },

  // Must be last: turns off style rules that would fight with Prettier.
  prettier,
])
