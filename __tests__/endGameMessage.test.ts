import {
  abandonSession,
  applyComputerMove,
  applyPlayerCannotMove,
  applyValidation,
  beginComputerTurn,
  beginValidation,
  createSession,
  endByPlayer,
  setInput,
} from '@features/game/gameSession';
import { endGameMessage, gameOverCopy } from '@features/game/endGameMessage';
import {
  createGuestProfile,
  discoveredWordsForSession,
  parseProfile,
  recordRoundCompleted,
  serializeProfile,
  summarizeRound,
} from '@features/profile/guestProfile';
import { END_GAME_CONTENT, GAME_OVER_CONTENT } from '@constants/gameConstants';
import type { GameSessionState } from '@app-types/game';
import type { GuestProfile } from '@app-types/profile';

const NOW = new Date('2026-11-04T10:00:00.000Z');

const playerPlays = (state: GameSessionState, word: string): GameSessionState =>
  applyValidation(beginValidation(setInput(state, word)), {
    submittedWord: word,
    result: { isValid: true, normalizedWord: word, reason: null, entry: null },
    scoreAwarded: 12,
  });

/**
 * A real game, played through the session machine and folded into a real
 * profile: `playerWords` are the player's turns, each answered by the
 * computer. `knownWords` are already in the player's vocabulary; `best` is
 * their longest chain before this game. Returns exactly what the game-over
 * panel is given.
 */
function endGame(opts: {
  playerWords: string[];
  knownWords?: string[];
  best: number;
  end?: (state: GameSessionState) => GameSessionState;
}) {
  const base = createGuestProfile({ now: NOW, guestId: 'guest-1' });
  const profile: GuestProfile = {
    ...base,
    bests: { ...base.bests, chainLength: opts.best },
    discoveredWords: (opts.knownWords ?? []).map(word => ({
      ownerType: 'guest',
      ownerId: base.guestId,
      word,
      sessionId: 'an-earlier-game',
      definitionViewed: false,
      pronunciationViewed: false,
      firstSeenAt: NOW.toISOString(),
    })),
  };

  let session = createSession({
    sessionId: 'this-game',
    difficulty: 'easy',
    startingWord: 'apple',
    previousBestChainLength: opts.best,
  });
  opts.playerWords.forEach((word, i) => {
    session = playerPlays(session, word);
    session = applyComputerMove(beginComputerTurn(session), {
      word: `reply${i}`,
      playerRepliesRemaining: 500,
    });
  });

  const ended = (opts.end ?? endByPlayer)(session);
  const after = recordRoundCompleted(profile, ended, NOW);
  const newWords = discoveredWordsForSession(after, ended.sessionId).map(entry => entry.word);
  const isPersonalBest = summarizeRound(ended, NOW)?.isPersonalBest ?? false;
  return {
    ended,
    after,
    newWords,
    isPersonalBest,
    copy: gameOverCopy({ session: ended, isPersonalBest, newWords }),
  };
}

describe('End Game message tiers (Wireframe §14, D-15)', () => {
  it('tier 1 — a new longest chain wins over everything else', () => {
    // Also found a new word; the best still takes the message.
    const { copy } = endGame({ playerWords: ['eagle'], best: 2 });
    expect(copy.headline).toBe('New Best Chain!');
    expect(copy.description).toBe('3 words in a row — your longest yet.');
    // Said in the message, so not repeated as a stat line.
    expect(copy.showPersonalBestStat).toBe(false);
    expect(copy.showNewWordsStat).toBe(true);
  });

  it('tier 2 — exactly one new word is named, in capitals', () => {
    const { copy } = endGame({ playerWords: ['zephyr'], best: 50 });
    expect(copy.headline).toBe('Nice Find!');
    expect(copy.description).toBe(
      "You discovered a new word: ZEPHYR. It's waiting in Review Words.",
    );
    expect(copy.showNewWordsStat).toBe(false);
  });

  it('tier 3 — several new words are counted', () => {
    const { copy } = endGame({ playerWords: ['eagle', 'tiger', 'robin', 'nectar'], best: 50 });
    expect(copy.headline).toBe('Words Collected!');
    expect(copy.description).toBe(
      'You discovered 4 new words this game. See them in Review Words.',
    );
    expect(copy.showNewWordsStat).toBe(false);
  });

  it('tier 4 — 10+ words with nothing new', () => {
    const words = ['eagle', 'tiger', 'robin', 'nectar', 'raven'];
    const { ended, copy } = endGame({ playerWords: words, knownWords: words, best: 50 });
    expect(ended.chain).toHaveLength(11);
    expect(copy.headline).toBe('Well Played!');
    expect(copy.description).toBe(
      "11 words strong. Your next chain starts whenever you're ready.",
    );
  });

  it('tier 5 — a short game with nothing new', () => {
    const { copy } = endGame({ playerWords: ['eagle'], knownWords: ['eagle'], best: 50 });
    expect(copy.headline).toBe('Good Game!');
    expect(copy.description).toBe('Every chain starts with one word. Ready for a fresh letter?');
  });

  it('a 9-word chain is still short; 10 is the line', () => {
    const words = ['eagle', 'tiger', 'robin', 'nectar'];
    const { ended, copy } = endGame({ playerWords: words, knownWords: words, best: 50 });
    expect(ended.chain).toHaveLength(9);
    expect(copy.headline).toBe('Good Game!');
    expect(
      endGameMessage({ chainLength: 10, isPersonalBest: false, newWords: [] }).headline,
    ).toBe('Well Played!');
  });

  it('every End Game result closes with the sign-off', () => {
    const { copy } = endGame({ playerWords: ['eagle'], knownWords: ['eagle'], best: 50 });
    expect(copy.signOff).toBe('Sorry to see you go. Hope to see you in the next game!');
    expect(END_GAME_CONTENT.signOff).toBe(copy.signOff);
  });

  it('never uses the phrasing §14 rules out', () => {
    const banned = /don't give up|better luck|you lost/i;
    const all = [
      endGameMessage({ chainLength: 23, isPersonalBest: true, newWords: [] }),
      endGameMessage({ chainLength: 5, isPersonalBest: false, newWords: ['zephyr'] }),
      endGameMessage({ chainLength: 5, isPersonalBest: false, newWords: ['a', 'b'] }),
      endGameMessage({ chainLength: 18, isPersonalBest: false, newWords: [] }),
      endGameMessage({ chainLength: 3, isPersonalBest: false, newWords: [] }),
    ];
    all.forEach(m => expect(`${m.headline} ${m.line}`).not.toMatch(banned));
    expect(END_GAME_CONTENT.signOff).not.toMatch(banned);
  });
});

describe('only a player-ended game gets the End Game message', () => {
  it('a genuine computer win keeps its existing copy, with no sign-off', () => {
    const { ended, copy } = endGame({
      playerWords: ['eagle'],
      best: 50,
      end: applyPlayerCannotMove,
    });
    expect(ended.status).toBe('computer_win');
    expect(ended.endedByPlayer).toBe(false);
    expect(copy.headline).toBe(GAME_OVER_CONTENT.computer_win.headline);
    expect(copy.description).toBe(GAME_OVER_CONTENT.computer_win.description);
    expect(copy.signOff).toBeNull();
  });

  it('the timeout’s End Round is still recorded as the player exiting', () => {
    const { ended, copy } = endGame({ playerWords: ['eagle'], best: 50, end: abandonSession });
    expect(ended.status).toBe('abandoned');
    expect(copy.headline).toBe(GAME_OVER_CONTENT.abandoned.headline);
  });
});

describe('endByPlayer records a computer win the player chose (D-15)', () => {
  it('is a computer win, marked as player-ended', () => {
    const { ended } = endGame({ playerWords: ['eagle'], best: 50 });
    expect(ended.status).toBe('computer_win');
    expect(ended.endedByPlayer).toBe(true);
  });

  it('counts as a game played, and towards the bests', () => {
    const { after } = endGame({ playerWords: ['eagle', 'tiger'], best: 2 });
    expect(after.gamesPlayed).toBe(1);
    expect(after.bests.chainLength).toBe(5);
    expect(after.localScores[0]?.endedByPlayer).toBe(true);
    expect(after.localScores[0]?.result).toBe('computer_win');
  });

  it('pays the personal-best +5, but no win bonus', () => {
    const base = playerPlays(
      createSession({
        sessionId: 's',
        difficulty: 'easy',
        startingWord: 'apple',
        previousBestChainLength: 1,
      }),
      'eagle',
    );
    expect(endByPlayer(base).score).toBe(base.score + 5);
  });

  it('starts false, and cannot change a game that is already over', () => {
    const fresh = createSession({ sessionId: 's', difficulty: 'easy', startingWord: 'apple' });
    expect(fresh.endedByPlayer).toBe(false);
    const won = applyPlayerCannotMove(playerPlays(fresh, 'eagle'));
    expect(endByPlayer(won)).toBe(won);
  });

  it('reads rounds recorded before WL-412 as not ended by the player', () => {
    const { after } = endGame({ playerWords: ['eagle'], best: 50 });
    const stored = JSON.parse(serializeProfile(after));
    delete stored.localScores[0].endedByPlayer;
    expect(parseProfile(JSON.stringify(stored))?.localScores[0]?.endedByPlayer).toBe(false);
  });
});
