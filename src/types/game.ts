/**
 * Domain types for game session state.
 * Mirrors Data Model doc sections 4 (GameSession) and 5 (Move).
 */

export type InvalidReason =
  | 'wrong_letter'
  | 'unknown_word'
  | 'proper_noun'
  | 'duplicate'
  | 'too_short'
  | 'unsupported_symbols'
  | 'offensive_excluded';

/**
 * Round outcomes, one per result state the game-over screen must render
 * (Wireframe doc section 14), plus `active` for a round in progress.
 *
 * `technical_failure` was added by WL-110. The Data Model doc's ratification
 * pass (section 6) found that Wireframe section 14 requires five result
 * states while this union offered four, so the fifth was being silently
 * absorbed into whichever status was nearest — most likely `abandoned`. That
 * would tell a player "you exited" when the app had in fact broken, and would
 * hide genuine failures inside an ordinary-looking metric. It is reachable:
 * a corrupt dictionary asset throws during index construction
 * (`dictionaryService`), and Wireframe section 17 specifies a "dictionary
 * unavailable" state. The doc asked for this to be decided once, in either
 * WL-110 or WL-308 — decided here.
 */
export type GameStatus =
  | 'active'
  | 'player_win'
  | 'computer_win'
  | 'draw'
  | 'abandoned'
  | 'technical_failure';

export type TurnPhase =
  | 'player_turn'
  | 'input_empty'
  | 'validating'
  | 'computer_thinking'
  | 'invalid_word'
  | 'valid_move'
  | 'no_computer_move';

/**
 * Wireframe doc section 11 / PRD section 13's four hint levels. Levels 1-3
 * are wired at WL-307; level 4 (definition-based clue) is WL-504, Phase 5.
 */
export type HintLevel = 'required_letter' | 'word_count' | 'example_word' | 'definition_clue';

export interface Move {
  moveId: string;
  turnNumber: number;
  actor: 'player' | 'computer';
  submittedWord: string;
  normalizedWord: string;
  isValid: boolean;
  invalidReason: InvalidReason | null;
  hintUsed: boolean;
  /** The deepest hint level shown this move, or `null` if no hint was used. */
  hintLevel: HintLevel | null;
  scoreAwarded: number;
}

export interface GameSessionState {
  sessionId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  currentWord: string;
  requiredLetter: string;
  status: GameStatus;
  phase: TurnPhase;
  chain: Move[];
  score: number;
  hintsUsed: number;
  isOfflineSession: boolean;
  /** Longest chain the player has recorded before this round; null if unknown. */
  previousBestChainLength: number | null;
}
