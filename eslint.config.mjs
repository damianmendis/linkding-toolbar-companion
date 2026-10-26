// ESLint flat config. `npm run lint` runs this plus the TypeScript
// typecheck; CI runs the same script.
//
// ESLint stays on 9.x for now: eslint-plugin-jsx-a11y doesn't declare
// support for ESLint 10 yet.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist-chrome/', 'dist-firefox/', 'test-results/', 'playwright-report/', 'node_modules/'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // `_name` marks a parameter a callback signature requires but the
      // body doesn't use (e.g. onMessage's sender).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Extension code: popup, options page and background service worker.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    files: ['src/**/*.tsx'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },

  // Tests run in Node (Vitest, Playwright) and evaluate code in the browser.
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.webextensions },
    },
  },

  // Build and packaging scripts are plain CommonJS run by Node.
  {
    files: ['scripts/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['*.config.{ts,mjs}'],
    languageOptions: { globals: globals.node },
  },
);
