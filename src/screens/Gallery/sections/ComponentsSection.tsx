import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { gallery } from '../galleryStyles';
import { Badge } from '@components/common/Badge';
import { BottomSheet } from '@components/common/BottomSheet';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Input } from '@components/common/Input';
import { Icon, ICON_NAMES } from '@components/common/icons/Icon';
import { spacing } from '@theme/theme';

/**
 * Components — every WL-204 component in every state Design System §4 names.
 *
 * These are the real components from `@components/common`, not restatements.
 * That matters for what this section can catch: if `Button` breaks, this breaks,
 * which is the entire point of a gallery. A section that reproduced the styles
 * would keep looking correct while the app did not.
 */
export function ComponentsSection(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState('');

  return (
    <View>
      <Text style={gallery.caption}>
        Label colours are derived from each fill through the WL-202 contrast
        matrix, so no combination shown here can be a failing one — there is no
        prop that could express one.
      </Text>

      <Text style={gallery.h2}>Button</Text>
      <View style={gallery.col}>
        <Button label="Primary grape" onPress={() => {}} />
        <Button label="Primary tangerine" tone="tangerine" onPress={() => {}} />
        <Button label="Secondary" variant="secondary" onPress={() => {}} />
        <Button label="Disabled grape" disabled onPress={() => {}} />
        <Button label="Disabled tangerine" tone="tangerine" disabled onPress={() => {}} />
        <Button label="Disabled secondary" variant="secondary" disabled onPress={() => {}} />
      </View>
      <Text style={gallery.caption}>
        Press any enabled button: it translates into its own shadow and drops it,
        so it reads as pressed into the page. Disabled secondary keeps its paper
        fill — §4 makes the dropped shadow the signal there, since paper at 40%
        over paper is still paper.
      </Text>

      <Text style={gallery.h2}>Card</Text>
      <View style={gallery.col}>
        <Card>
          <Text style={gallery.label}>Default paper card, no rotation</Text>
        </Card>
        <Card rotation={-2}>
          <Text style={gallery.label}>Tilted -2°, the §3 minimum</Text>
        </Card>
        <Card fill="sunbeam" rotation={99}>
          <Text style={gallery.label}>
            Asked for 99° — clamped to the §3 maximum of 3°
          </Text>
        </Card>
      </View>

      <Text style={gallery.h2}>Input</Text>
      <View style={styles.inputCol}>
        <Input
          accessibilityLabel="Example word entry"
          placeholder="Enter a word beginning with E"
          value={text}
          onChangeText={setText}
        />
        <Text style={gallery.caption}>
          Focus it: the border turns grape and a separate ring appears. §4
          requires both — a border colour change alone would be a colour-only
          signal. The placeholder uses ink-muted so it cannot be mistaken for a
          real value.
        </Text>
        <Input
          accessibilityLabel="Example word entry with an error"
          placeholder="Enter a word"
          value="zzz"
          error="That word isn't in our dictionary."
        />
        <Text style={gallery.caption}>
          Three visible signals plus an assertive live-region announcement —
          never colour alone.
        </Text>
      </View>

      <Text style={gallery.h2}>Badge</Text>
      <View style={styles.badgeWrap}>
        <Badge label="STREAK 6" />
        <Badge label="HARD" fill="bubblegum" />
        <Badge label="NEW WORD" />
        <Badge label="No tilt" rotation={0} />
      </View>
      <Text style={gallery.caption}>
        Tilt is hashed from the label, so it is stable across re-renders — a
        streak badge must not jump to a new angle every time the number ticks up.
      </Text>

      <Text style={gallery.h2}>Icons</Text>
      <Text style={gallery.caption}>
        The whole WL-207 set, drawn from Views using the same borderWidth and
        palette tokens as the components — which is what §7 means by strokes
        &ldquo;matching the border weight used on components&rdquo;. Iterated
        from ICON_NAMES, so a new glyph appears here automatically rather than
        needing to be remembered.
      </Text>
      <View style={styles.iconWrap}>
        {ICON_NAMES.map(name => (
          <View key={name} style={styles.iconCell}>
            <Icon name={name} size={32} />
            <Text style={gallery.caption}>{name}</Text>
          </View>
        ))}
      </View>
      <Text style={gallery.caption}>
        Stroke weight scales with the box, so all three sizes below stay chunky
        rather than the largest reading as a hairline.
      </Text>
      <View style={styles.iconWrap}>
        {[16, 24, 48].map(size => (
          <View key={size} style={styles.iconCell}>
            <Icon name="settings" size={size} />
            <Text style={gallery.caption}>{size}pt</Text>
          </View>
        ))}
      </View>

      <Text style={gallery.h2}>BottomSheet</Text>
      <View style={gallery.col}>
        <Button label="Open sheet" onPress={() => setSheetOpen(true)} />
      </View>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title="Bottom sheet">
        <Text style={gallery.label}>
          4px ink border, heaviest shadow, top corners rounded. Tap the scrim or
          use the back gesture to dismiss.
        </Text>
        <Text style={gallery.caption}>
          Springs in via WL-205&apos;s SpringIn, which collapses to an instant
          appearance under reduced motion.
        </Text>
        <Button label="Close" onPress={() => setSheetOpen(false)} />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  // Inputs stretch rather than hugging their content, unlike the buttons above.
  inputCol: { gap: spacing.sm, marginBottom: spacing.md },
  iconWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  iconCell: { alignItems: 'center', gap: spacing.xs },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});
