/**
 * Guest-to-account prompt policy.
 * Implements the frequency/cooldown rules agreed in Architecture doc
 * section 8.3:
 *
 *   Max 1 soft prompt per session.
 *   Max 3 soft prompts per 30-day cycle.
 *   After the 3rd dismissal in a cycle, suppress for 30 days.
 *   After 30 days, the cycle resets; prompts resume on the NEXT qualifying
 *   trigger (not automatically).
 *   Hard gates are exempt from this cap entirely.
 */

const MAX_PROMPTS_PER_CYCLE = 3;
const COOLDOWN_DAYS = 30;

export type SoftTriggerType =
  | 'first_game'
  | 'three_games'
  | 'personal_best'
  | 'streak_milestone'
  | 'new_words_milestone'
  | 'returning_day';

export type HardGateFeature =
  | 'vocabulary_history'
  | 'saved_words'
  | 'statistics'
  | 'backup_restore'
  | 'cross_device_play';

export interface AccountPromptState {
  currentCycleNumber: number;
  promptsShownInCycle: number;
  cycleStartedAt: string; // ISO date
  cooldownUntil: string | null; // ISO date
  hasShownThisSession: boolean;
}

export function createInitialPromptState(now: Date): AccountPromptState {
  return {
    currentCycleNumber: 1,
    promptsShownInCycle: 0,
    cycleStartedAt: now.toISOString(),
    cooldownUntil: null,
    hasShownThisSession: false,
  };
}

/**
 * Determines whether a soft prompt should be shown for a given trigger.
 * Hard gates are NOT evaluated by this function — those always prompt
 * (see Architecture doc section 8.2) and should call the account creation
 * flow directly rather than going through this policy check.
 */
export function shouldShowSoftPrompt(state: AccountPromptState, now: Date): boolean {
  if (state.hasShownThisSession) {
    return false;
  }

  if (state.cooldownUntil) {
    const cooldownEnd = new Date(state.cooldownUntil);
    if (now < cooldownEnd) {
      return false;
    }
    // Cooldown has elapsed — the cycle resets, but per policy we only
    // resume "starting from the next qualifying trigger", which this
    // function call itself represents. Caller is responsible for only
    // invoking this on an actual qualifying trigger event.
    return true;
  }

  return state.promptsShownInCycle < MAX_PROMPTS_PER_CYCLE;
}

/**
 * Records that a soft prompt was shown, advancing cycle state and setting
 * a cooldown if this was the 3rd dismissal-eligible prompt in the cycle.
 */
export function recordPromptShown(state: AccountPromptState, now: Date): AccountPromptState {
  const wasInCooldown = state.cooldownUntil !== null && now >= new Date(state.cooldownUntil);

  const promptsShownInCycle = wasInCooldown ? 1 : state.promptsShownInCycle + 1;
  const currentCycleNumber = wasInCooldown ? state.currentCycleNumber + 1 : state.currentCycleNumber;

  const reachedCap = promptsShownInCycle >= MAX_PROMPTS_PER_CYCLE;
  const cooldownUntil = reachedCap
    ? new Date(now.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    currentCycleNumber,
    promptsShownInCycle,
    cycleStartedAt: wasInCooldown ? now.toISOString() : state.cycleStartedAt,
    cooldownUntil,
    hasShownThisSession: true,
  };
}

export function resetSessionFlag(state: AccountPromptState): AccountPromptState {
  return { ...state, hasShownThisSession: false };
}
