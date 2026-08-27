import { StyleSheet } from 'react-native';

import { palette, spacing, typeScale } from '@theme/theme';

/**
 * Shared chrome for the gallery sections (WL-206).
 *
 * Section-specific styles stay in their own files; this is only the headings,
 * captions and page frame every section repeats. Extracted so a section can be
 * added without copying a style block, which is how the old single-file
 * specimen accumulated near-duplicate rules.
 */
export const gallery = StyleSheet.create({
  page: { flex: 1, backgroundColor: palette.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  h2: {
    ...typeScale.screenTitle,
    color: palette.ink,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  caption: { ...typeScale.caption, color: palette.ink, marginBottom: spacing.sm },
  label: { ...typeScale.body, color: palette.ink },

  row: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  col: { gap: spacing.md, marginBottom: spacing.md, alignItems: 'flex-start' },
});
