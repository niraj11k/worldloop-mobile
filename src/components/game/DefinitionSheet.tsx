import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { DEFINITION_UNAVAILABLE_MESSAGE } from '@constants/gameConstants';
import type { DefinitionResult } from '@features/dictionary/definitionService';
import { palette, spacing, typeScale, displayTextProps } from '@theme/theme';

interface DefinitionSheetProps {
  visible: boolean;
  /** The word being explained — shown even when there is no definition. */
  word: string;
  /** `null` is the unavailable state, not an error. See below. */
  definition: DefinitionResult | null;
  onClose: () => void;
}

/**
 * Word definition overlay.
 * Spec: Wireframe doc section 12. Rendered as an overlay from GameScreen, the
 * same as `HintSheet` and for the same reason — PRD section 12 requires that a
 * definition never interrupt the turn, and a navigation would take the board
 * off screen and put the round's focus and keyboard state at risk.
 *
 * ## The unavailable state is not an error (WL-501)
 *
 * About 30% of the playable word list has no bundled gloss, so `definition ===
 * null` is something an ordinary player meets in ordinary play. Wireframe
 * section 12 gives it its own copy and this sheet treats it as content: same
 * surface, same heading, same Close — no error tone, no `palette.tomato`, no
 * apology. The only difference is which body renders. Presenting a miss as a
 * failure would teach the player that the game is broken when it is working.
 *
 * The word itself is always shown, including on a miss: it is the one thing
 * the sheet can always say, and without it the overlay reads as being about
 * nothing.
 */
export function DefinitionSheet({
  visible,
  word,
  definition,
  onClose,
}: DefinitionSheetProps): React.JSX.Element {
  return (
    <BottomSheet visible={visible} onRequestClose={onClose} title="Definition">
      <Text {...displayTextProps} style={styles.word}>
        {word.toUpperCase()}
      </Text>

      {/*
        A few WordNet glosses run past 400 characters, and at the largest OS
        text size that is taller than the screen. Scrolling the body — rather
        than the whole sheet — keeps Close reachable without the player having
        to scroll to find the way out.
      */}
      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.body}>
        {definition === null ? (
          <Text style={styles.text}>{DEFINITION_UNAVAILABLE_MESSAGE}</Text>
        ) : (
          <>
            <Text style={styles.partOfSpeech}>{definition.partOfSpeech}</Text>
            {/*
              WordNet writes glosses in lower case with no full stop. Both are
              fixed here rather than in the asset: capitalisation is a
              rendering choice, and baking it in would cost the same bytes
              148,111 times over and lock the presentation into the data.
            */}
            <Text style={styles.text}>{sentenceCase(definition.definition)}</Text>
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Button label="Close" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

/** Capitalises the first letter and ends the sentence. */
function sentenceCase(text: string): string {
  const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

const styles = StyleSheet.create({
  word: { ...typeScale.chainWord, color: palette.ink, textAlign: 'center' },
  // A cap rather than a fixed height: a one-line definition should not leave
  // an empty half-screen of sheet below it.
  bodyScroll: { maxHeight: 240, flexGrow: 0 },
  body: { gap: spacing.xs },
  partOfSpeech: { ...typeScale.caption, color: palette.ink },
  text: { ...typeScale.body, color: palette.ink },
  actions: { flexDirection: 'row', marginTop: spacing.sm, flexWrap: 'wrap' },
});
