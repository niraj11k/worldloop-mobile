import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { normalizeWord, validateMove, getRequiredLetter } from '@features/game/ruleEngine';
import {
  createSession,
  setInput as setSessionInput,
  beginValidation,
  applyValidation,
  beginComputerTurn,
  applyComputerMove,
  applyComputerCannotMove,
  isRoundOver,
  usedWords,
} from '@features/game/gameSession';
import { nextStartingWord } from '@features/game/startingWord';
import { generateCandidates, selectComputerWord } from '@features/difficulty/difficultyEngine';
import { rarityForEntry, scoreWord } from '@features/scoring/scoringEngine';
import { replyCountForLetter } from '@features/dictionary/dictionaryService';
import { INVALID_WORD_MESSAGES, NO_COMPUTER_MOVE_MESSAGE } from '@constants/gameConstants';
import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Input } from '@components/common/Input';
import { Icon } from '@components/common/icons/Icon';
import { ThinkingDots } from '@components/common/motion/ThinkingDots';
import { palette, spacing, shadow, typeScale } from '@theme/theme';
import type { GameStatus, InvalidReason } from '@app-types/game';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

/**
 * Minimum time the "thinking" state stays on screen.
 *
 * Also load-bearing, not just cosmetic: without an await between setting the
 * thinking phase and doing the synchronous candidate work, React batches the
 * two updates and that phase never paints. WL-306 owns the real orchestration
 * (tuned delay, timeout path); this is the smallest version that makes the
 * turn observable.
 */
const COMPUTER_THINK_MS = 350;

/**
 * Minimum time the `valid_move` phase stays on screen before the computer's
 * turn begins.
 *
 * Same load-bearing reason as `COMPUTER_THINK_MS`: `gameSession.applyValidation`
 * computes this phase (word appended to the chain, required letter already
 * advanced, input ready to clear) on every valid submission, but nothing ever
 * painted it before WL-302 — `handleSubmit` built the next state
 * (`computer_thinking`) and called `setSession` only once, so React batched
 * past it. This is a distinct constant from `COMPUTER_THINK_MS` on purpose:
 * it is the minimum needed to make Wireframe section 9's "valid move" state
 * individually reachable, not turn pacing — WL-306 owns pacing, and WL-305's
 * real stamp-in animation will likely make this redundant later.
 */
const VALID_MOVE_DISPLAY_MS = 200;

/** Only reachable if the bundled dictionary is missing or corrupt (WL-112). */
const FALLBACK_STARTING_WORD = 'apple';

/**
 * Round-over copy for the two statuses Wireframe section 9's "No computer
 * move" state actually describes (`player_win` and `draw` — both are caused
 * by the computer having no legal word; see `gameSession.ts`'s status
 * mapping) lives in `NO_COMPUTER_MOVE_MESSAGE` instead, rendered by its own
 * branch below. This table only covers the other three, which section 9
 * doesn't name and WL-308 hasn't designed yet.
 */
const ROUND_OVER_MESSAGES: Record<
  Exclude<GameStatus, 'active' | 'player_win' | 'draw'>,
  string
> = {
  computer_win: 'WordLoop wins — no words left beginning with that letter.',
  abandoned: 'Round ended.',
  technical_failure: 'Something went wrong, so this round had to stop.',
};

/**
 * Game screen — the core loop. Highest design/implementation priority
 * per Wireframe doc section 21 ("game screen should be designed first").
 *
 * Spec: Wireframe doc sections 8-10.
 * Required elements: back/pause controls, difficulty indicator, score,
 * chain length, current word, required letter (must be visually prominent
 * — Wireframe doc "key interaction rule"), input, submit, hint, recent
 * chain, turn indicator, computer-thinking loading state.
 *
 * Round state lives in the WL-110 session machine rather than in loose
 * useState, so the screen only renders and forwards events.
 *
 * Layout done (WL-301): the required-letter callout is the largest text
 * element on screen (Design System section 6) and the screen composes the
 * real WL-204/205/207 component set rather than bare RN primitives.
 *
 * All seven Wireframe section 9 states are individually reachable (WL-302),
 * including the two that weren't painted before this task —
 * `valid_move` and `no_computer_move` — see `VALID_MOVE_DISPLAY_MS` and the
 * round-over branch below for why. Still pending: keyboard avoidance and the
 * TextInput desync check (WL-303), auditing the exact invalid-word copy
 * word-for-word (WL-304), the animated no-reflow chain (WL-305), tuned
 * think-delay/timeout (WL-306), and the full 5-state game-over screen
 * (WL-308) — today's round-over branch is two minimal messages-plus-action,
 * not that.
 *
 * Not yet wired: hint sheet, definition overlay, and persistence (WL-403) —
 * the last of which is also what will supply the personal-best baseline the
 * round-end bonus needs (WL-402).
 */
export function GameScreen({ route, navigation }: Props): React.JSX.Element {
  const { difficulty } = route.params;

  const [session, setSession] = useState(() =>
    createSession({
      sessionId: `local-${Date.now()}`,
      difficulty,
      // `null` means no letter in the dictionary could offer a usable
      // opening word, which with the bundled asset means the asset itself is
      // missing or corrupt. Falling back keeps the round playable rather
      // than dead; surfacing it as the Wireframe section 17 "dictionary
      // unavailable" state is WL-506's, and the game-over treatment
      // WL-308's. `apple` is Wireframe section 7's own teaching word.
      startingWord: nextStartingWord() ?? FALLBACK_STARTING_WORD,
    }),
  );
  const [input, setInput] = useState('');
  const [errorReason, setErrorReason] = useState<InvalidReason | null>(null);
  const [showFullChain, setShowFullChain] = useState(false);

  const lastMove = session.chain[session.chain.length - 1];
  const roundOver = isRoundOver(session);
  const busy =
    session.phase === 'validating' ||
    session.phase === 'valid_move' ||
    session.phase === 'computer_thinking';

  const handleSubmit = async () => {
    if (roundOver || busy || normalizeWord(input).length === 0) {
      return;
    }

    const validating = beginValidation(session);
    setSession(validating);

    const result = await validateMove({
      rawInput: input,
      requiredLetter: validating.requiredLetter,
      usedWords: usedWords(validating),
    });

    const afterPlayer = applyValidation(validating, {
      submittedWord: input,
      result,
      scoreAwarded:
        result.entry === null
          ? 0
          : scoreWord({
              wordLength: result.normalizedWord.length,
              rarity: rarityForEntry(result.entry),
              // TODO(WL-307): the hint sheet is the only thing that can set
              // these; until it exists no turn can carry a penalty.
              hintUsed: false,
              hintRevealedWord: false,
            }),
    });
    if (!result.isValid) {
      setErrorReason(result.reason);
      setSession(afterPlayer);
      return;
    }

    setErrorReason(null);
    setInput('');
    // Paint `valid_move` (Wireframe section 9) before moving on — see
    // `VALID_MOVE_DISPLAY_MS`'s docblock for why this can't be skipped.
    setSession(afterPlayer);
    await new Promise<void>(resolve => {
      setTimeout(resolve, VALID_MOVE_DISPLAY_MS);
    });

    const thinking = beginComputerTurn(afterPlayer);
    setSession(thinking);
    await new Promise<void>(resolve => {
      setTimeout(resolve, COMPUTER_THINK_MS);
    });

    const usedAfterPlayer = usedWords(thinking);
    const choice = selectComputerWord(
      generateCandidates({ requiredLetter: thinking.requiredLetter, usedWords: usedAfterPlayer }),
      difficulty,
    );

    if (choice === null) {
      // Player wins unless the letter is dead for the wider player set too,
      // which is a draw (WL-110).
      setSession(
        applyComputerCannotMove(thinking, {
          playerRepliesRemaining: replyCountForLetter(thinking.requiredLetter, usedAfterPlayer),
        }),
      );
      return;
    }

    const usedAfterComputer = new Set(usedAfterPlayer).add(choice.word);
    setSession(
      applyComputerMove(thinking, {
        word: choice.word,
        playerRepliesRemaining: replyCountForLetter(
          getRequiredLetter(choice.word),
          usedAfterComputer,
        ),
      }),
    );
  };

  const errorMessage =
    errorReason === null
      ? null
      : INVALID_WORD_MESSAGES[errorReason].replace(
          '{letter}',
          session.requiredLetter.toUpperCase(),
        );

  const submitDisabled = busy || normalizeWord(input).length === 0;
  const chainToShow = showFullChain ? session.chain : session.chain.slice(-6);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={spacing.sm}>
          <Icon name="back" />
        </Pressable>
        <Badge label={difficulty.toUpperCase()} />
        {/*
          Not yet a control — WL-404 builds the Pause screen and wires this up.
          Rendered without a Pressable on purpose, so it does not advertise a
          tap target that does nothing.
        */}
        <Icon name="pause" />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.statsRow}>
          Chain: {session.chain.length} words · Score: {session.score}
        </Text>

        {/* Whose word is on the board, rather than a hardcoded label. */}
        <View style={styles.currentWordRow}>
          {session.phase === 'computer_thinking' ? (
            <>
              <Text style={styles.turnLabel}>WordLoop is thinking…</Text>
              <ThinkingDots accessibilityLabel="WordLoop is thinking" />
            </>
          ) : (
            <>
              <Text style={styles.turnLabel}>
                {lastMove?.actor === 'player' ? 'You' : 'WordLoop'}
              </Text>
              <Text style={styles.currentWord}>{session.currentWord.toUpperCase()}</Text>
            </>
          )}
        </View>

        {roundOver ? (
          session.status === 'player_win' || session.status === 'draw' ? (
            // Wireframe section 9's "No computer move" state — both statuses
            // are caused by the computer having no legal word (see
            // `gameSession.ts`'s status mapping). "Finish Round" returns to
            // Home as a placeholder; WL-308 replaces this whole branch with
            // the real 3-action game-over screen.
            <Card style={styles.roundOverCard}>
              <Text style={styles.roundOverMessage}>{NO_COMPUTER_MOVE_MESSAGE}</Text>
              <Button
                label="Finish Round"
                tone="grape"
                onPress={() => navigation.navigate('Home')}
              />
            </Card>
          ) : (
            <Card style={styles.roundOverCard}>
              <Text style={styles.roundOverMessage}>
                {
                  ROUND_OVER_MESSAGES[
                    session.status as Exclude<GameStatus, 'active' | 'player_win' | 'draw'>
                  ]
                }
              </Text>
            </Card>
          )
        ) : (
          <>
            {/*
              Design System section 6: the required letter is the single
              largest element on screen — largest type in the scale, heaviest
              shadow on the screen (shadow.modal, not the default Card
              shadow.card), never rotated.
            */}
            <Card fill="bubblegum" style={styles.requiredLetterCard}>
              <Text style={styles.requiredLetterLabel}>Required letter</Text>
              <Text style={styles.requiredLetter}>
                {session.requiredLetter.toUpperCase()}
              </Text>
            </Card>

            <View style={styles.chainSection}>
              <Text style={styles.chainText}>
                {chainToShow.map(move => move.normalizedWord).join(' → ')}
              </Text>
              {session.chain.length > 6 && (
                <Button
                  label={showFullChain ? 'Hide previous words' : 'View previous words'}
                  variant="secondary"
                  onPress={() => setShowFullChain(current => !current)}
                />
              )}
            </View>

            <Input
              accessibilityLabel="Your word"
              value={input}
              onChangeText={text => {
                setInput(text);
                setSession(current => setSessionInput(current, text));
              }}
              editable={!busy}
              autoFocus
              // Doubles as Wireframe section 9's "input_empty" state message
              // ("Enter a word beginning with E") — a placeholder is only ever
              // visible while the field is empty, which is exactly that phase,
              // so no separate message element is needed here.
              placeholder={`Enter a word beginning with ${session.requiredLetter.toUpperCase()}`}
              error={session.phase === 'invalid_word' ? errorMessage : null}
              style={styles.input}
            />

            {session.phase === 'validating' && (
              <Text style={styles.statusMessage}>Checking word…</Text>
            )}

            <View style={styles.actionsRow}>
              <Button
                label={session.phase === 'validating' ? 'Checking…' : 'Submit'}
                onPress={handleSubmit}
                disabled={submitDisabled}
                tone="grape"
              />
              <Button
                label="Hint"
                variant="secondary"
                onPress={() => {
                  /* TODO(WL-307): open Hint bottom sheet */
                }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  statsRow: { ...typeScale.body, color: palette.ink },
  currentWordRow: { alignItems: 'center', gap: spacing.xs },
  turnLabel: { ...typeScale.body, color: palette.ink },
  currentWord: { ...typeScale.chainWord, color: palette.ink },
  // Design System section 6: the required-letter card carries the heaviest
  // shadow on the screen. Card only exposes the default `shadow.card` (7px),
  // so the heavier `shadow.modal` (11px) is applied here rather than adding a
  // shadow prop to Card for this one caller. Never rotated (no `rotation`
  // prop) — section 3 reserves rotation for decorative elements, and this is
  // the single most important piece of information on the screen.
  requiredLetterCard: {
    alignItems: 'center',
    boxShadow: shadow.modal,
  },
  requiredLetterLabel: { ...typeScale.body, color: palette.ink },
  requiredLetter: { ...typeScale.requiredLetter, color: palette.ink },
  chainSection: { alignItems: 'center', gap: spacing.sm },
  chainText: { ...typeScale.chainWord, color: palette.ink, textAlign: 'center' },
  input: { width: '100%' },
  statusMessage: { ...typeScale.body, color: palette.ink, textAlign: 'center' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  roundOverCard: { alignItems: 'center' },
  roundOverMessage: { ...typeScale.screenTitle, color: palette.ink, textAlign: 'center' },
});
