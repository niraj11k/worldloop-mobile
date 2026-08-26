import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from './types';

import { WelcomeScreen } from '@screens/Welcome/WelcomeScreen';
import { HomeScreen } from '@screens/Home/HomeScreen';
import { DifficultyScreen } from '@screens/Difficulty/DifficultyScreen';
import { GameScreen } from '@screens/Game/GameScreen';
import { HowToPlayScreen } from '@screens/HowToPlay/HowToPlayScreen';
import { WordReviewScreen } from '@screens/WordReview/WordReviewScreen';
import { SettingsScreen } from '@screens/Settings/SettingsScreen';
import { AccountCreationScreen } from '@screens/AccountCreation/AccountCreationScreen';
import { FontSpecimenScreen } from '@screens/FontSpecimen/FontSpecimenScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Top-level stack.
 *
 * Note: Hint, Word Definition, and Pause are modelled as bottom-sheet /
 * overlay components in the Wireframe doc (sections 11-13), not as full
 * navigation screens. They live in src/components/game and are rendered
 * from within GameScreen, not registered here.
 *
 * The stack is wrapped in a SafeAreaView because `headerShown: false` means
 * nothing else insets the content: on a notched iPhone the first control of
 * every screen rendered underneath the Dynamic Island, which swallowed its
 * touches outright — Home's "Start Game" was unreachable, making the app
 * unusable on modern iPhones while working normally on Android. Wireframe
 * doc section 19 requires iOS safe areas.
 *
 * Applied once here rather than per screen so no future screen can forget
 * it. This is the minimum fix for the defect; WL-401's full pass still owns
 * per-screen back behaviour, and WL-409 owns any screen that later wants to
 * draw deliberately edge-to-edge.
 */
export function RootNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <SafeAreaView style={styles.safeArea}>
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
          {/*
            WL-201 font specimen. Dev builds only — it is a verification
            surface, not product, and must not be reachable in a release
            build. WL-206's component gallery should absorb it.
          */}
          {__DEV__ && (
            <Stack.Screen name="FontSpecimen" component={FontSpecimenScreen} />
          )}
        </Stack.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
});
