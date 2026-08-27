import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { palette, spacing, typeScale } from '@theme/theme';

interface HintSheetProps {
  visible: boolean;
  requiredLetter: string;
  exampleWord: string;
  onUseHint: () => void;
  onCancel: () => void;
}

/**
 * Hint bottom sheet.
 * Spec: Wireframe doc section 11. Rendered as an overlay from GameScreen,
 * not a navigation route — the round should not be interrupted by navigation.
 *
 * Hint levels (PRD section 13, Wireframe doc section 11):
 * 1. Required letter, 2. word count available, 3. example word,
 * 4. definition-based clue. Only level 1 + 3 are stubbed here.
 * Never auto-reveal a word without explicit user choice.
 *
 * Rebuilt on `BottomSheet` and `Button` under WL-204, so the sheet's border,
 * shadow, and scrim come from the shared component rather than being restated
 * here. The remaining hint-level work is WL-307.
 */
export function HintSheet({
  visible,
  requiredLetter,
  exampleWord,
  onUseHint,
  onCancel,
}: HintSheetProps): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onRequestClose={onCancel} title="Hint">
      <Text style={styles.body}>Your word must begin with:</Text>
      <Text style={styles.letter}>{requiredLetter.toUpperCase()}</Text>
      <Text style={styles.body}>Example: {exampleWord.toUpperCase()}</Text>
      <Text style={styles.body}>
        This hint will reduce your available hints by one.
      </Text>

      <View style={styles.actions}>
        <Button
          label="Use Hint"
          onPress={onUseHint}
          accessibilityHint="Reveals the hint and reduces your remaining hints by one"
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { ...typeScale.body, color: palette.ink },
  letter: { ...typeScale.requiredLetter, color: palette.ink },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
});
