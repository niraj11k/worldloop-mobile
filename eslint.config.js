const reactNativeConfig = require('@react-native/eslint-config/flat');

/**
 * ESLint flat config (ESLint 9+).
 *
 * Replaces the legacy .eslintrc.js. `@react-native/eslint-config` ships a
 * flat-config entry point at `/flat`; the eslintrc entry point is the
 * default export and is not used here.
 */
module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'vendor/**',
      'coverage/**',
      'build/**',
    ],
  },
  ...reactNativeConfig,

  // Project rule overrides. In flat config a rule must be applied in a config
  // object whose merged `plugins` include that rule's namespace, so the
  // TypeScript rule is scoped to the files the RN config registers
  // `@typescript-eslint` for.
  {
    files: ['**/*.{js,jsx}'],
    rules: {
      'no-unused-vars': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
];
