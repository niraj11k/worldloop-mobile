/**
 * Argv parsing and report formatting for `npm run simulate` (WL-113).
 * The actual simulation lives in `src/features/game/roundSimulator.ts` —
 * see that module for what each figure means, why "dead-letter frequency"
 * is defined the way it is, and the two findings building it turned up
 * (natural round lengths run to hundreds/thousands of turns, and Hard reads
 * ~0% player win rate against this module's deliberately weak player).
 */
import type { Difficulty } from '@navigation/types';
import { runSimulation, type SimulationReport } from '@features/game/roundSimulator';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

// Kept modest deliberately: natural rounds run to hundreds or thousands of
// turns (see roundSimulator.ts, Finding 1), so this is tuned for a quick
// sanity-check invocation to complete in well under a minute per
// difficulty, not for statistical confidence. Pass --rounds 500, as the
// Delivery Plan's own example does, for a real tuning pass — expect that to
// take several minutes, Easy longest of the three.
const DEFAULT_ROUNDS = 30;

type DifficultyArg = Difficulty | 'all';

interface Args {
  difficulty: DifficultyArg;
  rounds: number;
  seed: number;
}

function isDifficultyArg(value: string): value is DifficultyArg {
  return value === 'all' || (DIFFICULTIES as string[]).includes(value);
}

function parseArgs(argv: string[]): Args {
  let difficulty: DifficultyArg | null = null;
  let rounds = DEFAULT_ROUNDS;
  // Not fixed: a tuning tool that always reran the same rounds would hide
  // how much of a result is signal versus seed luck. Printed below so any
  // specific run can still be reproduced with --seed.
  let seed = Date.now();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--difficulty' && next !== undefined) {
      if (!isDifficultyArg(next)) {
        throw new Error(
          `--difficulty must be one of ${DIFFICULTIES.join(', ')}, or "all", got "${next}".`,
        );
      }
      difficulty = next;
      i += 1;
    } else if (arg === '--rounds' && next !== undefined) {
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`--rounds must be a positive integer, got "${next}".`);
      }
      rounds = parsed;
      i += 1;
    } else if (arg === '--seed' && next !== undefined) {
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed)) {
        throw new Error(`--seed must be an integer, got "${next}".`);
      }
      seed = parsed;
      i += 1;
    } else {
      throw new Error(`Unrecognized argument "${arg}".`);
    }
  }

  if (difficulty === null) {
    throw new Error('--difficulty is required.');
  }

  return { difficulty, rounds, seed };
}

function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function printReport(report: SimulationReport): void {
  console.log(
    `\n${report.difficulty.toUpperCase()} — ${report.rounds} rounds, seed ${report.seed}`,
  );
  console.log('-'.repeat(48));
  console.log(`  Player win rate         ${formatPercent(report.playerWinRate)}`);
  console.log(`  Computer win rate       ${formatPercent(report.computerWinRate)}`);
  console.log(
    `  Dead-letter frequency   ${formatPercent(report.drawRate)}  (draws — see roundSimulator.ts)`,
  );
  console.log(`  Mean chain length       ${report.meanChainLength.toFixed(1)} words`);
  console.log(`  Mean score              ${report.meanScore.toFixed(1)}`);
  console.log(
    `  Length-gap endings      ${report.phantomDeadEndCount}/${report.rounds}  ` +
      '(see "Finding 2" in roundSimulator.ts — expected to be common at Medium/Hard, not a bug)',
  );
}

/** PRD section 9.4: Hard must not be unbeatable. Purely advisory — never fails the run. */
function checkHardBand(report: SimulationReport): void {
  const inBand = report.playerWinRate >= 0.2 && report.playerWinRate <= 0.4;
  console.log(
    `\nPRD section 9.4 / Phase 1 gate: Hard player win rate should sit in 20-40%. ` +
      (inBand
        ? `PASS (${formatPercent(report.playerWinRate)}).`
        : `NEEDS ATTENTION (${formatPercent(report.playerWinRate)}) — see roundSimulator.ts's ` +
            'Finding 1 before assuming this alone means retune the weights; it may also mean ' +
            'this module\'s player model is too weak to be a fair read at Hard.'),
  );
}

export async function main(argv: string[]): Promise<void> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    console.error(
      '\nUsage: npm run simulate -- --difficulty easy|medium|hard|all [--rounds N] [--seed N]\n' +
        '  "all" runs all three and checks the PRD 9.4 / Phase 1 gate against Hard.',
    );
    process.exitCode = 1;
    return;
  }

  const difficulties = args.difficulty === 'all' ? DIFFICULTIES : [args.difficulty];
  const reports: SimulationReport[] = [];

  for (const difficulty of difficulties) {
    // Same seed across difficulties on a multi-difficulty run: round 1 then
    // opens on the same starting word for each, which is the only point in
    // the round where cross-difficulty randomness hasn't yet diverged.
    const report = await runSimulation({ difficulty, rounds: args.rounds, seed: args.seed });
    reports.push(report);
    printReport(report);
  }

  const hard = reports.find(r => r.difficulty === 'hard');
  if (hard !== undefined) {
    checkHardBand(hard);
  }
}
