import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';

import { palette, spacing, radius, borderWidth, shadow, typeScale } from '@theme/theme';

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
 */
export function HintSheet({
  visible,
  requiredLetter,
  exampleWord,
  onUseHint,
  onCancel,
}: HintSheetProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.sheet}>
        <Text style={styles.title}>Hint</Text>
        <Text style={styles.body}>Your word must begin with:</Text>
        <Text style={styles.letter}>{requiredLetter.toUpperCase()}</Text>
        <Text style={styles.body}>Example: {exampleWord.toUpperCase()}</Text>
        <Text style={styles.body}>
          This hint will reduce your available hints by one.
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={onUseHint}>
            <Text style={styles.action}>Use Hint</Text>
          </Pressable>
          <Pressable onPress={onCancel}>
            <Text style={styles.action}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Token-only styling (WL-203). This is the skeleton wearing real tokens, not
// the finished sheet — WL-307 builds the actual hint levels and WL-204 supplies
// the Button component these two Pressables should become.
const styles = StyleSheet.create({
  sheet: {
    marginTop: 'auto',
    backgroundColor: palette.paper,
    padding: spacing.lg,
    // Design System §4: modals carry the heaviest shadow and a 4px floor on
    // the border, to read as elevated above the base screen.
    borderWidth: borderWidth.thick,
    borderColor: palette.ink,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    boxShadow: shadow.modal,
    gap: spacing.sm,
  },
  title: { ...typeScale.screenTitle, color: palette.ink },
  body: { ...typeScale.body, color: palette.ink },
  letter: { ...typeScale.requiredLetter, color: palette.ink },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { ...typeScale.buttonLabel, color: palette.ink },
});
