/**
 * Which End Game message a player sees (Wireframe §14, Delivery Plan D-15).
 *
 * Pure: the copy is data in `END_GAME_CONTENT`, and this module only decides
 * which tier applies, from the game's real numbers. Kept out of the panel so
 * every tier can be reached in a unit test without rendering anything.
 */
import { END_GAME_CONTENT, GAME_OVER_CONTENT } from '@constants/gameConstants';
import type { GameSessionState, GameStatus } from '@app-types/game';

export type EndGameTier = 'newBest' | 'oneNewWord' | 'newWords' | 'longGame' | 'shortGame';

export interface EndGameMessage {
  tier: EndGameTier;
  headline: string;
  line: string;
  /**
   * The message already names the new words, so the panel hides its "New words
   * discovered" stat line rather than say it twice (§14).
   */
  mentionsNewWords: boolean;
  /**
   * The message already announces a new best, so the panel hides its "New
   * personal best!" line for the same reason. §14 states the rule for new words
   * only; it is applied here because its stated purpose — "so the screen
   * doesn't repeat itself" — covers this pair just as well.
   */
  mentionsPersonalBest: boolean;
}

export function endGameMessage(game: {
  chainLength: number;
  isPersonalBest: boolean;
  /** The words this game added to the player's vocabulary, in order found. */
  newWords: string[];
}): EndGameMessage {
  const { chainLength, isPersonalBest, newWords } = game;

  if (isPersonalBest) {
    const { headline, line } = END_GAME_CONTENT.newBest;
    return message('newBest', headline, line(chainLength), false, true);
  }
  const [onlyWord] = newWords;
  if (newWords.length === 1 && onlyWord !== undefined) {
    const { headline, line } = END_GAME_CONTENT.oneNewWord;
    return message('oneNewWord', headline, line(onlyWord), true, false);
  }
  if (newWords.length >= 2) {
    const { headline, line } = END_GAME_CONTENT.newWords;
    return message('newWords', headline, line(newWords.length), true, false);
  }
  if (chainLength >= END_GAME_CONTENT.longGameMinWords) {
    const { headline, line } = END_GAME_CONTENT.longGame;
    return message('longGame', headline, line(chainLength), false, false);
  }
  const { headline, line } = END_GAME_CONTENT.shortGame;
  return message('shortGame', headline, line(), false, false);
}

function message(
  tier: EndGameTier,
  headline: string,
  line: string,
  mentionsNewWords: boolean,
  mentionsPersonalBest: boolean,
): EndGameMessage {
  return { tier, headline, line, mentionsNewWords, mentionsPersonalBest };
}

/** Everything the game-over panel says, decided in one place. */
export interface GameOverCopy {
  headline: string;
  description: string;
  /** The End Game sign-off, or `null` for every other result. */
  signOff: string | null;
  showNewWordsStat: boolean;
  showPersonalBestStat: boolean;
}

/**
 * The game-over panel's copy for any finished game (Wireframe §14).
 *
 * The one rule that matters: only a game the *player* ended gets the End Game
 * message. A genuine computer win — the computer left the player with no
 * words — keeps `GAME_OVER_CONTENT.computer_win`, which is true in that case
 * and would be false after End Game, even though both are recorded as
 * `computer_win` (D-15).
 */
export function gameOverCopy(game: {
  session: GameSessionState;
  isPersonalBest: boolean;
  newWords: string[];
}): GameOverCopy {
  const { session, isPersonalBest, newWords } = game;

  if (session.endedByPlayer) {
    const chosen = endGameMessage({
      chainLength: session.chain.length,
      isPersonalBest,
      newWords,
    });
    return {
      headline: chosen.headline,
      description: chosen.line,
      signOff: END_GAME_CONTENT.signOff,
      showNewWordsStat: newWords.length > 0 && !chosen.mentionsNewWords,
      showPersonalBestStat: isPersonalBest && !chosen.mentionsPersonalBest,
    };
  }

  const standard = GAME_OVER_CONTENT[session.status as Exclude<GameStatus, 'active'>];
  return {
    headline: standard.headline,
    description: standard.description,
    signOff: null,
    showNewWordsStat: newWords.length > 0,
    showPersonalBestStat: isPersonalBest,
  };
}
