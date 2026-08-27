import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { gallery } from '../galleryStyles';
import { Badge } from '@components/common/Badge';
import { Button } from '@components/common/Button';
import { Card } from '@components/common/Card';
import { Input } from '@components/common/Input';
import { ColorFlash } from '@components/common/motion/ColorFlash';
import { ScalePunch } from '@components/common/motion/ScalePunch';
import { Shake } from '@components/common/motion/Shake';
import { SpringIn } from '@components/common/motion/SpringIn';
import { ThinkingDots } from '@components/common/motion/ThinkingDots';
import { palette, spacing, radius, borderWidth } from '@theme/theme';

/**
 * Motion — every WL-205 primitive, with something to trigger it.
 *
 * Each trigger is a counter rather than a boolean so that repeating the same
 * action still changes the value and re-fires the effect; the primitives all
 * animate on `trigger` *changing*.
 *
 * The reduced-motion banner lives on the gallery frame, not here, so it is
 * visible from every section — the setting affects this section most, but any
 * screenshot of the gallery should record which mode it was taken in.
 */
export function MotionSection(): React.JSX.Element {
  const [streak, setStreak] = useState(4);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [stampKey, setStampKey] = useState(0);

  return (
    <View>
      <Text style={gallery.caption}>
        Toggle the OS setting while this screen is open (iOS: Accessibility →
        Motion → Reduce Motion; Android: Accessibility → Remove animations). The
        banner above and every effect below switch immediately, without a
        relaunch.
      </Text>

      <Text style={gallery.h2}>Scale-punch</Text>
      <Text style={gallery.caption}>
        §5: 1.0 → 1.15 → 1.0 over ~200ms. Reduced: no scale, a 100ms opacity
        flash — and the number still updates, which is the actual information.
      </Text>
      <View style={gallery.row}>
        <ScalePunch trigger={streak}>
          <Badge label={`STREAK ${streak}`} rotation={0} />
        </ScalePunch>
        <ScalePunch trigger={streak} milestone>
          <Badge label={`MILESTONE ${streak}`} fill="bubblegum" rotation={0} />
        </ScalePunch>
      </View>
      <Button label="Increment streak" onPress={() => setStreak(s => s + 1)} />

      <Text style={gallery.h2}>Colour flash</Text>
      <Text style={gallery.caption}>
        §5: the valid-move fill flashes limeade, ink border retained. Reduced:
        still flashes — colour is the signal here, not decoration — but switches
        instantly instead of easing.
      </Text>
      <ColorFlash
        trigger={validCount}
        from={palette.paper}
        to={palette.limeade}
        style={styles.flashBox}>
        <Text style={gallery.label}>PLANET</Text>
      </ColorFlash>
      <Button label="Submit valid word" onPress={() => setValidCount(c => c + 1)} />

      <Text style={gallery.h2}>Horizontal shake</Text>
      <Text style={gallery.caption}>
        §5: a short shake on an invalid word. Reduced: no shake at all — the
        border, marker, message and live-region announcement already carry it,
        which is why this is the one effect whose fallback is nothing.
      </Text>
      <View style={styles.shakeCol}>
        <Shake trigger={invalidCount}>
          <Input
            accessibilityLabel="Shake demonstration"
            value="zzz"
            error="That word isn't in our dictionary."
          />
        </Shake>
        <Button
          label="Submit invalid word"
          tone="tangerine"
          onPress={() => setInvalidCount(c => c + 1)}
        />
      </View>

      <Text style={gallery.h2}>Spring scale-in</Text>
      <Text style={gallery.caption}>
        §5: the modal entry and the chain stamp are the same primitive. Reduced:
        instant appearance. Watch that only the new entry animates — §5 forbids
        the rest of the list reflowing.
      </Text>
      <View style={styles.stampCol}>
        <SpringIn key={stampKey}>
          <Card rotation={0}>
            <Text style={gallery.label}>Newest word stamps in</Text>
          </Card>
        </SpringIn>
        <Card rotation={0}>
          <Text style={gallery.label}>Older entry — must not move</Text>
        </Card>
      </View>
      <Button label="Stamp a word" onPress={() => setStampKey(k => k + 1)} />

      <Text style={gallery.h2}>Thinking indicator</Text>
      <Text style={gallery.caption}>
        §5: a 3-dot pulse in the monospace face, never a spinner. Reduced: dots
        hold static — the accompanying text carries the state, which is why this
        primitive requires one.
      </Text>
      <View style={styles.thinkingRow}>
        <Text style={gallery.label}>WordLoop is thinking</Text>
        <ThinkingDots />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flashBox: {
    borderWidth: borderWidth.base,
    borderColor: palette.ink,
    borderRadius: radius.control,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  shakeCol: { gap: spacing.md, marginBottom: spacing.md, alignItems: 'flex-start' },
  stampCol: { gap: spacing.md, marginBottom: spacing.md },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
});
