import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button } from '@components/common/Button';
import {
  palette,
  spacing,
  radius,
  borderWidth,
  shadow,
  typeScale,
  textOn,
  KEY_PRESS_TRANSLATE,
  MAX_KEY_FONT_SCALE,
  MIN_TAP_TARGET,
  CONTENT_MAX_WIDTH,
} from '@theme/theme';

/**
 * The game screen's in-app A-Z keyboard.
 *
 * Spec: Design System §4 ("Keys"), Delivery Plan D-11. Task: WL-311.
 *
 * Replaces the OS keyboard on the game screen. D-11 carries the full argument;
 * the short version is that the OS keyboard rewrites judged words through
 * autocorrect, varies in height by ~90pt depending on the player's own keyboard
 * settings, and can arrive in the wrong script entirely — and the game screen
 * has to lay out around it either way.
 *
 * This component **only produces input events**. It holds no text: the field is
 * still a real `TextInput` in `GameScreen`, and every key routes through the
 * same commit path as a hardware keystroke. That is deliberate — the WL-303
 * `latestInputRef` desync fix, the caret, hardware-keyboard support, and the
 * field's accessibility label all keep working untouched, and the OS keyboard
 * remains one prop away for `usePrefersSystemKeyboard`'s fallback.
 *
 * ## Layout
 *
 * QWERTY, not alphabetical. The layout is worth borrowing precisely because
 * players already know it — an alphabetical grid is easier to *build* and
 * slower to *type on* for anyone who has used a phone before.
 *
 * Every key is the same width, derived from the 10-column top row, and the
 * shorter rows centre within that grid rather than stretching (§4). Stretching
 * would make the same letter a different size depending on its row, which is
 * exactly the muscle memory the QWERTY layout was adopted to borrow.
 */

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

/** The top row's column count is what sizes every key on every row. */
const COLUMNS = 10;

/**
 * The two modifier keys on the bottom row are 1.5 columns wide, matching both
 * platforms' own keyboards.
 *
 * The arithmetic is exact rather than approximate: `1.5 + 7 + 1.5` is 10
 * columns, so the bottom row lands on precisely the same width as the top one
 * with Hide and Delete sitting where a phone keyboard puts shift and backspace.
 */
const MODIFIER_WIDTH_RATIO = 1.5;

/** Hold-to-repeat on delete: the wait before repeating starts. */
const DELETE_REPEAT_DELAY_MS = 400;

/** Hold-to-repeat on delete: the gap between repeats once it has. */
const DELETE_REPEAT_INTERVAL_MS = 70;

export interface LetterKeyboardProps {
  /** A letter key was pressed. Always uppercase — the caller decides casing. */
  onKeyPress: (letter: string) => void;
  onDelete: () => void;
  /**
   * Collapse the keyboard so the player can see the whole board.
   *
   * The in-app keyboard is permanent furniture in a way the OS keyboard never
   * was — there is no "done" to dismiss it with — so without this the required
   * letter card and a long chain are permanently half-covered on a small phone.
   */
  onHide: () => void;
  onSubmit: () => void;
  onHint: () => void;
  submitLabel: string;
  submitDisabled: boolean;
  hintDisabled: boolean;
  /**
   * The round's required letter, highlighted while it is the next thing the
   * player types. `null` once the input is non-empty — only the *first* letter
   * of a word is constrained, so a highlight that survived the first keystroke
   * would be asserting something untrue (§4).
   */
  highlightLetter: string | null;
  /** The whole keyboard is inert while a turn is resolving. */
  disabled: boolean;
}

export function LetterKeyboard({
  onKeyPress,
  onDelete,
  onHide,
  onSubmit,
  onHint,
  submitLabel,
  submitDisabled,
  hintDisabled,
  highlightLetter,
  disabled,
}: LetterKeyboardProps): React.JSX.Element {
  const { width } = useWindowDimensions();

  /*
    Sized from the window rather than measured with `onLayout`, so the first
    painted frame is already correct — a measured keyboard renders once at the
    wrong size and jumps, which on the game screen would happen at the start of
    every single turn.

    `CONTENT_MAX_WIDTH` for the same reason the rest of the screen uses it
    (WL-409): a keyboard stretched across a tablet puts Q and P a hand's width
    apart. `Math.floor` keeps the row inside its container — rounding up
    overflows by a fraction of a point per key, which is enough to clip the
    tenth one.
  */
  const columnSpace =
    Math.min(width, CONTENT_MAX_WIDTH) -
    spacing.sm * 2 -
    spacing.xs * (COLUMNS - 1);
  const keyWidth = Math.floor(columnSpace / COLUMNS);
  const modifierWidth = Math.floor(keyWidth * MODIFIER_WIDTH_RATIO);

  return (
    <View style={styles.keyboard}>
      {ROWS.map((row, rowIndex) => {
        const isBottomRow = rowIndex === ROWS.length - 1;
        return (
          <View key={row} style={styles.row}>
            {/*
              Hide sits where a phone keyboard puts shift, and Delete where it
              puts backspace — the two positions a player's thumbs already
              expect a modifier to be.

              Never disabled, unlike every other key. It changes what is on
              screen rather than what is in the field, so it stays available
              while a turn resolves; a player who wants to watch the chain
              update should not have to wait for the computer first.
            */}
            {isBottomRow && (
              <Key
                label="HIDE"
                accessibilityLabel="Hide keyboard"
                width={modifierWidth}
                disabled={false}
                onPress={onHide}
              />
            )}
            {[...row].map(letter => (
              <Key
                key={letter}
                label={letter}
                width={keyWidth}
                disabled={disabled}
                highlighted={letter === highlightLetter}
                onPress={() => onKeyPress(letter)}
              />
            ))}
            {isBottomRow && (
              <DeleteKey
                width={modifierWidth}
                disabled={disabled}
                onDelete={onDelete}
              />
            )}
          </View>
        );
      })}

      {/*
        Hint and Submit live inside the keyboard rather than above it, and that
        is a space decision as much as a design one: the whole point of
        replacing the OS keyboard is the vertical budget, and a separate action
        row below the field gives most of it straight back.

        Reusing `Button` rather than styling two more keys keeps the WL-202
        contrast rules, the disabled-label rule, and the press mechanics in the
        one component that already owns them. Submit is the wider of the two —
        it is the action every turn ends in.
      */}
      <View style={styles.actionRow}>
        <Button
          label="Hint"
          variant="secondary"
          disabled={hintDisabled}
          onPress={onHint}
          style={styles.hintButton}
        />
        <Button
          label={submitLabel}
          tone="grape"
          disabled={submitDisabled}
          onPress={onSubmit}
          accessibilityLabel="Submit"
          style={styles.submitButton}
        />
      </View>
    </View>
  );
}

interface KeyProps {
  label: string;
  width: number;
  disabled: boolean;
  highlighted?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
}

/**
 * One key — Design System §4's "Keys" construction.
 *
 * `paper` fill, 2px `ink` border, 3px hard offset shadow, and the press-into-
 * the-page move every other control makes, scaled to this shadow (see
 * `KEY_PRESS_TRANSLATE`).
 */
function Key({
  label,
  width,
  disabled,
  highlighted = false,
  accessibilityLabel,
  onPress,
  onLongPress,
  onPressOut,
}: KeyProps): React.JSX.Element {
  const fill = highlighted ? 'sunbeam' : 'paper';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      delayLongPress={DELETE_REPEAT_DELAY_MS}
      disabled={disabled}
      // RN's dedicated role for exactly this: it stops VoiceOver and TalkBack
      // announcing 26 separate "button"s and lets them treat the group as the
      // keyboard it is. The keyboard is not normally rendered while a screen
      // reader runs (see `usePrefersSystemKeyboard`), but Switch Control and
      // full keyboard access reach it, and they read the same tree.
      accessibilityRole="keyboardkey"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.key,
        { width, backgroundColor: palette[fill] },
        pressed && !disabled
          ? {
              boxShadow: shadow.none,
              transform: [
                { translateX: KEY_PRESS_TRANSLATE },
                { translateY: KEY_PRESS_TRANSLATE },
              ],
            }
          : { boxShadow: shadow.key },
      ]}>
      {/*
        Capped scaling rather than free growth: a key cannot grow with its
        label, because its width comes from the 10-column grid. Past
        `MAX_SYSTEM_KEYBOARD_FONT_SCALE` the screen stops compromising and hands
        typing back to the OS keyboard entirely — see `usePrefersSystemKeyboard`
        for why that is the honest answer rather than shrinking text forever.
      */}
      <Text
        style={[styles.keyLabel, { color: textOn(fill) }]}
        maxFontSizeMultiplier={MAX_KEY_FONT_SCALE}
        adjustsFontSizeToFit
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Delete, with hold-to-repeat.
 *
 * Labelled `DEL` rather than carrying a glyph: the WL-207 icon set has no
 * backspace, and Design System §7 rules out borrowing a generic one — a drawn
 * glyph is a reasonable follow-up, but a monospace label is already in the
 * system, scales, and cannot be misread.
 *
 * The repeat is driven from `onLongPress`/`onPressOut` rather than
 * `onPressIn`, so a plain tap still goes through `onPress` — which is what
 * assistive-technology activation triggers. Wiring the delete to `onPressIn`
 * would have made the key silently unusable from Switch Control.
 */
function DeleteKey({
  width,
  disabled,
  onDelete,
}: {
  width: number;
  disabled: boolean;
  onDelete: () => void;
}): React.JSX.Element {
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeating = useCallback(() => {
    if (repeatRef.current !== null) {
      clearInterval(repeatRef.current);
      repeatRef.current = null;
    }
  }, []);

  // A key unmounted mid-hold (the round ends, the player leaves) would
  // otherwise leave an interval deleting into a dead component forever.
  useEffect(() => stopRepeating, [stopRepeating]);

  const startRepeating = useCallback(() => {
    // `onPress` does not fire when a long press does, so the hold owes the
    // player the first deletion as well as the repeats.
    onDelete();
    stopRepeating();
    repeatRef.current = setInterval(onDelete, DELETE_REPEAT_INTERVAL_MS);
  }, [onDelete, stopRepeating]);

  return (
    <Key
      label="DEL"
      accessibilityLabel="Delete"
      width={width}
      disabled={disabled}
      onPress={onDelete}
      onLongPress={startRepeating}
      onPressOut={stopRepeating}
    />
  );
}

const styles = StyleSheet.create({
  keyboard: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    // Room for the action row's 6px shadow, which is drawn outside the border
    // box and would otherwise be clipped by the screen edge.
    paddingBottom: spacing.md,
    gap: spacing.xs,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  key: {
    height: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    // §4: 2px, the badge weight, not the 3px component default — see the doc
    // for why a 26-key grid at 3px reads as a mesh rather than a set of keys.
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    // §4: keys take `radius.key`, not `radius.control` — 16px on a 32pt-wide
    // key is half its width and comes out a capsule.
    borderRadius: radius.key,
  },
  keyLabel: { ...typeScale.buttonLabel },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  // `Button` sets `alignSelf: 'flex-start'` so it hugs its label; these two
  // share the row instead, with Submit given the larger share.
  hintButton: { flex: 1, alignSelf: 'auto' },
  submitButton: { flex: 2, alignSelf: 'auto' },
});
