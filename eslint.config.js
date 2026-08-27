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

  // WL-203 — the design-token rule, enforced rather than reviewed.
  //
  // Design System §1-§4 define every colour, size, radius, border weight and
  // shadow the app may use. A raw value at a call site is how a design system
  // rots: it typechecks, it renders, it looks approximately right, and it
  // quietly diverges from the doc until nobody knows which is authoritative.
  //
  // These are `no-restricted-syntax` selectors rather than a custom plugin on
  // purpose — a local plugin would mean a new package, a build step, and its
  // own tests, to express four AST patterns. Scoped to screens and components
  // because `src/theme/` is where these literals are *supposed* to live.
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message:
            'Raw hex colour. Use a token from @theme/theme (palette.*) — Design System §1. ' +
            'Every palette colour is contrast-verified; a raw hex is not.',
        },
        {
          // Catches the keyword colours a hex pattern misses — `'white'`,
          // `'red'`, `'rgba(...)'`. `transparent` is exempt: it is the absence
          // of a colour, not a colour choice, and has no token equivalent.
          selector:
            'Property[key.name=/[Cc]olor$/] > Literal:not([value="transparent"])',
          message:
            'Raw colour value. Use a token from @theme/theme (palette.*) — Design System §1, ' +
            'which excludes greys and keyword colours from the palette entirely.',
        },
        {
          selector: 'Property[key.name="fontSize"] > Literal',
          message:
            'Raw font size. Use a role from @theme/theme (type.*) — Design System §2. ' +
            'The scale also encodes the rules that the display face is never used below ' +
            '20px and that the required letter is the largest element on screen.',
        },
        {
          selector: 'Property[key.name="fontFamily"] > Literal',
          message:
            'Raw font family. Use @theme/theme (fontFamily.*) — a misspelled family does ' +
            'not error in React Native, it silently renders the system face (WL-201).',
        },
        {
          selector:
            'Property[key.name=/^(shadowColor|shadowOffset|shadowOpacity|shadowRadius|elevation)$/]',
          message:
            'Legacy shadow prop. Use `boxShadow: shadow.*` from @theme/theme — Design ' +
            'System §4 requires a hard offset shadow with no blur, which shadowOffset ' +
            '(iOS-only) and elevation (blurred, uncontrollable offset) cannot express on Android.',
        },
        {
          selector: 'Property[key.name="boxShadow"] > ArrayExpression',
          message:
            'Inline shadow value. Use a `shadow.*` token from @theme/theme — Design System §4 ' +
            'fixes the offset per component type.',
        },
        // WL-207: an emoji standing in for an icon. The listed characters are
        // pictographic and have no legitimate prose use, unlike arrows (→),
        // which appear in real copy and are deliberately not listed.
        {
          selector: 'JSXText[value=/[\\u2699\\u23F8\\u23F9\\u25B6\\u2716\\u274C\\u2190\\uD83D\\uDD0A\\uD83D\\uDCF3\\uD83D\\uDCA1\\uD83C\\uDFA8]/]',
          message:
            'Emoji used as an icon. Use <Icon name=… /> from @components/common/icons — ' +
            'Design System §7 requires the custom set, and emoji render as tofu boxes ' +
            'wherever the platform lacks the glyph.',
        },
        {
          selector: 'Literal[value=/[\\u2699\\u23F8\\u23F9\\u25B6\\u2716\\u274C\\uD83D\\uDD0A\\uD83D\\uDCF3\\uD83D\\uDCA1\\uD83C\\uDFA8]/]',
          message:
            'Emoji used as an icon. Use <Icon name=… /> from @components/common/icons — ' +
            'Design System §7 requires the custom set.',
        },
      ],
    },
  },

  // The typography section is a measurement instrument, not product UI
  // (WL-201, now living in the WL-206 gallery). It has to render probe strings
  // at arbitrary sizes and, crucially, to render text with *no* fontFamily at
  // all to get the platform default to compare against. Token-only styling
  // would defeat the thing it exists to detect.
  //
  // Scoped to this one file rather than the whole gallery: every other section
  // is styled from the tokens, which is what lets the gallery break when the
  // token layer does.
  {
    files: ['src/screens/Gallery/sections/TypographySection.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];
