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

export type GameStatus = 'active' | 'player_win' | 'computer_win' | 'draw' | 'abandoned';

export type TurnPhase =
  | 'player_turn'
  | 'input_empty'
  | 'validating'
  | 'computer_thinking'
  | 'invalid_word'
  | 'valid_move'
  | 'no_computer_move';

export interface Move {
  moveId: string;
  turnNumber: number;
  actor: 'player' | 'computer';
  submittedWord: string;
  normalizedWord: string;
  isValid: boolean;
  invalidReason: InvalidReason | null;
  hintUsed: boolean;
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
}
