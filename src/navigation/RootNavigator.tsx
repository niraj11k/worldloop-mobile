import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

import { WelcomeScreen } from '@screens/Welcome/WelcomeScreen';
import { HomeScreen } from '@screens/Home/HomeScreen';
import { DifficultyScreen } from '@screens/Difficulty/DifficultyScreen';
import { GameScreen } from '@screens/Game/GameScreen';
import { HowToPlayScreen } from '@screens/HowToPlay/HowToPlayScreen';
import { WordReviewScreen } from '@screens/WordReview/WordReviewScreen';
import { SettingsScreen } from '@screens/Settings/SettingsScreen';
import { AccountCreationScreen } from '@screens/AccountCreation/AccountCreationScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Top-level stack.
 *
 * Note: Hint, Word Definition, and Pause are modelled as bottom-sheet /
 * overlay components in the Wireframe doc (sections 11-13), not as full
 * navigation screens. They live in src/components/game and are rendered
 * from within GameScreen, not registered here.
 */
export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Difficulty" component={DifficultyScreen} />
        <Stack.Screen name="Game" component={GameScreen} />
        <Stack.Screen name="HowToPlay" component={HowToPlayScreen} />
        <Stack.Screen name="WordReview" component={WordReviewScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="AccountCreation"
          component={AccountCreationScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
