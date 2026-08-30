/**
 * Navigation param list.
 *
 * Mirrors the navigation structure defined in the Wireframe Requirements doc,
 * section 2:
 *
 * Welcome -> Home -> { Play, HowToPlay, WordReview, Settings }
 * Play -> Difficulty -> Game -> { Hint, WordDefinition, Pause, GameOver }
 */
export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Difficulty: undefined;
  /**
   * `resume` asks the screen to pick up the saved round in progress (WL-403)
   * instead of dealing a new one. Only Home's "Resume Game" sets it, and only
   * when a round is actually saved; `difficulty` still comes along so the
   * route is self-describing and the screen has a value if the save turns out
   * to be gone.
   */
  Game: { difficulty: Difficulty; resume?: boolean };
  HowToPlay: undefined;
  /**
   * `sessionId` names the round whose new words lead the list (arriving from
   * Game Over). Omitted from Home, where there is no round behind the screen
   * and it shows the whole vocabulary — before WL-502 that entry point passed
   * a `'latest'` sentinel no screen ever read.
   */
  WordReview: { sessionId?: string } | undefined;
  Settings: undefined;
  /**
   * The licence notices WordLoop is obliged to display (WL-407). A route of
   * its own rather than a sheet: it is long, it is read rarely and slowly,
   * and store review looks for it.
   */
  Attributions: undefined;
  AccountCreation: { entryPoint: AccountEntryPoint };
  /** Dev-only component gallery (WL-206); not registered in release builds. */
  Gallery: undefined;
};

export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Matches Architecture doc section 8.2 / analytics event `entry_point`.
 */
export type AccountEntryPoint = 'game_over' | 'settings' | 'sync_feature' | 'milestone';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
