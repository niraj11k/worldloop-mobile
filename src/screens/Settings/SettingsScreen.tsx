import React, { useEffect, useState } from 'react';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { ConfirmSheet } from '@components/common/ConfirmSheet';
import { IconButton } from '@components/common/IconButton';
import { ReportWordSheet } from '@components/game/ReportWordSheet';
import {
  ACCOUNTS_ENABLED_V1,
  DELETE_GUEST_DATA_CONFIRM,
  RESET_STATISTICS_CONFIRM,
} from '@constants/gameConstants';
import { serializeReportsForExport } from '@features/report/wordReports';
import { reportError } from '@services/crashReporting/crashReporting';
import { useProfileStore } from '@store/useProfileStore';
import { useReportStore } from '@store/useReportStore';
import { useSettingsStore } from '@store/useSettingsStore';
import { palette, spacing, typeScale, displayTextProps, CONTENT_MAX_WIDTH } from '@theme/theme';

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
 * - **Privacy policy** and **Terms of use** — WL-801, whose "done when" is
 *   that both documents are live *and linked in-app*. Nothing exists to link
 *   to yet.
 * - **Contact / support** — needs a support address, which no project
 *   document decides. Flagged in the WL-407 note rather than invented.
 *
 * Text size is here as a statement rather than a control: the app scales with
 * the OS setting, so a second in-app scale would be a competing source of
 * truth. WL-408 owns making that scaling *usable* at the extremes.
 *
 * ## Report a word (WL-505)
 *
 * Two controls, both added here: **Report a Word** opens the same sheet the
 * game screen uses, in the mode that asks which word (there is no round behind
 * this entry point). **Export Reports** appears only once the queue is
 * non-empty and hands it to the OS share sheet — under D-03 there is no server
 * to send a report to, so that export is the only route out, and a queue with
 * no visible way out is a suggestion box nailed shut.
 */
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const { soundEnabled, hapticsEnabled, toggleSound, toggleHaptics } = useSettingsStore();
  const resetStats = useProfileStore(state => state.resetStats);
  const deleteGuestData = useProfileStore(state => state.deleteGuestData);
  const [pending, setPending] = useState<PendingAction>(null);
  const [reportVisible, setReportVisible] = useState(false);

  // WL-505: the queue is read here rather than at launch — reporting a word
  // is rare and the queue has no bearing on a round, so nothing else in the
  // app needs it loaded.
  const reports = useReportStore(state => state.reports);
  const loadReports = useReportStore(state => state.load);
  const submitReport = useReportStore(state => state.submit);
  const clearReports = useReportStore(state => state.clear);
  useEffect(() => {
    loadReports();
  }, [loadReports]);

  /**
   * D-03 leaves no server to send reports to, so "send" is the OS share sheet
   * and the player chooses where it goes (mail, notes, anywhere).
   *
   * The queue is deliberately **not** cleared afterwards: `Share` resolves the
   * same way whether the player sent the message or abandoned the draft, so
   * clearing on resolve would throw away reports that never left the device.
   * Re-exporting a report costs nothing; losing one costs the feature.
   */
  const handleExportReports = async () => {
    try {
      await Share.share({ message: serializeReportsForExport(reports) });
    } catch (error) {
      reportError(error, { scope: 'SettingsScreen.exportReports' });
    }
  };

  // TODO: read from auth/session store once Account Service exists (1.1).
  const isSignedIn = false;

  const confirmCopy =
    pending === 'delete' ? DELETE_GUEST_DATA_CONFIRM : RESET_STATISTICS_CONFIRM;

  const handleConfirm = () => {
    if (pending === 'reset') resetStats();
    if (pending === 'delete') {
      deleteGuestData();
      // WL-505: a report carries free text the player wrote, so it is their
      // data and goes with the rest of it (Guest Deletion doc). `resetStats`
      // deliberately does not — that clears statistics, and a pending report
      // is a message in flight, not a score. The confirmation copy already
      // draws exactly this line between the two actions.
      clearReports();
    }
    setPending(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <IconButton name="back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <Text {...displayTextProps} style={styles.title} accessibilityRole="header">
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
          {/*
            WL-505's second entry point (PRD §26). The game screen's is on the
            invalid-word state and is about the word in front of the player;
            this one is for a word they remember, so the sheet asks which.

            Export sits beside it rather than behind a submenu because under
            D-03 it is the *only* way a report reaches anyone — a queue with no
            visible way out is a suggestion box nailed shut. It is hidden until
            there is something to send, so it never offers to share nothing.
          */}
          <Button
            label="Report a Word"
            variant="secondary"
            onPress={() => setReportVisible(true)}
            accessibilityHint="Tell us a word was judged wrongly"
            style={styles.fullWidthButton}
          />
          {reports.length > 0 && (
            <Button
              label={`Export Reports (${reports.length})`}
              variant="secondary"
              onPress={handleExportReports}
              accessibilityHint="Opens the share sheet with your reports"
              style={styles.fullWidthButton}
            />
          )}
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
      <ReportWordSheet
        visible={reportVisible}
        word=""
        // No round behind this entry point, so the player types the word —
        // and `gameId` stays null rather than being invented (Data Model §8).
        askForWord
        onSubmit={report => {
          submitReport({
            word: report.word,
            reportType: report.reportType,
            playerComment: report.comment,
            gameId: null,
          });
          setReportVisible(false);
        }}
        onCancel={() => setReportVisible(false)}
      />

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
  // Wraps rather than clipping at large text sizes (WL-408).
  title: { ...typeScale.screenTitle, color: palette.ink, flexShrink: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    // WL-409: tablets get a centred column rather than a stretched phone
    // layout; no phone is affected (see CONTENT_MAX_WIDTH).
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
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
