import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { IconButton } from '@components/common/IconButton';
import {
  DEFINITION_UNAVAILABLE_MESSAGE,
  WORD_REVIEW_EMPTY_STATE,
} from '@constants/gameConstants';
import { fetchDefinition } from '@features/dictionary/definitionService';
import type { DefinitionResult } from '@features/dictionary/definitionService';
import { discoveredWordsForSession } from '@features/profile/guestProfile';
import { useProfileStore } from '@store/useProfileStore';
import {
  palette,
  spacing,
  typeScale,
  displayTextProps,
  CONTENT_MAX_WIDTH,
} from '@theme/theme';
import type { DiscoveredWord } from '@app-types/profile';

type Props = NativeStackScreenProps<RootStackParamList, 'WordReview'>;

/**
 * Word Review screen.
 * Spec: Wireframe §15, empty state §17, PRD §12 ("learned words" list,
 * end-of-round vocabulary review).
 *
 * ## Where the words come from, and why not the round's chain
 *
 * §15 says "show words from the completed round". This screen shows the
 * round's **discovered** words — the ones the player had never played before —
 * read back off the guest profile by session id, not off the session.
 *
 * That is a deliberate reading, not a shortcut. By the time this screen is
 * reachable the round is over: WL-403 clears the save slot on the last
 * transition, and this is a route, so `GameScreen`'s state is gone. The only
 * durable record of a round's words is `DiscoveredWord` (Data Model §7), which
 * is precisely the entity PRD §12 names for the "learned words" list. Passing
 * the chain through route params would work, but it would make the screen
 * unreachable from Home — where it also lives (Wireframe §2) with no round
 * behind it at all — and it would show nothing after a restart.
 *
 * Two consequences, both stated rather than hidden:
 * - **§15's "distinguish player and computer words if useful" does not apply.**
 *   Discovered words are the player's by definition (`newDiscoveredWords`
 *   excludes the computer's), so there is nothing to distinguish. That
 *   requirement is conditional in the doc; this is the condition failing.
 * - **A round where the player replayed only familiar words discovers
 *   nothing.** Rather than show an empty screen after a real round, the
 *   vocabulary section below always carries everything the player has ever
 *   found, so there is something to review either way.
 *
 * ## Per-word definitions
 *
 * §15 requires definitions to load independently, with a per-word loading
 * state and a per-word unavailable state that does not block the list. Each
 * row owns its own request and its own state, and one row resolving to
 * "unavailable" is invisible to every other row — the acceptance criterion.
 *
 * The loading state is real but usually imperceptible: D-08 closed on a
 * bundled source (WL-501), so `fetchDefinition` resolves from memory. It is
 * still awaited through the async seam Architecture §4 describes rather than
 * called synchronously, because that is what keeps the row honest if a
 * provider is ever added — the alternative was a synchronous read plus a fake
 * spinner, which is theatre.
 *
 * **Pronunciation is not built.** The §15 mockup shows a `[Pronunciation]`
 * button beside each word and the WL-002 skeleton carried an inert one. PRD
 * §12 lists pronunciation under *future* learning features, not v1, and no
 * task in the plan builds it — so the control is removed rather than shipped
 * dead. A button that does nothing teaches the player the app is broken.
 */
export function WordReviewScreen({ route, navigation }: Props): React.JSX.Element {
  const sessionId = route.params?.sessionId;
  const profile = useProfileStore(state => state.profile);

  const { fromRound, vocabulary } = useMemo(() => {
    if (profile === null) {
      return { fromRound: [] as DiscoveredWord[], vocabulary: [] as DiscoveredWord[] };
    }
    const round =
      sessionId === undefined ? [] : discoveredWordsForSession(profile, sessionId);
    const roundWords = new Set(round.map(entry => entry.word));
    return {
      fromRound: round,
      // Newest first: the most recent discovery is the one the player is
      // most likely to be looking for. `discoveredWords` is appended to, so
      // reversing is enough — no date parse per row.
      vocabulary: profile.discoveredWords
        .filter(entry => !roundWords.has(entry.word))
        .slice()
        .reverse(),
    };
  }, [profile, sessionId]);

  const isEmpty = fromRound.length === 0 && vocabulary.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton name="back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />
        <Text {...displayTextProps} style={styles.title}>
          Word Review
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {isEmpty ? (
        <Card fill="sunbeam">
          {/* Wireframe §17's empty state, both lines, verbatim. */}
          <Text style={styles.emptyState}>{WORD_REVIEW_EMPTY_STATE}</Text>
        </Card>
      ) : (
        <>
          {fromRound.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>New in this round</Text>
              {fromRound.map(entry => (
                <WordRow key={entry.word} entry={entry} />
              ))}
            </View>
          )}

          {vocabulary.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>
                {fromRound.length > 0 ? 'Words you found earlier' : 'Words you have found'}
              </Text>
              {vocabulary.map(entry => (
                <WordRow key={entry.word} entry={entry} />
              ))}
            </View>
          )}
        </>
      )}

      {/*
        `popTo`, not `navigate` (WL-401): reached from Game Over, the stack
        below this screen is Home → Difficulty → Game, and a `navigate` would
        push a *second* Home on top of all of it in React Navigation 7. `popTo`
        unwinds to the Home already there, from either entry point (Game Over
        or Home itself).
      */}
      <Button label="Back to Home" onPress={() => navigation.popTo('Home')} />
    </ScrollView>
  );
}

/** What one row's definition request is currently doing. */
type RowState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'ready'; definition: DefinitionResult }
  | { status: 'unavailable' };

/**
 * One word and its independently-loaded definition (Wireframe §15).
 *
 * Its own component so its state is genuinely its own: a row that ends up
 * `unavailable` cannot re-render, block, or otherwise reach any sibling, which
 * is what this task's acceptance criterion actually asks for. Hoisting these
 * into one map in the parent would be the version that couples them.
 */
function WordRow({ entry }: { entry: DiscoveredWord }): React.JSX.Element {
  const [state, setState] = useState<RowState>({ status: 'closed' });
  const markDefinitionSeen = useProfileStore(store => store.markDefinitionSeen);

  useEffect(() => {
    if (state.status !== 'loading') return;

    let cancelled = false;
    // A rejection is treated exactly like a miss. PRD §12 forbids a definition
    // failure from affecting play, and this screen has even less standing to
    // surface an error: the player asked what a word means, and "unavailable"
    // answers that honestly where a red error does not.
    fetchDefinition(entry.word)
      .then(definition => {
        if (cancelled) return;
        setState(
          definition === null
            ? { status: 'unavailable' }
            : { status: 'ready', definition },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' });
      });

    return () => {
      cancelled = true;
    };
  }, [state.status, entry.word]);

  const open = () => {
    setState({ status: 'loading' });
    // Data Model §7's `definition_viewed`. Deliberately not awaited: the row
    // must not wait on a profile write to show a definition, and the write
    // reports its own failures rather than rejecting (see
    // `useProfileStore.persist`), so there is no rejection to leave unhandled.
    markDefinitionSeen(entry.word);
  };

  return (
    <Card style={styles.row}>
      <Text {...displayTextProps} style={styles.word}>
        {entry.word.toUpperCase()}
      </Text>

      {state.status === 'closed' ? (
        <Pressable
          onPress={open}
          accessibilityRole="button"
          // Named per word: a dozen rows otherwise announce "Definition,
          // button" a dozen times with nothing to tell them apart.
          accessibilityLabel={`Definition of ${entry.word}`}>
          <Text style={styles.action}>Definition</Text>
        </Pressable>
      ) : state.status === 'loading' ? (
        <Text style={styles.body}>Loading definition…</Text>
      ) : state.status === 'unavailable' ? (
        <Text style={styles.body}>{DEFINITION_UNAVAILABLE_MESSAGE}</Text>
      ) : (
        <>
          <Text style={styles.partOfSpeech}>{state.definition.partOfSpeech}</Text>
          <Text style={styles.body}>{sentenceCase(state.definition.definition)}</Text>
        </>
      )}
    </Card>
  );
}

/**
 * Capitalises the first letter and ends the sentence.
 *
 * Duplicated from `DefinitionSheet` rather than shared: it is three lines of
 * presentation, the two surfaces are free to diverge, and a `utils/text`
 * module existing to hold one four-line function is the kind of indirection
 * that costs more to follow than to repeat.
 */
function sentenceCase(text: string): string {
  const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typeScale.screenTitle, color: palette.ink },
  // Balances the back control so the title stays centred (the pattern
  // DifficultyScreen established).
  headerSpacer: { width: 44 },
  section: { gap: spacing.md },
  sectionHeading: { ...typeScale.body, color: palette.ink },
  emptyState: { ...typeScale.body, color: palette.ink },
  row: { gap: spacing.xs },
  word: { ...typeScale.chainWord, color: palette.ink },
  action: { ...typeScale.body, color: palette.grape },
  partOfSpeech: { ...typeScale.caption, color: palette.ink },
  body: { ...typeScale.body, color: palette.ink },
});
