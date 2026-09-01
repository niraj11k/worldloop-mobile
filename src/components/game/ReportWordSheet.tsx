import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { Input } from '@components/common/Input';
import { MAX_COMMENT_LENGTH, WORD_REPORT_TYPES } from '@features/report/wordReports';
import { palette, spacing, typeScale, displayTextProps } from '@theme/theme';
import type { WordReportType } from '@app-types/report';

interface ReportWordSheetProps {
  visible: boolean;
  /**
   * The word being reported. Empty means the sheet has to ask for one — the
   * Settings entry point, where there is no round to take it from.
   */
  word: string;
  /** Whether the player types the word themselves (the Settings entry). */
  askForWord?: boolean;
  onSubmit: (report: { word: string; reportType: WordReportType; comment: string }) => void;
  onCancel: () => void;
}

/**
 * Report-a-word sheet.
 * Spec: PRD §26, Data Model §8. Rendered as an overlay rather than a route,
 * like `HintSheet` and `DefinitionSheet` — the game-screen entry point sits on
 * the invalid-word state, and navigating away from a round to complain about a
 * word would lose the round.
 *
 * The five types are read from `WORD_REPORT_TYPES` rather than restated here,
 * so the screen cannot drift from PRD §26's list.
 *
 * A type is required and the comment is not. That asymmetry is deliberate: the
 * type is the part that can be acted on in bulk when curating the word list,
 * while free text is a nicety that most players will skip — requiring it would
 * cost reports without improving them.
 */
export function ReportWordSheet({
  visible,
  word,
  askForWord = false,
  onSubmit,
  onCancel,
}: ReportWordSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<WordReportType | null>(null);
  const [comment, setComment] = useState('');
  const [typedWord, setTypedWord] = useState('');

  // Reset on each open. Without this the sheet reopens holding the previous
  // report's type already selected, and a second report becomes one careless
  // tap away from saying something the player did not mean.
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setComment('');
      setTypedWord('');
    }
  }, [visible]);

  const subject = askForWord ? typedWord.trim() : word;
  const canSubmit = selected !== null && subject.length > 0;

  return (
    <BottomSheet visible={visible} onRequestClose={onCancel} title="Report a word">
      {askForWord ? (
        <Input
          accessibilityLabel="Word to report"
          value={typedWord}
          onChangeText={setTypedWord}
          placeholder="Which word?"
          autoCapitalize="none"
        />
      ) : (
        <Text {...displayTextProps} style={styles.word}>
          {word.toUpperCase()}
        </Text>
      )}

      <ScrollView style={styles.optionsScroll} contentContainerStyle={styles.options}>
        {WORD_REPORT_TYPES.map(option => {
          const isSelected = option.type === selected;
          return (
            <Pressable
              key={option.type}
              onPress={() => setSelected(option.type)}
              style={styles.option}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}>
              {/*
                The same dot glyph DifficultyScreen uses for selection, and for
                the same Design System §4 reason: selection must never read by
                colour alone.
              */}
              <Text style={styles.optionDot}>{isSelected ? '●' : '○'}</Text>
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Input
        accessibilityLabel="Anything else? (optional)"
        value={comment}
        onChangeText={text => setComment(text.slice(0, MAX_COMMENT_LENGTH))}
        placeholder="Anything else? (optional)"
      />

      <View style={styles.actions}>
        <Button
          label="Send Report"
          tone="grape"
          disabled={!canSubmit}
          onPress={() =>
            selected !== null &&
            onSubmit({ word: subject, reportType: selected, comment })
          }
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  word: { ...typeScale.chainWord, color: palette.ink, textAlign: 'center' },
  // Five options plus an input and two buttons overflow a small phone at the
  // largest OS text size, and Send Report has to stay reachable.
  //
  // `flexShrink` added under WL-312: the 220 cap handles large text, and the
  // keyboard is the other way this sheet runs out of room — it takes roughly
  // 260pt on the smallest phone, which the cap alone knows nothing about. This
  // list is the right part to give up that space, because it is already
  // scrollable and the comment field the player is typing into is not.
  optionsScroll: { maxHeight: 220, flexGrow: 0, flexShrink: 1 },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  optionDot: { ...typeScale.body, color: palette.ink },
  optionLabel: { ...typeScale.body, color: palette.ink, flexShrink: 1 },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
});
