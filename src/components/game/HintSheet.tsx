import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { palette, spacing, typeScale } from '@theme/theme';

interface HintSheetProps {
  visible: boolean;
  requiredLetter: string;
  /** Level 2 — how many words the player could still submit for this letter. */
  wordCount: number;
  /** Level 3. `null` on the rare letter with no remaining candidate at all. */
  exampleWord: string | null;
  /**
   * Level 4 (WL-504) — what another playable word means, never which one.
   * `null` when no remaining candidate has a gloss that keeps its own word
   * secret; the line is omitted rather than replaced with an apology.
   */
  definitionClue: { partOfSpeech: string; definition: string } | null;
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
 * 4. definition-based clue. Levels 1-3 came in at WL-307, level 4 at WL-504.
 * All four reveal together as one hint, not as separately-costed tiers —
 * matching this sheet's single `[Use Hint]` action. That is also why the whole
 * sheet stays at the -5 penalty and never reaches `scoringEngine`'s -10
 * `hintRevealedWord` tier: level 4 describes a word it does not name, so no
 * level here hands over the answer. Never auto-reveal a word without explicit
 * user choice: opening the sheet only previews what the hint contains, and
 * nothing is charged against the round's hint limit until `onUseHint` fires.
 *
 * Levels 3 and 4 are each omitted rather than shown empty when the letter has
 * nothing to offer — a hint that says "no example available" costs the player
 * a hint to tell them nothing.
 *
 * Rebuilt on `BottomSheet` and `Button` under WL-204, so the sheet's border,
 * shadow, and scrim come from the shared component rather than being restated
 * here.
 */
export function HintSheet({
  visible,
  requiredLetter,
  wordCount,
  exampleWord,
  definitionClue,
  onUseHint,
  onCancel,
}: HintSheetProps): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onRequestClose={onCancel} title="Hint">
      <Text style={styles.body}>Your word must begin with:</Text>
      <Text style={styles.letter}>{requiredLetter.toUpperCase()}</Text>
      <Text style={styles.body}>Words available: {wordCount}</Text>
      {exampleWord !== null && (
        <Text style={styles.body}>Example: {exampleWord.toUpperCase()}</Text>
      )}
      {/*
        Level 4. Phrased as "another word here means…" rather than "definition:"
        so it reads as a second word to find, not as a gloss of the example
        printed above it — which is what it is, and what makes it a fourth
        level of help rather than a restatement of the third.
      */}
      {definitionClue !== null && (
        <Text style={styles.body}>
          Another word here means: {definitionClue.definition} (
          {definitionClue.partOfSpeech.toLowerCase()})
        </Text>
      )}
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
