import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * The current time, refreshed whenever the player comes back to the screen —
 * the app returning to the foreground, or the screen regaining focus.
 *
 * For labels that age, like Home's "yesterday" / "3 days ago" (D-14). Reading
 * `new Date()` during render is not enough on its own: Home stays mounted
 * under the game and while the app sits in the background, so nothing
 * re-renders it when the day changes. Found on the simulator, where an app
 * left on Home overnight still showed the previous day's ages the next
 * evening. Coming back to the app or the screen is exactly when the player
 * reads the label again, so that is when it is refreshed.
 */
export function useNowOnReturn(): Date {
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);

  return now;
}
