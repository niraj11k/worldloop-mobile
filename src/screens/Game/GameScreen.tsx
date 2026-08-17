import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { normalizeWord, validateMove, getRequiredLetter } from '@features/game/ruleEngine';
import type { Move, TurnPhase } from '@app-types/game';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

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
 * This skeleton wires local rule-engine validation only. It does not yet:
 * - call the DictionaryService for word-list / proper-noun checks
 * - call the DifficultyEngine for the computer's response
 * - persist state via GameSession (Data Model doc section 4)
 * - integrate the Hint bottom sheet or Word Definition overlay (see
 *   src/components/game)
 */
export function GameScreen({ route, navigation }: Props): React.JSX.Element {
  const { difficulty } = route.params;

  const [currentWord, setCurrentWord] = useState('apple'); // TODO: from session start
  const [requiredLetter, setRequiredLetter] = useState(getRequiredLetter('apple'));
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<TurnPhase>('player_turn');
  const [chain, setChain] = useState<Move[]>([]);
  const [errorReason, setErrorReason] = useState<string | null>(null);

  const handleSubmit = () => {
    setPhase('validating');
    const usedWords = new Set(chain.map(m => m.normalizedWord));
    const result = validateMove({ rawInput: input, requiredLetter, usedWords });

    if (!result.isValid) {
      setErrorReason(result.reason);
      setPhase('invalid_word');
      return;
    }

    // TODO: replace with server call / DifficultyEngine selection.
    setPhase('computer_thinking');
    setErrorReason(null);
    setInput('');
    setChain(prev => [
      ...prev,
      {
        moveId: `local-${prev.length}`,
        turnNumber: prev.length + 1,
        actor: 'player',
        submittedWord: input,
        normalizedWord: result.normalizedWord,
        isValid: true,
        invalidReason: null,
        hintUsed: false,
        scoreAwarded: 0, // TODO: scoringEngine.scoreWord(...)
      },
    ]);
    setCurrentWord(result.normalizedWord);
    setRequiredLetter(getRequiredLetter(result.normalizedWord));
    setPhase('player_turn');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text>←</Text>
        </Pressable>
        <Text>{difficulty}</Text>
        <Text>⏸</Text>
      </View>

      <Text>Chain: {chain.length} words</Text>

      <Text>Computer</Text>
      <Text>{currentWord.toUpperCase()}</Text>

      <Text>Required letter</Text>
      <Text style={{ fontSize: 32, fontWeight: 'bold' }}>{requiredLetter.toUpperCase()}</Text>

      <TextInput
        value={input}
        onChangeText={text => {
          setInput(text);
          setPhase(normalizeWord(text).length === 0 ? 'input_empty' : 'player_turn');
        }}
        editable={phase !== 'validating' && phase !== 'computer_thinking'}
        autoFocus
        placeholder={`Enter a word beginning with ${requiredLetter.toUpperCase()}`}
      />

      {phase === 'invalid_word' && errorReason && <Text>Error: {errorReason}</Text>}
      {phase === 'computer_thinking' && <Text>WordLoop is thinking…</Text>}

      <Pressable onPress={handleSubmit} disabled={normalizeWord(input).length === 0}>
        <Text>Submit</Text>
      </Pressable>
      <Pressable onPress={() => {/* TODO: open Hint bottom sheet */}}>
        <Text>Hint</Text>
      </Pressable>
    </View>
  );
}
