import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ConfirmSheet } from '@components/common/ConfirmSheet';
import { Icon } from '@components/common/icons/Icon';
import {
  ACCOUNTS_ENABLED_V1,
  DELETE_GUEST_DATA_CONFIRM,
  RESET_STATISTICS_CONFIRM,
} from '@constants/gameConstants';
import { useProfileStore } from '@store/useProfileStore';
import { useSettingsStore } from '@store/useSettingsStore';
import { palette, spacing, typeScale } from '@theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/** Which destructive action is waiting on a confirmation, if any. */
type PendingAction = 'reset' | 'delete' | null;

/**
 * Settings screen.
 * Spec: Wireframe doc section 16, as narrowed by Delivery Plan D-04 and D-05,
 * built on the WL-204 component set (WL-407).
 *
 * ## Account row
 *
 * Architecture doc section 8.6, as amended by D-04 (closed 2026-08-17): v1
 * ships guest-only, so the row shows only "Continue as guest" with no Create
 * Account button — section 16's original pre-accounts guidance, not the
 * accounts-in-v1 addendum. Gated behind `ACCOUNTS_ENABLED_V1` rather than
 * deleted, since section 8.6's design is still correct for the 1.1 release.
 *
 * Behaviour once that flag flips true:
 * - Guest: "Continue as guest" + "Create Account".
 * - Signed in: linked provider + "Sign Out".
 * - Not frequency-capped, unlike game-over / milestone soft prompts.
 *
 * ## Toggles
 *
 * §16 draws each setting as a label with its state in brackets — `Sound
 * [On]` — and the design system has no toggle component to build that from
 * (§4 defines buttons, cards, modals, inputs, badges; nothing else). So a
 * setting is a `Button` whose label is its state: `grape` and "ON" when on,
 * `paper` and "OFF" when off, so the state reads from both the word and the
 * fill rather than colour alone. `role="switch"` tells assistive tech what it
 * actually is.
 *
 * Both persist through the guest profile, which is what makes §16's "takes
 * effect immediately" true — `useSettingsStore` writes to the profile on
 * every toggle, so the value is on disk before the next frame.
 *
 * ## What §16 lists that is not here yet
 *
 * Deliberate omissions, each owned by a task that has to exist first — a row
 * that opens nothing is worse than a row that is not there, and each is
 * tracked so it cannot be quietly forgotten:
 *
 * - **Report a word** — WL-505, which depends on this task and owns both of
 *   its entry points.
 * - **Privacy policy** and **Terms of use** — WL-801, whose "done when" is
 *   that both documents are live *and linked in-app*. Nothing exists to link
 *   to yet.
 * - **Contact / support** — needs a support address, which no project
 *   document decides. Flagged in the WL-407 note rather than invented.
 *
 * Text size is here as a statement rather than a control: the app scales with
 * the OS setting, so a second in-app scale would be a competing source of
 * truth. WL-408 owns making that scaling *usable* at the extremes.
 */
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const { soundEnabled, hapticsEnabled, toggleSound, toggleHaptics } = useSettingsStore();
  const resetStats = useProfileStore(state => state.resetStats);
  const deleteGuestData = useProfileStore(state => state.deleteGuestData);
  const [pending, setPending] = useState<PendingAction>(null);

  // TODO: read from auth/session store once Account Service exists (1.1).
  const isSignedIn = false;

  const confirmCopy =
    pending === 'delete' ? DELETE_GUEST_DATA_CONFIRM : RESET_STATISTICS_CONFIRM;

  const handleConfirm = () => {
    if (pending === 'reset') resetStats();
    if (pending === 'delete') deleteGuestData();
    setPending(null);
  };

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
        <Text style={styles.title} accessibilityRole="header">
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          {!ACCOUNTS_ENABLED_V1 ? (
            <Text style={styles.body}>Continue as guest</Text>
          ) : isSignedIn ? (
            <>
              <Text style={styles.body}>Signed in</Text>
              <Button
                label="Sign Out"
                variant="secondary"
                onPress={() => {
                  /* TODO: sign out (1.1) */
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>Continue as guest</Text>
              <Button
                label="Create Account"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('AccountCreation', { entryPoint: 'settings' })
                }
              />
            </>
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.settingRow}>
            <Text style={styles.body}>Sound</Text>
            <Button
              label={soundEnabled ? 'On' : 'Off'}
              variant={soundEnabled ? 'primary' : 'secondary'}
              tone="grape"
              role="switch"
              checked={soundEnabled}
              accessibilityLabel="Sound"
              onPress={toggleSound}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.body}>Haptics</Text>
            <Button
              label={hapticsEnabled ? 'On' : 'Off'}
              variant={hapticsEnabled ? 'primary' : 'secondary'}
              tone="grape"
              role="switch"
              checked={hapticsEnabled}
              accessibilityLabel="Haptics"
              onPress={toggleHaptics}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.body}>Text size</Text>
            <Text style={styles.settingValue}>Follows your device</Text>
          </View>
        </Card>

        <View style={styles.actions}>
          <Button
            label="Reset Statistics"
            variant="secondary"
            onPress={() => setPending('reset')}
            accessibilityHint="Clears your scores and history. Asks first."
            style={styles.fullWidthButton}
          />
          <Button
            label="Delete My Data"
            variant="secondary"
            onPress={() => setPending('delete')}
            accessibilityHint="Deletes everything stored on this device. Asks first."
            style={styles.fullWidthButton}
          />
          <Button
            label="Attributions"
            variant="secondary"
            onPress={() => navigation.navigate('Attributions')}
            style={styles.fullWidthButton}
          />
        </View>
      </ScrollView>

      {/*
        One sheet for both destructive actions: they are never open at the
        same time, and two near-identical `ConfirmSheet`s would be two places
        to keep the same behaviour correct.
      */}
      <ConfirmSheet
        visible={pending !== null}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirmLabel}
        cancelLabel={confirmCopy.cancelLabel}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: { ...typeScale.screenTitle, color: palette.ink },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: { gap: spacing.md },
  sectionTitle: { ...typeScale.caption, color: palette.ink },
  body: { ...typeScale.body, color: palette.ink },
  settingValue: { ...typeScale.caption, color: palette.ink },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actions: { gap: spacing.md },
  fullWidthButton: { alignSelf: 'stretch' },
});
