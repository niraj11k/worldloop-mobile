/**
 * Headless round simulator (WL-113).
 *
 * Plays complete rounds with no UI, using the real production engines —
 * `gameSession`, `ruleEngine`, `difficultyEngine`, `scoringEngine`,
 * `startingWord` — rather than a parallel model of the rules. That is the
 * point of the exercise: this is the tuning instrument for Architecture doc
 * sections 6 and 7, so it has to fail the same way the shipped app would
 * fail, not a reimplementation's idea of how it would fail. Two things
 * building it actually surfaced turned out to matter more than the tool
 * itself — both below.
 *
 * ## The simulated player
 *
 * There is no PRD-specified model for an automated player — this is a
 * dev-tooling need the Delivery Plan invented, not a game rule. The choice
 * here: **uniform random pick from every word `validateMove` would accept**
 * for the required letter (PRD section 8.7's wider player-submittable set,
 * not the computer's narrower tier). That is a deliberately weak player —
 * it never tries to avoid a trap, and it draws on obscure vocabulary a real
 * casual player wouldn't have — which makes it a *lower bound* in intent: a
 * player who is actually paying attention should do at least as well. See
 * the finding below for why that intent didn't hold up at Hard.
 *
 * Every picked word is still run through the real `validateMove` before
 * being applied — not because it should ever fail (the pick already comes
 * from the accepted set), but because a mismatch would mean this module's
 * own filtering has drifted from the rule engine, which is exactly the kind
 * of silent drift worth failing loudly on rather than trusting.
 *
 * ## Finding 1: natural rounds run for hundreds to thousands of turns, not
 * "tens of words"
 *
 * The first version of this module assumed a round ends in roughly the
 * length WL-106/108 measured chains at (tens of words) and used that to size
 * a "this must be an infinite-loop bug" cutoff. Measured against the real
 * bundled dictionary, seeded, 30 rounds per difficulty:
 *
 * | Difficulty | Mean chain length | Player win rate |
 * |---|---|---|
 * | Easy | ~6,250 | 100% |
 * | Medium | ~1,140 | 3% |
 * | Hard | ~910 | 0% |
 *
 * Two things follow from this, and neither is a simulator bug — both were
 * checked by hand against the produced chains (real, non-repeating words)
 * and against `option_reduction_score`'s own logic:
 *
 * 1. **The dictionary is simply too large for genuine, whole-pool
 *    exhaustion to be a short-round event.** With ~140k player-allowed
 *    words, actually driving *every* remaining word for some letter to zero
 *    takes far longer than a casual round would ever run in practice. This
 *    means the state machine's own win/loss/draw conditions — the only
 *    ending this simulator or the shipped app can reach — are very unlikely
 *    to be what ends a *real* round. A real player almost certainly gives up
 *    (an ordinary `abandoned` exit) long before the dictionary genuinely
 *    runs dry for any letter. That is worth knowing before reading too much
 *    into PRD section 9.4's win-rate targets: they describe an ending
 *    condition that the current implementation can reach, but that real
 *    play may rarely if ever produce.
 * 2. **The extremes are exactly what `option_reduction_score` predicts, and
 *    that is itself the headline finding.** Easy (zero weight on option
 *    reduction) resolves to the *player* winning essentially every time —
 *    the computer, confined to the narrower non-obscure tier and not trying
 *    to preserve its own options, runs out first. Medium and Hard (0.5 and
 *    1.0 weight) invert that almost completely: the player is the one who
 *    gets blocked, at a **0% rate on Hard** against this player model — far
 *    outside the 20-40% PRD section 9.4 asks for, and exactly the "Hard
 *    sits at 0-5%, retune now" case the Phase 1 gate names. Whether that is
 *    Hard genuinely being over-tuned or this module's player being weaker
 *    than a real casual player (most likely both to some degree) is a
 *    question for WL-605, not this task — but the simulator did its job:
 *    this is now visible before a player ever saw it.
 *
 * ## Finding 2: `replyCountForLetter` undercounts what it excludes, and this
 * is not rare
 *
 * WL-108 found and fixed a gap where the computer's own move generation
 * didn't respect `MIN_WORD_LENGTH`. The *reply-count* precomputation
 * (WL-106, `scripts/generate-dictionary.py`'s `reply_counts_by_letter`) has
 * the same gap and was never patched to match, because doing so means
 * re-deriving the bundled asset. The first version of this module checked
 * only the round-*start* case (empty chain) and found the gap could never
 * fire — the thinnest letter still had 115 replies. That check was
 * incomplete: it is a **round-start** claim, not a general one. Once a round
 * runs long enough (see Finding 1 — routinely, not rarely) for a letter's
 * longer words to be genuinely exhausted, what's left can be entirely
 * sub-3-letter entries that `replyCountForLetter` still counts as available
 * replies. Measured: this fired on **29 of 30 Medium rounds and all 30 Hard
 * rounds** in the same run above.
 *
 * This module treats it as `phantomDeadEnd` and falls back to ending the
 * round (`computer_win` — no real submission could satisfy the length rule
 * either) rather than crashing or looping, which is the objectively correct
 * classification. **The shipped `GameScreen`/`gameSession` have no
 * equivalent fallback.** They would read `replyCountForLetter`'s phantom
 * nonzero count as "the player can still move" and simply wait — a real
 * player facing this would be legitimately, correctly stuck with no word
 * the rule engine would ever accept, and the app would not recognize the
 * round as over. That is a genuine correctness gap in shipped code,
 * surfaced by building this tool, not fixed by it — flagged in the Delivery
 * Plan under WL-106 rather than silently patched here.
 *
 * ## "Dead-letter frequency"
 *
 * The Delivery Plan asks the simulator to report this without defining it.
 * Taken here as **the round's `draw` rate** — the fraction of rounds where
 * the required letter dies for *both* sides, i.e. the wider player-allowed
 * set is exhausted too, not just the computer's narrower one. That is the
 * one ending in `gameSession`'s own vocabulary that means the *dictionary*
 * ran out rather than one side out-maneuvering the other. Given Finding 1,
 * expect this to read at or near 0% against the real dictionary — a
 * double-exhaustion is even less likely than the single-sided kind.
 */
import type { Difficulty } from '@navigation/types';
import type { GameStatus } from '@app-types/game';
import {
  createSession,
  applyValidation,
  applyComputerMove,
  applyComputerCannotMove,
  applyPlayerCannotMove,
  isRoundOver,
  usedWords,
} from '@features/game/gameSession';
import { validateMove, getRequiredLetter } from '@features/game/ruleEngine';
import {
  generateCandidates,
  selectComputerWord,
  createSeededRandom,
  type RandomSource,
} from '@features/difficulty/difficultyEngine';
import { rarityForEntry, scoreWord } from '@features/scoring/scoringEngine';
import {
  replyCountForLetter,
  allowedEntriesStartingWith,
  type DictionaryWord,
} from '@features/dictionary/dictionaryService';
import { nextStartingWord, resetStartingWordHistory } from '@features/game/startingWord';
import { MIN_WORD_LENGTH } from '@constants/gameConstants';

/**
 * A genuine safety valve, not a plausible-round-length assumption — see
 * Finding 1 above for why "tens of turns" was the wrong assumption to size
 * this against. 50,000 turns is roughly 8x the longest natural round
 * measured (Easy, ~6,250); at the ~1,800 turns/second this module runs at,
 * hitting it costs under a minute even in the worst case, and it should
 * fire only for a genuine defect (e.g. the same word being offered and
 * rejected in a cycle), not a long-but-legitimate round.
 */
const MAX_TURNS_PER_ROUND = 50_000;

/** Opening word if the dictionary can't offer one — mirrors `GameScreen`'s own fallback. */
const FALLBACK_STARTING_WORD = 'apple';

export interface RoundOutcome {
  status: GameStatus;
  chainLength: number;
  /** The player's score (`gameSession.score` never counts the computer's moves). */
  score: number;
  /** See Finding 2 in the module docblock. Not rare — track it, don't assume it. */
  phantomDeadEnd: boolean;
}

/**
 * The simulated player's move: uniform random over every word currently
 * submittable for `requiredLetter` (see the module docblock for why uniform,
 * and Finding 1 for what that produced). `entriesSource` is injectable so
 * the selection logic itself — length filtering, exclusion of used words —
 * can be unit-tested against a tiny fixture rather than the full bundle,
 * the same reasoning `difficultyEngine`'s `CandidateSource` and
 * `startingWord`'s `StartingWordSource` are injectable for.
 *
 * `null` means the letter is dead for the player under this model — either
 * genuinely (the `draw` case) or via the `phantomDeadEnd` gap.
 */
export function pickPlayerWord(
  requiredLetter: string,
  used: ReadonlySet<string>,
  random: RandomSource,
  entriesSource: (letter: string) => DictionaryWord[] = allowedEntriesStartingWith,
): string | null {
  const pool = entriesSource(requiredLetter).filter(
    entry => entry.normalizedWord.length >= MIN_WORD_LENGTH && !used.has(entry.normalizedWord),
  );
  if (pool.length === 0) {
    return null;
  }
  return pool[Math.floor(random() * pool.length)]!.normalizedWord;
}

/** Plays one complete round headlessly and reports how it ended. */
export async function simulateRound(params: {
  difficulty: Difficulty;
  random: RandomSource;
}): Promise<RoundOutcome> {
  const { difficulty, random } = params;

  let session = createSession({
    sessionId: `sim-${Math.floor(random() * 1e9)}`,
    difficulty,
    startingWord: nextStartingWord(random) ?? FALLBACK_STARTING_WORD,
  });

  let phantomDeadEnd = false;

  for (let turn = 0; turn < MAX_TURNS_PER_ROUND && !isRoundOver(session); turn++) {
    // --- Player's turn ---
    const usedBeforePlayer = usedWords(session);
    const playerReplies = replyCountForLetter(session.requiredLetter, usedBeforePlayer);
    if (playerReplies <= 0) {
      session = applyPlayerCannotMove(session);
      break;
    }

    const playerWord = pickPlayerWord(session.requiredLetter, usedBeforePlayer, random);
    if (playerWord === null) {
      // replyCountForLetter said there was a reply; there wasn't one this
      // module's own filtering could find. See Finding 2 — routine, not a bug.
      phantomDeadEnd = true;
      session = applyPlayerCannotMove(session);
      break;
    }

    const result = await validateMove({
      rawInput: playerWord,
      requiredLetter: session.requiredLetter,
      usedWords: usedBeforePlayer,
    });
    if (!result.isValid || result.entry === null) {
      // pickPlayerWord drew from the exact set validateMove is supposed to
      // accept. A rejection here means this module's own filtering has
      // drifted from the rule engine — a bug in the simulator, not a
      // possible game state, so it fails loudly rather than miscounting.
      throw new Error(
        `simulateRound: picked player word "${playerWord}" but validateMove rejected it ` +
          `(${String(result.reason)}) — pickPlayerWord has drifted from ruleEngine.ts.`,
      );
    }

    session = applyValidation(session, {
      submittedWord: playerWord,
      result,
      scoreAwarded: scoreWord({
        wordLength: result.normalizedWord.length,
        rarity: rarityForEntry(result.entry),
        hintUsed: false,
        hintRevealedWord: false,
      }),
    });

    if (isRoundOver(session)) {
      break;
    }

    // --- Computer's turn ---
    const usedAfterPlayer = usedWords(session);
    const choice = selectComputerWord(
      generateCandidates({ requiredLetter: session.requiredLetter, usedWords: usedAfterPlayer }),
      difficulty,
      random,
    );

    if (choice === null) {
      session = applyComputerCannotMove(session, {
        playerRepliesRemaining: replyCountForLetter(session.requiredLetter, usedAfterPlayer),
      });
      break;
    }

    const usedAfterComputer = new Set(usedAfterPlayer).add(choice.word);
    session = applyComputerMove(session, {
      word: choice.word,
      playerRepliesRemaining: replyCountForLetter(
        getRequiredLetter(choice.word),
        usedAfterComputer,
      ),
    });
  }

  if (!isRoundOver(session)) {
    throw new Error(
      `simulateRound: exceeded ${MAX_TURNS_PER_ROUND} turns without ending — this is the ` +
        `bug-trap case, not a long-but-legitimate round (see Finding 1). Chain length was ` +
        `${session.chain.length}.`,
    );
  }

  return {
    status: session.status,
    chainLength: session.chain.length,
    score: session.score,
    phantomDeadEnd,
  };
}

export interface SimulationReport {
  difficulty: Difficulty;
  rounds: number;
  seed: number;
  playerWinRate: number;
  computerWinRate: number;
  /** See the module docblock: this is this implementation's reading of "dead-letter frequency". */
  drawRate: number;
  meanChainLength: number;
  meanScore: number;
  /** See Finding 2. Expect this close to `rounds` at Medium/Hard, not close to 0. */
  phantomDeadEndCount: number;
}

/** Plays `rounds` complete rounds at `difficulty` and aggregates the results. */
export async function runSimulation(params: {
  difficulty: Difficulty;
  rounds: number;
  seed: number;
}): Promise<SimulationReport> {
  const { difficulty, rounds, seed } = params;
  const random = createSeededRandom(seed);

  // A fresh window per run: comparing difficulties (or reproducing a run
  // with the same seed) should not depend on what the process happened to
  // simulate immediately beforehand.
  resetStartingWordHistory();

  let playerWins = 0;
  let computerWins = 0;
  let draws = 0;
  let phantomDeadEndCount = 0;
  let chainLengthTotal = 0;
  let scoreTotal = 0;

  for (let i = 0; i < rounds; i++) {
    const outcome = await simulateRound({ difficulty, random });

    switch (outcome.status) {
      case 'player_win':
        playerWins += 1;
        break;
      case 'computer_win':
        computerWins += 1;
        break;
      case 'draw':
        draws += 1;
        break;
      case 'active':
      case 'abandoned':
      case 'technical_failure':
        // Unreachable: simulateRound only returns once isRoundOver is true,
        // and this harness never calls abandonSession or failSession. A
        // real occurrence means the state machine or this harness has a bug
        // worth seeing immediately, not a stat worth averaging in quietly.
        throw new Error(`runSimulation: unexpected round status "${outcome.status}".`);
      default: {
        const exhaustive: never = outcome.status;
        throw new Error(`runSimulation: unhandled round status "${String(exhaustive)}".`);
      }
    }

    if (outcome.phantomDeadEnd) {
      phantomDeadEndCount += 1;
    }
    chainLengthTotal += outcome.chainLength;
    scoreTotal += outcome.score;
  }

  return {
    difficulty,
    rounds,
    seed,
    playerWinRate: playerWins / rounds,
    computerWinRate: computerWins / rounds,
    drawRate: draws / rounds,
    meanChainLength: chainLengthTotal / rounds,
    meanScore: scoreTotal / rounds,
    phantomDeadEndCount,
  };
}
