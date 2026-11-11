import {
  createSession,
  applyComputerMove,
  applyComputerCannotMove,
  usedWords,
} from '@features/game/gameSession';
import {
  allowedEntriesStartingWith,
  replyCountForLetter,
} from '@features/dictionary/dictionaryService';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';

/**
 * BR-09 (found by WL-113): the stuck-player case, end to end through the real
 * dictionary asset and the real session state machine.
 *
 * Before the fix `replyCountForLetter` still counted 2-letter entries the
 * rule engine rejects, so once a letter's playable words were all used the
 * count stayed above zero, `applyComputerMove` never ended the round, and the
 * player sat in a round with no legal reply. The session needed no change:
 * it already ends the round on a zero count, the count was just wrong.
 */
describe('stuck player (BR-09)', () => {
  const playableX = allowedEntriesStartingWith('x')
    .map(entry => entry.normalizedWord)
    .filter(word => word.length >= MIN_WORD_LENGTH);

  it('ends the round for the computer when its word leaves the player no playable reply', () => {
    // Every playable x-word is already on the chain; the computer then plays
    // a word ending in x, so the player must start their reply with x.
    let session = createSession({ sessionId: 's1', difficulty: 'hard', startingWord: 'apple' });
    for (const word of playableX) {
      session = applyComputerMove(session, { word, playerRepliesRemaining: 1 });
    }
    const afterComputer = new Set(usedWords(session)).add('tax');
    const playerRepliesRemaining = replyCountForLetter('x', afterComputer);

    expect(playerRepliesRemaining).toBe(0);
    session = applyComputerMove(session, { word: 'tax', playerRepliesRemaining });
    expect(session.status).toBe('computer_win');
  });

  it('calls a draw, not a player win, when the letter is dead for both sides', () => {
    const session = createSession({ sessionId: 's2', difficulty: 'hard', startingWord: 'tax' });
    const used = new Set(playableX);
    const ended = applyComputerCannotMove(session, {
      playerRepliesRemaining: replyCountForLetter('x', used),
    });
    expect(ended.status).toBe('draw');
  });
});
