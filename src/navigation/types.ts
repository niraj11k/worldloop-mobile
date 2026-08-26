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
  Game: { difficulty: Difficulty };
  HowToPlay: undefined;
  WordReview: { sessionId: string };
  Settings: undefined;
  AccountCreation: { entryPoint: AccountEntryPoint };
  /** Dev-only (WL-201 font specimen); not registered in release builds. */
  FontSpecimen: undefined;
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
