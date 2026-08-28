import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@navigation/types';
import { Icon } from '@components/common/icons/Icon';
import { gallery } from './galleryStyles';
import { ComponentsSection } from './sections/ComponentsSection';
import { FoundationsSection } from './sections/FoundationsSection';
import { MotionSection } from './sections/MotionSection';
import { TypographySection } from './sections/TypographySection';
import { useReducedMotion } from '@hooks/useReducedMotion';
import {
  palette,
  spacing,
  radius,
  borderWidth,
  shadow,
  typeScale,
  textOn,
  MIN_TAP_TARGET,
} from '@theme/theme';

/**
 * Component gallery — WL-206. Dev builds only.
 *
 * "A dev-only screen rendering every component in every state. Cheap, and it's
 * how design reviews and visual regressions actually get caught."
 *
 * ## Why it is tabbed rather than one long scroll
 *
 * It started as a single screen and grew past 500 lines across four concerns.
 * Finding the section you wanted meant scrolling past three others and
 * regularly overshooting — which quietly defeats the stated purpose, because a
 * gallery nobody can navigate is a gallery nobody checks. Each section is now
 * a short scroll of its own.
 *
 * The tabs are deliberately built from the real `palette`/`shadow` tokens
 * rather than being chrome exempt from the system: this screen is styled by the
 * thing it exists to display, so a broken token breaks the gallery's own
 * furniture too.
 *
 * ## What lives where
 *
 * - **Foundations** — raw WL-203 tokens, including the hard-vs-blurred shadow
 *   control that proves `blurRadius: 0` is honoured per platform.
 * - **Components** — every WL-204 component in every §4 state.
 * - **Motion** — every WL-205 primitive, with triggers.
 * - **Typography** — the WL-201 font instrument, which measures whether the
 *   bundled faces actually loaded rather than trusting that they look right.
 *
 * The reduced-motion banner sits on this frame rather than inside Motion, so
 * every screenshot of any section records which mode it was taken in.
 */

const SECTIONS = [
  { key: 'foundations', label: 'Tokens', render: () => <FoundationsSection /> },
  { key: 'components', label: 'Components', render: () => <ComponentsSection /> },
  { key: 'motion', label: 'Motion', render: () => <MotionSection /> },
  { key: 'typography', label: 'Type', render: () => <TypographySection /> },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

type Props = NativeStackScreenProps<RootStackParamList, 'Gallery'>;

export function GalleryScreen({ navigation }: Props): React.JSX.Element {
  const [active, setActive] = useState<SectionKey>('foundations');
  const reducedMotion = useReducedMotion();

  const section = SECTIONS.find(s => s.key === active) ?? SECTIONS[0];

  return (
    <View style={gallery.page}>
      <View style={styles.header}>
        {/*
          WL-401: with `headerShown` false stack-wide, this screen had no back
          control at all — reachable from Home, leaveable only by the iOS edge
          swipe or Android's hardware back. Dev-only is not a reason to be the
          one screen that can strand you.
        */}
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={spacing.sm}>
            <Icon name="back" />
          </Pressable>
          <Text style={styles.title}>Gallery</Text>
        </View>

        <View
          style={[
            styles.banner,
            { backgroundColor: reducedMotion ? palette.sunbeam : palette.limeade },
          ]}>
          <Text style={styles.bannerText}>
            {reducedMotion ? 'REDUCED MOTION ON' : 'REDUCED MOTION OFF'}
          </Text>
        </View>

        <View
          style={styles.tabs}
          accessibilityRole="tablist">
          {SECTIONS.map(s => {
            const selected = s.key === active;
            const fill = selected ? 'grape' : 'paper';
            return (
              <Pressable
                key={s.key}
                onPress={() => setActive(s.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${s.label} section`}
                style={[
                  styles.tab,
                  {
                    backgroundColor: palette[fill],
                    // Selected tab sits raised; the others read as flat, the
                    // same press-into-shadow language §4 gives buttons.
                    boxShadow: selected ? shadow.control : shadow.none,
                  },
                ]}>
                <Text style={[styles.tabLabel, { color: textOn(fill) }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/*
        Keyed on the section so switching tabs remounts rather than reusing
        state across sections. That matters for Motion: its counters and the
        SpringIn stamp should start fresh each visit, not resume mid-animation.
      */}
      <ScrollView key={active} contentContainerStyle={gallery.content}>
        {section.render()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: borderWidth.base,
    borderBottomColor: palette.ink,
    backgroundColor: palette.paper,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typeScale.screenTitle, color: palette.ink },
  banner: {
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  bannerText: { ...typeScale.caption, color: palette.ink },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tab: {
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: borderWidth.thin,
    borderColor: palette.ink,
    borderRadius: radius.control,
  },
  tabLabel: { ...typeScale.buttonLabel },
});
