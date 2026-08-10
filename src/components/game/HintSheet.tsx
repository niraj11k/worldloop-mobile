import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';

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
      <View style={{ marginTop: 'auto', backgroundColor: 'white', padding: 16 }}>
        <Text>Hint</Text>
        <Text>Your word must begin with:</Text>
        <Text style={{ fontSize: 32, fontWeight: 'bold' }}>{requiredLetter.toUpperCase()}</Text>
        <Text>Example: {exampleWord.toUpperCase()}</Text>
        <Text>This hint will reduce your available hints by one.</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable onPress={onUseHint}>
            <Text>Use Hint</Text>
          </Pressable>
          <Pressable onPress={onCancel}>
            <Text>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
