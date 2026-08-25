import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
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
import { generateCandidates, selectComputerWord } from '@features/difficulty/difficultyEngine';
import { rarityForEntry, scoreWord } from '@features/scoring/scoringEngine';
import { replyCountForLetter } from '@features/dictionary/dictionaryService';
import { INVALID_WORD_MESSAGES } from '@constants/gameConstants';
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

const ROUND_OVER_MESSAGES: Record<Exclude<GameStatus, 'active'>, string> = {
  player_win: 'You win — WordLoop ran out of words!',
  computer_win: 'WordLoop wins — no words left beginning with that letter.',
  draw: 'Draw — the dictionary ran out for both of you.',
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
 * useState, so the screen only renders and forwards events. Still a
 * grayscale skeleton: the layout, the seven Wireframe section 9 states and
 * the game-over screen are WL-301/302/308, gated on the design system.
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
      // TODO(WL-112): pick a starting word that leaves the player a healthy
      // set of replies and varies between rounds.
      startingWord: 'apple',
    }),
  );
  const [input, setInput] = useState('');
  const [errorReason, setErrorReason] = useState<InvalidReason | null>(null);

  const lastMove = session.chain[session.chain.length - 1];
  const roundOver = isRoundOver(session);
  const busy = session.phase === 'validating' || session.phase === 'computer_thinking';

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

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text>←</Text>
        </Pressable>
        <Text>{difficulty}</Text>
        <Text>⏸</Text>
      </View>

      <Text>
        Chain: {session.chain.length} words · Score: {session.score}
      </Text>

      {/* Whose word is on the board, rather than a hardcoded label. */}
      <Text>{lastMove?.actor === 'player' ? 'You' : 'Computer'}</Text>
      <Text>{session.currentWord.toUpperCase()}</Text>

      {roundOver ? (
        <Text>{ROUND_OVER_MESSAGES[session.status as Exclude<GameStatus, 'active'>]}</Text>
      ) : (
        <>
          <Text>Required letter</Text>
          <Text style={{ fontSize: 32, fontWeight: 'bold' }}>
            {session.requiredLetter.toUpperCase()}
          </Text>

          <TextInput
            value={input}
            onChangeText={text => {
              setInput(text);
              setSession(current => setSessionInput(current, text));
            }}
            editable={!busy}
            autoFocus
            placeholder={`Enter a word beginning with ${session.requiredLetter.toUpperCase()}`}
          />

          {session.phase === 'invalid_word' && errorMessage !== null && <Text>{errorMessage}</Text>}
          {session.phase === 'computer_thinking' && <Text>WordLoop is thinking…</Text>}

          <Pressable onPress={handleSubmit} disabled={busy || normalizeWord(input).length === 0}>
            <Text>Submit</Text>
          </Pressable>
          <Pressable onPress={() => {/* TODO(WL-307): open Hint bottom sheet */}}>
            <Text>Hint</Text>
          </Pressable>
        </>
      )}

      {/* Recent chain, so the round is followable (Wireframe section 8). */}
      {session.chain
        .slice(-6)
        .reverse()
        .map(move => (
          <Text key={move.moveId}>
            {move.actor === 'player' ? 'You' : 'WordLoop'}: {move.normalizedWord}
          </Text>
        ))}
    </View>
  );
}
