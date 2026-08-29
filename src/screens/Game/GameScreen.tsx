import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import type { TextInput } from 'react-native';
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
  abandonSession,
  chargeHint,
  isRoundInProgress,
  isRoundOver,
  usedWords,
} from '@features/game/gameSession';
import { nextStartingWord } from '@features/game/startingWord';
import { generateCandidates, selectComputerWord } from '@features/difficulty/difficultyEngine';
import { rarityForEntry, scoreWord } from '@features/scoring/scoringEngine';
import { replyCountForLetter, exampleWordForHint } from '@features/dictionary/dictionaryService';
import {
  INVALID_WORD_MESSAGES,
  COMPUTER_TIMEOUT_MESSAGE,
  DISCARD_ROUND_CONFIRM,
  HINT_LIMIT_PER_ROUND,
  RESTART_ROUND_CONFIRM,
} from '@constants/gameConstants';
import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ConfirmSheet } from '@components/common/ConfirmSheet';
import { Input } from '@components/common/Input';
import { IconButton } from '@components/common/IconButton';
import { SpringIn } from '@components/common/motion/SpringIn';
import { ThinkingDots } from '@components/common/motion/ThinkingDots';
import { HintSheet } from '@components/game/HintSheet';
import { GameOverPanel } from '@components/game/GameOverPanel';
import { PauseSheet } from '@components/game/PauseSheet';
import { useConfirmBeforeLeave } from '@hooks/useConfirmBeforeLeave';
import { announceForAccessibility } from '@utils/accessibility';
import { useProfileStore } from '@store/useProfileStore';
import { useSavedRoundStore } from '@store/useSavedRoundStore';
import {
  palette,
  spacing,
  shadow,
  typeScale,
  displayTextProps,
  CONTENT_MAX_WIDTH,
} from '@theme/theme';
import type { GameSessionState, InvalidReason } from '@app-types/game';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

/**
 * Minimum time the "thinking" state stays on screen.
 *
 * Also load-bearing, not just cosmetic: without an await between setting the
 * thinking phase and doing the synchronous candidate work, React batches the
 * two updates and that phase never paints. No doc gives a figure to tune this
 * against — real timing tuning is a dedicated pass (WL-605), same posture
 * `theme/motion.ts` takes for its own untuned first-pass values.
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
 * individually reachable, not turn pacing — WL-305's stamp-in animation
 * likely makes this redundant eventually.
 */
const VALID_MOVE_DISPLAY_MS = 200;

/**
 * Wireframe section 17's "computer response timeout" threshold — past this,
 * the thinking state gives way to "WordLoop is taking longer than expected"
 * with Try Again / End Round.
 *
 * Explicitly untuned, like `COMPUTER_THINK_MS`: no doc gives a figure. Unlike
 * that constant, this one also can't fire during real play today — the
 * computer's work is synchronous JS with no network or real async risk, and
 * WL-108/109 measured it well under 60ms worst-case on real hardware. It
 * exists as a safety net (a slower device, or a future async dictionary
 * lookup), the same reason `technical_failure` exists for a corrupt
 * dictionary asset without normally occurring. 5s is a common "something is
 * wrong" UX threshold, not derived from any measurement.
 */
const COMPUTER_TURN_TIMEOUT_MS = 5000;

/** Sentinel distinguishing "the timeout won the race" from a real result. */
const COMPUTER_TURN_TIMED_OUT = Symbol('computer-turn-timed-out');

/** Only reachable if the bundled dictionary is missing or corrupt (WL-112). */
const FALLBACK_STARTING_WORD = 'apple';

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
 * round-over branch below for why. Keyboard avoidance and the TextInput
 * desync fix are in (WL-303); invalid-word copy is audited exact against
 * Wireframe section 10 (WL-304); the chain stamps in without reflowing older
 * entries (WL-305); the computer's turn has a minimum think delay and
 * Wireframe section 17's timeout/retry path (WL-306, see
 * `COMPUTER_TURN_TIMEOUT_MS`); the hint sheet is wired (WL-307); and the
 * round-over branch is `GameOverPanel`, covering all five Wireframe section
 * 14 result states (WL-308).
 *
 * The round both reads from and writes to the guest profile (WL-402) — the
 * personal-best baseline comes in at session creation and a finished round is
 * folded back in once — and is saved after every change so it survives the
 * app being killed (WL-403). Pause is wired to the four Wireframe section 13
 * actions (WL-404). Not yet wired: the definition overlay (Phase 5).
 */
export function GameScreen({ route, navigation }: Props): React.JSX.Element {
  const { difficulty } = route.params;
  const recordRound = useProfileStore(state => state.recordRound);
  const saveRound = useSavedRoundStore(state => state.save);
  const clearSavedRound = useSavedRoundStore(state => state.clear);

  /*
    WL-403: Home's "Resume Game" arrives with `resume`, and the round it
    refers to is whatever the launch load put in the store — already
    phase-normalized by `restoreSession`, so a round killed mid-computer-turn
    comes back as `computer_thinking` and the effect below finishes the turn
    the dead process started.

    Read through `getState()` for the same reason as the profile baseline:
    this decides what the round *is*, once, at mount. A `resume` that finds no
    saved round (cleared on another screen, or unreadable) falls through to a
    new round rather than failing — the player asked to play.
  */
  const resumed = route.params.resume === true ? useSavedRoundStore.getState().saved : null;

  const [session, setSession] = useState(
    () =>
      resumed ??
      createSession({
        sessionId: `local-${Date.now()}`,
        difficulty,
        /*
          WL-402's baseline for the round-end personal-best bonus, read once,
          here, rather than subscribed to: `previousBestChainLength` is
          defined as the value *at session creation* (WL-111), so a best
          recorded while this round is in play must not move the bar
          mid-round. `getState()` rather than the hook keeps it a snapshot.

          `null` while the profile is still loading, which is the documented
          "no baseline known" case and awards no milestone — distinct from a
          real best of 0, which a first round beats.
        */
        previousBestChainLength: useProfileStore.getState().profile?.bests.chainLength ?? null,
        // `null` means no letter in the dictionary could offer a usable
        // opening word, which with the bundled asset means the asset itself
        // is missing or corrupt. Falling back keeps the round playable rather
        // than dead; surfacing it as the Wireframe section 17 "dictionary
        // unavailable" state is WL-506's, and the game-over treatment
        // WL-308's. `apple` is Wireframe section 7's own teaching word.
        startingWord: nextStartingWord() ?? FALLBACK_STARTING_WORD,
      }),
  );
  const [input, setInput] = useState('');
  const [errorReason, setErrorReason] = useState<InvalidReason | null>(null);
  const [showFullChain, setShowFullChain] = useState(false);
  const [computerTimedOut, setComputerTimedOut] = useState(false);
  const [hintSheetVisible, setHintSheetVisible] = useState(false);
  /** WL-404: Wireframe section 13's pause sheet, and Restart's confirmation. */
  const [pauseSheetVisible, setPauseSheetVisible] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  /**
   * Whether the hint sheet was used this turn — carried through an invalid
   * resubmission (only a genuine new turn resets it, below) so the penalty
   * still applies to whichever submission this turn eventually succeeds.
   */
  const [hintUsedThisTurn, setHintUsedThisTurn] = useState(false);

  const inputRef = useRef<TextInput>(null);
  /**
   * The word actually submitted always comes from here, not from `input`
   * state — Wireframe section 9 flagged a real controlled-`TextInput` failure
   * mode (the native field can visibly hold more text than React's state has
   * committed yet under fast input) and prescribed exactly this fix: source
   * the submitted value from the change event, synchronously, rather than
   * from state. `input` remains the source of truth for everything
   * render-driven (the field's `value`, `submitDisabled`) — only the act of
   * submitting reads this ref.
   */
  const latestInputRef = useRef('');
  /**
   * A round is folded into the profile exactly once (WL-402). The guard is a
   * ref rather than state because it must not cause a render, and because
   * every path that ends a round — a win, a block, a draw, the timeout's End
   * Round, the discard confirmation — converges on the same record.
   */
  const roundRecordedRef = useRef(false);

  const lastMove = session.chain[session.chain.length - 1];
  const roundOver = isRoundOver(session);
  /** Is there anything here the player would mind losing? (WL-401) */
  const roundInProgress = isRoundInProgress(session);
  /**
   * WL-401: every route off this screen — the header back control, Android's
   * hardware back button, the iOS swipe-back gesture, Game Over's own Home /
   * Play Again, and Pause's Exit to Home (WL-404) — is held here until the
   * player confirms, for as long as there is a round to lose.
   * `isRoundInProgress` goes false the moment the round ends, so the
   * game-over actions are never gated behind a dialog asking about a round
   * that is already finished.
   */
  const { confirmVisible, confirmLeave, cancelLeave } =
    useConfirmBeforeLeave(roundInProgress);
  const busy =
    session.phase === 'validating' ||
    session.phase === 'valid_move' ||
    session.phase === 'computer_thinking';

  // Wireframe section 9: "autofocus on turn start." `Input` is one long-lived
  // instance for the whole round, so the `autoFocus` prop (mount-only) only
  // ever covers the first turn — `input_empty` is set both at round start and
  // after every computer move, i.e. exactly "turn start."
  useEffect(() => {
    if (session.phase === 'input_empty') {
      inputRef.current?.focus();
      // WL-307: a hint used on a prior turn must not discount this one.
      setHintUsedThisTurn(false);
    }
  }, [session.phase]);

  /**
   * WL-408: says out loud whose turn it is, on iOS.
   *
   * The turn changes without the player doing anything — the computer
   * answers by itself — and VoiceOver has no live region to notice that
   * with (`accessibilityLiveRegion` is Android-only, and the turn row carries
   * one for TalkBack). Without this, a screen-reader user submits a word and
   * hears nothing until they hunt for what changed.
   *
   * Only the two phases that *are* a turn change: the computer starting to
   * think, and the board coming back to the player. The transient phases in
   * between are the same turn still resolving, and announcing them would talk
   * over the player.
   */
  useEffect(() => {
    if (roundOver) return;
    if (session.phase === 'computer_thinking') {
      announceForAccessibility('WordLoop is thinking');
    } else if (session.phase === 'input_empty') {
      announceForAccessibility(
        `Your turn. Enter a word beginning with ${session.requiredLetter.toUpperCase()}.`,
      );
    }
  }, [session.phase, session.requiredLetter, roundOver]);

  /**
   * WL-403: the round is written after every change — a turn resolving, a
   * hint charged, a word rejected.
   *
   * "Save after every turn" is the requirement; saving on every state change
   * is the same thing with fewer places to forget one, and the write is a
   * synchronous MMKV set of a few hundred bytes. It has to be eager rather
   * than on the way out, because the exits this protects against — a
   * force-quit, an OS eviction, a crash — give the app no chance to run
   * anything on the way out.
   *
   * A finished round clears the slot instead of saving; the store enforces
   * that, so there is no ordering to get wrong between this and the recording
   * effect below.
   */
  useEffect(() => {
    saveRound(session);
  }, [session, saveRound]);

  /**
   * WL-403: finish the computer's turn if the app was killed during it.
   *
   * `restoreSession` puts such a round back in `computer_thinking` — the
   * player's word is already in the chain and a reply is owed. Without this
   * the round would restore with the thinking indicator up and nothing ever
   * arriving. Mount-only: any later `computer_thinking` is driven by
   * `handleSubmit`, which runs the turn itself.
   */
  useEffect(() => {
    if (resumed?.phase === 'computer_thinking') {
      attemptComputerTurn(resumed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * WL-402: the finished round goes into the profile — games played, bests,
   * streak, history, and the words the player found.
   *
   * In an effect rather than at each ending because the endings are computed
   * in four different places (`applyComputerMove`'s block,
   * `applyComputerCannotMove`, the timeout's End Round, and `failSession`);
   * watching `status` catches all of them, including any added later.
   */
  useEffect(() => {
    if (!roundOver || roundRecordedRef.current) return;
    roundRecordedRef.current = true;
    recordRound(session);
  }, [roundOver, session, recordRound]);

  // WL-307: the sheet's data. Depends on the whole `session` object (its
  // identity only changes on a real `setSession`, e.g. a turn resolving —
  // not on `setInput`), so this skips recomputing on every keystroke
  // re-render without needing a narrower, lint-unsafe dependency list.
  const hintWordCount = useMemo(
    () => replyCountForLetter(session.requiredLetter, usedWords(session)),
    [session],
  );
  const hintExampleWord = useMemo(
    () => exampleWordForHint(session.requiredLetter, usedWords(session)),
    [session],
  );

  /**
   * The computer's actual turn: the think delay, candidate generation, and
   * selection, returning the next session state rather than applying it —
   * that split is what lets `attemptComputerTurn` retry this from the same
   * `thinkingSession` without duplicating the logic.
   */
  const runComputerTurn = async (
    thinkingSession: GameSessionState,
  ): Promise<GameSessionState> => {
    await new Promise<void>(resolve => {
      setTimeout(resolve, COMPUTER_THINK_MS);
    });

    const usedAfterPlayer = usedWords(thinkingSession);
    const choice = selectComputerWord(
      generateCandidates({
        requiredLetter: thinkingSession.requiredLetter,
        usedWords: usedAfterPlayer,
      }),
      difficulty,
    );

    if (choice === null) {
      // Player wins unless the letter is dead for the wider player set too,
      // which is a draw (WL-110).
      return applyComputerCannotMove(thinkingSession, {
        playerRepliesRemaining: replyCountForLetter(
          thinkingSession.requiredLetter,
          usedAfterPlayer,
        ),
      });
    }

    const usedAfterComputer = new Set(usedAfterPlayer).add(choice.word);
    return applyComputerMove(thinkingSession, {
      word: choice.word,
      playerRepliesRemaining: replyCountForLetter(
        getRequiredLetter(choice.word),
        usedAfterComputer,
      ),
    });
  };

  /**
   * Races the computer's turn against Wireframe section 17's timeout. If the
   * timeout wins, `runComputerTurn`'s promise is simply never read again —
   * harmless, since nothing else awaits it — and the screen offers Try Again
   * (calls this again with the same `thinkingSession`) or End Round.
   */
  const attemptComputerTurn = async (thinkingSession: GameSessionState) => {
    setComputerTimedOut(false);

    const result = await Promise.race([
      runComputerTurn(thinkingSession),
      new Promise<typeof COMPUTER_TURN_TIMED_OUT>(resolve => {
        setTimeout(() => resolve(COMPUTER_TURN_TIMED_OUT), COMPUTER_TURN_TIMEOUT_MS);
      }),
    ]);

    if (result === COMPUTER_TURN_TIMED_OUT) {
      setComputerTimedOut(true);
      return;
    }
    setSession(result);
  };

  const handleSubmit = async () => {
    const submitted = latestInputRef.current;
    if (roundOver || busy || normalizeWord(submitted).length === 0) {
      return;
    }

    const validating = beginValidation(session);
    setSession(validating);

    const result = await validateMove({
      rawInput: submitted,
      requiredLetter: validating.requiredLetter,
      usedWords: usedWords(validating),
    });

    const afterPlayer = applyValidation(validating, {
      submittedWord: submitted,
      result,
      hintUsed: hintUsedThisTurn,
      scoreAwarded:
        result.entry === null
          ? 0
          : scoreWord({
              wordLength: result.normalizedWord.length,
              rarity: rarityForEntry(result.entry),
              hintUsed: hintUsedThisTurn,
              // WL-307's sheet only ever gives levels 1-3 (letter, count,
              // example) — none of which hand over the exact required word,
              // so this task never reaches the -10 tier. See the Delivery
              // Plan's WL-307 note for why (short version: even WL-504's
              // level 4 stays at -5, so nothing in the 1-4 set triggers it).
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
    latestInputRef.current = '';
    // Paint `valid_move` (Wireframe section 9) before moving on — see
    // `VALID_MOVE_DISPLAY_MS`'s docblock for why this can't be skipped.
    setSession(afterPlayer);
    await new Promise<void>(resolve => {
      setTimeout(resolve, VALID_MOVE_DISPLAY_MS);
    });

    const thinking = beginComputerTurn(afterPlayer);
    setSession(thinking);
    await attemptComputerTurn(thinking);
  };

  /**
   * Wireframe section 13's Restart, after the player confirms it (WL-404).
   *
   * Rebuilds the round in place rather than re-entering the route: a
   * `replace('Game', …)` would remove this screen, which WL-401's guard would
   * intercept with "Leave this round?" — a second dialog asking about the
   * round the player has just agreed to give up. Everything a round owns is
   * reset here, including the two refs, so the new round is indistinguishable
   * from one started from the Difficulty screen.
   *
   * The round being replaced is recorded as `abandoned` first, the same way
   * leaving records it (WL-402) — a round given up is a round given up,
   * whichever control did it. `previousBestChainLength` is re-read for the
   * new round, since a best set since this screen mounted should count
   * against the round starting now.
   */
  const handleRestart = () => {
    if (!roundRecordedRef.current) {
      recordRound(abandonSession(session));
    }
    roundRecordedRef.current = false;

    setSession(
      createSession({
        sessionId: `local-${Date.now()}`,
        difficulty,
        previousBestChainLength: useProfileStore.getState().profile?.bests.chainLength ?? null,
        startingWord: nextStartingWord() ?? FALLBACK_STARTING_WORD,
      }),
    );
    setInput('');
    latestInputRef.current = '';
    setErrorReason(null);
    setShowFullChain(false);
    setComputerTimedOut(false);
    setHintUsedThisTurn(false);
    setConfirmRestart(false);
  };

  /**
   * Wireframe section 17: End Round from the timeout state. Resets
   * `computerTimedOut` explicitly — `currentWordRow` renders unconditionally
   * (outside the `roundOver` branch), so without this the timeout UI and the
   * round-over card would render at the same time once `abandonSession`
   * flips `roundOver` true.
   */
  const handleEndRoundAfterTimeout = () => {
    setComputerTimedOut(false);
    setSession(abandonSession(session));
  };

  /**
   * The player chose to leave a round in progress (WL-401's confirmation).
   *
   * Records it as `abandoned` before replaying the held navigation action —
   * the gap WL-401 left open and WL-402 closes. The screen is about to
   * unmount, so this deliberately does not `setSession`: the state is written
   * to the profile, not to a component that is going away. `recordRound` is
   * not awaited for the same reason, and does not need to be — the write
   * underneath is synchronous MMKV.
   *
   * An abandoned round still lands in the history and still keeps any words
   * the player found; it just doesn't count as a game played, doesn't touch
   * a best, and doesn't break the streak (see `recordRoundCompleted`).
   */
  const handleConfirmLeave = () => {
    if (!roundRecordedRef.current) {
      roundRecordedRef.current = true;
      recordRound(abandonSession(session));
    }
    // WL-403: and it is gone for good. Leaving deliberately is the player
    // ending the round — the save slot exists for exits they did not choose
    // (see the WL-403 note in the Delivery Plan), so it must not quietly
    // offer this round back on Home afterwards, having just told the player
    // it would be lost.
    clearSavedRound();
    confirmLeave();
  };

  /**
   * Wireframe section 11: charges the round's hint limit the moment the
   * player commits (`[Use Hint]`), not deferred to whatever they eventually
   * submit — matching the sheet's own "reduces your available hints by one"
   * copy. `hintUsedThisTurn` is what `handleSubmit` reads to apply the -5
   * penalty to this turn's eventual score.
   */
  const handleUseHint = () => {
    setSession(chargeHint(session));
    setHintUsedThisTurn(true);
    setHintSheetVisible(false);
  };

  const errorMessage =
    errorReason === null
      ? null
      : INVALID_WORD_MESSAGES[errorReason].replace(
          '{letter}',
          session.requiredLetter.toUpperCase(),
        );

  const submitDisabled = busy || normalizeWord(input).length === 0;
  // Wireframe section 9: "Hint: enabled if available." Reusing the app's
  // existing disabled-control language for "unavailable" (Submit, Try Again)
  // rather than a separate "hint limit" message — see the WL-307 Delivery
  // Plan note for why that's a deliberate simplification of Flow E.
  const hintDisabled = busy || roundOver || session.hintsUsed >= HINT_LIMIT_PER_ROUND;
  const chainToShow = showFullChain ? session.chain : session.chain.slice(-6);
  // Keyed to the actual newest move, not "whichever entry renders last" —
  // toggling "View previous words" must never animate anything (see
  // SpringIn's own docblock on this exact constraint).
  const latestMoveId = session.chain[session.chain.length - 1]?.moveId;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton
          name="back"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        />
        <Badge label={difficulty.toUpperCase()} />
        {/*
          WL-404. Unavailable while a turn is resolving, and that is doing
          real work rather than being fussy: `attemptComputerTurn` has a
          promise in flight that will `setSession` an absolute value when it
          lands, so a Restart taken mid-turn would be overwritten seconds
          later by the round it just replaced. Blocking the entry point makes
          that unreachable, and it is also the nearest thing this build has to
          Wireframe section 13's "pause computer timers if timers are added
          later" — the only live timer is that turn.

          The window is one turn (a few hundred milliseconds), and the control
          keeps its glyph while disabled — see `IconButton` for why that is a
          Design System gap rather than an oversight, and what carries the
          state instead (WL-408).
        */}
        <IconButton
          name="pause"
          accessibilityLabel="Pause"
          disabled={busy || roundOver}
          onPress={() => setPauseSheetVisible(true)}
        />
      </View>

      {/*
        Wireframe section 19: input and Submit must stay visible above the
        keyboard. The header sits outside this so it never shifts — only the
        scrollable game content moves. Android already sets
        `windowSoftInputMode="adjustResize"` in the manifest, so pairing that
        with an app-level `padding` behavior here would double-offset the
        content; `undefined` on Android leaves the OS-level resize as the only
        mechanism, which is the standard RN pairing.
      */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.statsRow}>
            Chain: {session.chain.length} words · Score: {session.score}
          </Text>

          {/*
            Whose word is on the board, rather than a hardcoded label.

            WL-408: a live region, because whose turn it is changes without
            the player touching anything — the computer replies on its own,
            and a screen-reader user would otherwise submit a word and hear
            nothing until they went looking. `polite` rather than
            `assertive`: a turn change should not interrupt the error message
            the player may still be listening to. TalkBack reads this node on
            change; VoiceOver has no equivalent, so the effect above announces
            the same thing on iOS.
          */}
          <View
            style={styles.currentWordRow}
            accessibilityLiveRegion="polite">
            {computerTimedOut ? (
              // Wireframe section 17: "computer response timeout."
              <>
                <Text style={styles.turnLabel}>{COMPUTER_TIMEOUT_MESSAGE}</Text>
                <View style={styles.actionsRow}>
                  <Button
                    label="Try Again"
                    tone="grape"
                    onPress={() => attemptComputerTurn(session)}
                  />
                  <Button
                    label="End Round"
                    variant="secondary"
                    onPress={handleEndRoundAfterTimeout}
                  />
                </View>
              </>
            ) : session.phase === 'computer_thinking' ? (
              <>
                <Text style={styles.turnLabel}>WordLoop is thinking…</Text>
                <ThinkingDots accessibilityLabel="WordLoop is thinking" />
              </>
            ) : (
              <>
                <Text style={styles.turnLabel}>
                  {lastMove?.actor === 'player' ? 'You' : 'WordLoop'}
                </Text>
                <Text {...displayTextProps} style={styles.currentWord}>{session.currentWord.toUpperCase()}</Text>
              </>
            )}
          </View>

          {roundOver ? (
            <GameOverPanel
              session={session}
              /*
                `popTo`, not `navigate` (WL-401). In React Navigation 7 a
                `navigate` to a route that is not the current one *pushes*
                rather than returning to the existing instance, so playing
                three rounds left a Home → Difficulty → Game → Difficulty →
                Game → … stack behind the player, and Android back walked
                back through every finished round. `popTo` unwinds to the
                instance already on the stack, which is also what Wireframe
                section 2's flat Home → Difficulty → Game structure describes.
              */
              onPlayAgain={() => navigation.popTo('Difficulty')}
              onHome={() => navigation.popTo('Home')}
              onReviewWords={() =>
                navigation.navigate('WordReview', { sessionId: session.sessionId })
              }
            />
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
                {/*
                  WL-408, the risk the Delivery Plan flagged for this task:
                  64px at iOS's largest accessibility size is a ~200px glyph
                  on a 375pt phone. Two guards, because either alone leaves a
                  hole — `displayTextProps` caps the growth at 1.5x (see
                  `MAX_DISPLAY_FONT_SCALE` for why that number is still
                  enormous), and `adjustsFontSizeToFit` shrinks whatever is
                  left to fit the card rather than letting it clip. The letter
                  stays by far the largest thing on the screen either way,
                  which is Design System section 6's actual requirement.
                */}
                <Text
                  {...displayTextProps}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.requiredLetter}>
                  {session.requiredLetter.toUpperCase()}
                </Text>
              </Card>

              <View style={styles.chainSection}>
                {/*
                  Design System section 5: a valid word "stamps" onto the
                  chain with a small scale-in, and existing entries must not
                  reflow or animate. Each entry is its own keyed node (by
                  `moveId`) so only the genuinely newest one — never whichever
                  happens to render last, which the "View previous words"
                  toggle would otherwise get wrong — mounts inside `SpringIn`.
                  Older entries keep the same key and element type across
                  renders, so React never remounts (and never replays) them.
                  Grouped with one accessibility label so a screen reader
                  hears the chain as a phrase, not N fragments.
                */}
                <View
                  style={styles.chainRow}
                  accessible
                  accessibilityLabel={chainToShow
                    .map(move => move.normalizedWord)
                    .join(', ')}>
                  {chainToShow.map((move, index) => {
                    const word = <Text {...displayTextProps} style={styles.chainText}>{move.normalizedWord}</Text>;
                    return (
                      <React.Fragment key={move.moveId}>
                        {index > 0 && <Text {...displayTextProps} style={styles.chainText}> → </Text>}
                        {move.moveId === latestMoveId ? <SpringIn>{word}</SpringIn> : word}
                      </React.Fragment>
                    );
                  })}
                </View>
                {session.chain.length > 6 && (
                  <Button
                    label={showFullChain ? 'Hide previous words' : 'View previous words'}
                    variant="secondary"
                    onPress={() => setShowFullChain(current => !current)}
                  />
                )}
              </View>

              <Input
                ref={inputRef}
                accessibilityLabel="Your word"
                value={input}
                onChangeText={text => {
                  latestInputRef.current = text;
                  setInput(text);
                  setSession(current => setSessionInput(current, text));
                }}
                editable={!busy}
                autoFocus
                // Wireframe section 8: submit via the keyboard's return key,
                // not just the Submit button.
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
                // Doubles as Wireframe section 9's "input_empty" state message
                // ("Enter a word beginning with E") — a placeholder is only
                // ever visible while the field is empty, which is exactly
                // that phase, so no separate message element is needed here.
                // Trimming and case-folding (section 8's other two bullets)
                // already happen in `ruleEngine.normalizeWord`, run inside
                // `validateMove` — nothing to duplicate at this layer.
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
                  disabled={hintDisabled}
                  onPress={() => setHintSheetVisible(true)}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/*
        Wireframe section 13. Every action closes the sheet first so no
        dialog has to render on top of it.

        Exit to Home deliberately has no confirmation of its own: `popTo` is
        exactly the navigation WL-401's guard intercepts, so the player gets
        the same "Leave this round?" dialog the back button raises — one
        question, asked once, in one wording. Restart isn't a navigation, so
        it confirms below.
      */}
      <PauseSheet
        visible={pauseSheetVisible}
        onResume={() => setPauseSheetVisible(false)}
        onHowToPlay={() => {
          setPauseSheetVisible(false);
          navigation.navigate('HowToPlay');
        }}
        onRestart={() => {
          setPauseSheetVisible(false);
          // Same rule the leave guard uses, for the same reason: a round the
          // player hasn't moved in holds only the computer's opener, and
          // asking them to confirm giving up nothing is how a confirmation
          // stops being read. Restarting there is a reroll, not a loss.
          if (roundInProgress) {
            setConfirmRestart(true);
          } else {
            handleRestart();
          }
        }}
        onExit={() => {
          setPauseSheetVisible(false);
          navigation.popTo('Home');
        }}
      />

      {/*
        Cancelling puts the player back in the pause sheet they came from —
        they declined the restart, not the pause.
      */}
      <ConfirmSheet
        visible={confirmRestart}
        title={RESTART_ROUND_CONFIRM.title}
        message={RESTART_ROUND_CONFIRM.message}
        confirmLabel={RESTART_ROUND_CONFIRM.confirmLabel}
        cancelLabel={RESTART_ROUND_CONFIRM.cancelLabel}
        onConfirm={handleRestart}
        onCancel={() => {
          setConfirmRestart(false);
          setPauseSheetVisible(true);
        }}
      />

      <HintSheet
        visible={hintSheetVisible}
        requiredLetter={session.requiredLetter}
        wordCount={hintWordCount}
        exampleWord={hintExampleWord}
        onUseHint={handleUseHint}
        onCancel={() => setHintSheetVisible(false)}
      />

      {/*
        Wireframe section 13's confirm-before-discard rule. `confirmLeave`
        replays the exact navigation action that was held, so back goes back
        and Home goes Home.

        `handleConfirmLeave` records the round as abandoned on the way out
        (WL-402); it is also the point WL-602's "game abandoned" analytics
        event belongs at.
      */}
      <ConfirmSheet
        visible={confirmVisible}
        title={DISCARD_ROUND_CONFIRM.title}
        message={DISCARD_ROUND_CONFIRM.message}
        confirmLabel={DISCARD_ROUND_CONFIRM.confirmLabel}
        cancelLabel={DISCARD_ROUND_CONFIRM.cancelLabel}
        onConfirm={handleConfirmLeave}
        onCancel={cancelLeave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  // WL-409: the header and the scrolling content share one centred column on
  // a tablet, so the back control does not end up a hand's width from the
  // pause control. No phone is affected — see CONTENT_MAX_WIDTH.
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  keyboardAvoider: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
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
  chainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chainText: { ...typeScale.chainWord, color: palette.ink },
  input: { width: '100%' },
  statusMessage: { ...typeScale.body, color: palette.ink, textAlign: 'center' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    // WL-408: at the largest OS text size Submit and Hint no longer fit side
    // by side, and without wrapping they ran off both edges of the screen —
    // the two controls the turn depends on, half off-screen. Wrapping stacks
    // them instead. Every other action row in the app already did this.
    flexWrap: 'wrap',
  },
});
