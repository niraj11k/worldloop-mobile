import { useCallback, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NavigationAction } from '@react-navigation/native';

export interface ConfirmBeforeLeave {
  /** True while a leave attempt is held pending the player's answer. */
  confirmVisible: boolean;
  /** Let the leave attempt through, exactly as it was originally made. */
  confirmLeave: () => void;
  /** Stay on the screen and forget the attempt. */
  cancelLeave: () => void;
}

/**
 * Holds every attempt to leave the current screen until the player confirms
 * it (WL-401, Wireframe section 13: "confirm before restarting or exiting",
 * "do not lose the chain if the user leaves temporarily").
 *
 * ## Why one hook covers every way off the screen
 *
 * `usePreventRemove` intercepts the *navigation action*, not any particular
 * control, so the in-screen back button, the Android hardware back button,
 * the iOS swipe-back gesture, and any programmatic `goBack` / `popTo` from
 * elsewhere in the screen all arrive here. Guarding the back Pressable's
 * `onPress` instead would have covered exactly one of those four, and the
 * other three are the ones that lose rounds silently.
 *
 * It also disables the native dismissals it cannot otherwise intercept:
 * `native-stack` reads the prevented-route registry this hook writes to and
 * sets `preventNativeDismiss` on iOS, so the swipe gesture is stopped by the
 * platform rather than being allowed to complete and then undone. This is why
 * the hook is `usePreventRemove` and not a bare `beforeRemove` listener,
 * which on this stack would not stop the gesture.
 *
 * ## Replaying the held action
 *
 * `confirmLeave` dispatches the original action rather than calling
 * `goBack()`, so "back" goes back and "exit to Home" exits to Home — the
 * confirmation resolves the choice, it does not decide the destination. The
 * replay is not re-intercepted even though the guard is still armed: React
 * Navigation tags the action with the routes that have already answered for
 * it, and skips them on the way through.
 *
 * @param enabled whether leaving currently needs confirming. Flip it to
 * `false` once there is nothing left to lose (a finished round) and every
 * route off the screen becomes immediate again.
 */
export function useConfirmBeforeLeave(enabled: boolean): ConfirmBeforeLeave {
  const navigation = useNavigation();
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);

  usePreventRemove(enabled, ({ data }) => {
    setPendingAction(data.action);
  });

  const confirmLeave = useCallback(() => {
    if (pendingAction === null) return;
    // Cleared first: the dispatch unmounts this screen, and a `setState` on
    // the way out would be dropped anyway.
    setPendingAction(null);
    navigation.dispatch(pendingAction);
  }, [navigation, pendingAction]);

  const cancelLeave = useCallback(() => {
    setPendingAction(null);
  }, []);

  return { confirmVisible: pendingAction !== null, confirmLeave, cancelLeave };
}
