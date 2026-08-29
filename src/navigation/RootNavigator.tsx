import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from './types';

import { useProfileStore } from '@store/useProfileStore';
import { palette } from '@theme/theme';

import { WelcomeScreen } from '@screens/Welcome/WelcomeScreen';
import { HomeScreen } from '@screens/Home/HomeScreen';
import { DifficultyScreen } from '@screens/Difficulty/DifficultyScreen';
import { GameScreen } from '@screens/Game/GameScreen';
import { HowToPlayScreen } from '@screens/HowToPlay/HowToPlayScreen';
import { WordReviewScreen } from '@screens/WordReview/WordReviewScreen';
import { SettingsScreen } from '@screens/Settings/SettingsScreen';
import { AccountCreationScreen } from '@screens/AccountCreation/AccountCreationScreen';
import { GalleryScreen } from '@screens/Gallery/GalleryScreen';

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
 * it. WL-409 owns any screen that later wants to draw deliberately
 * edge-to-edge.
 *
 * ## Back behaviour (WL-401)
 *
 * `headerShown: false` means there is no platform back button anywhere, so
 * every screen carries its own control, and Android's hardware back plus the
 * iOS edge-swipe both resolve through this stack. What "back" does per screen:
 *
 * | Screen | Back goes to | Notes |
 * |---|---|---|
 * | Welcome | exits the app | stack root, first launch only (WL-406) |
 * | Home | exits the app | the root on every later launch; Welcome `replace`s itself with it on the first |
 * | Difficulty | Home | |
 * | Game | Difficulty | **confirms first** while a round is in progress |
 * | HowToPlay | wherever it was opened from | Welcome or Home |
 * | WordReview | Game Over, or Home | "Back to Home" unwinds with `popTo` |
 * | Settings | Home | |
 * | AccountCreation | Settings | modal; dormant behind D-04 |
 * | Gallery | Home | dev builds only |
 *
 * Only the Game row differs from the platform default, and it is the reason
 * this task exists: Android back and the iOS swipe would otherwise destroy a
 * round in progress with no warning. `useConfirmBeforeLeave` holds the
 * navigation action itself rather than guarding any one control, so all three
 * routes off that screen — control, hardware button, gesture — are covered by
 * one guard. See that hook, and `isRoundInProgress` for what counts as a
 * round worth protecting.
 *
 * Nothing in this stack `navigate`s backwards. In React Navigation 7 a
 * `navigate` to a route that is not the current one pushes a duplicate rather
 * than returning to the instance already below, so returning to an earlier
 * screen uses `popTo` — the flat Home → Difficulty → Game structure in
 * Wireframe section 2 is only actually flat if it is unwound that way.
 */
export function RootNavigator(): React.JSX.Element {
  const profileStatus = useProfileStore(state => state.status);
  const isFirstLaunch = useProfileStore(state => state.isFirstLaunch);

  /*
    WL-406: the stack waits for the profile before mounting, because
    `initialRouteName` is read once and never again — deciding it late would
    mean routing correctly only by remounting the whole navigator.

    What is being waited for is a synchronous MMKV read behind an async
    interface, so this is a frame or two, and it is `paper` rather than a
    spinner: a loading indicator for something this fast is worse than a
    still background, and Design System section 5 has no spinner in it
    anyway. The alternative — start on Welcome and redirect — flashes the
    welcome screen at every returning player, which is the exact thing
    "first launch only" is meant to prevent.
  */
  if (profileStatus !== 'ready') {
    return <View style={styles.launchBackdrop} />;
  }

  return (
    <NavigationContainer>
      <SafeAreaView style={styles.safeArea}>
        <Stack.Navigator
          initialRouteName={isFirstLaunch ? 'Welcome' : 'Home'}
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
            WL-206 component gallery. Dev builds only — it is a verification
            surface, not product, and must not be reachable in a release build.
            Reached from the dev-only row on Home.
          */}
          {__DEV__ && <Stack.Screen name="Gallery" component={GalleryScreen} />}
        </Stack.Navigator>
      </SafeAreaView>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  launchBackdrop: { flex: 1, backgroundColor: palette.paper },
});
