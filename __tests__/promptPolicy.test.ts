import {
  createInitialPromptState,
  shouldShowSoftPrompt,
  recordPromptShown,
  resetSessionFlag,
  type AccountPromptState,
} from '@features/account/promptPolicy';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('promptPolicy', () => {
  describe('createInitialPromptState', () => {
    it('starts cycle 1 with no prompts shown and no cooldown', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      expect(createInitialPromptState(now)).toEqual<AccountPromptState>({
        currentCycleNumber: 1,
        promptsShownInCycle: 0,
        cycleStartedAt: now.toISOString(),
        cooldownUntil: null,
        hasShownThisSession: false,
      });
    });
  });

  describe('shouldShowSoftPrompt', () => {
    const base: AccountPromptState = {
      currentCycleNumber: 1,
      promptsShownInCycle: 0,
      cycleStartedAt: '2026-01-01T00:00:00.000Z',
      cooldownUntil: null,
      hasShownThisSession: false,
    };

    it('is false once a prompt has already been shown this session, regardless of everything else', () => {
      const state: AccountPromptState = { ...base, hasShownThisSession: true };
      expect(shouldShowSoftPrompt(state, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
    });

    it('is true when under the per-cycle cap and no cooldown is set', () => {
      const state: AccountPromptState = { ...base, promptsShownInCycle: 2 };
      expect(shouldShowSoftPrompt(state, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
    });

    it('is false at or above the per-cycle cap with no cooldown recorded (defensive branch)', () => {
      const state: AccountPromptState = { ...base, promptsShownInCycle: 3 };
      expect(shouldShowSoftPrompt(state, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
    });

    it('is false while an active cooldown has not yet elapsed', () => {
      const state: AccountPromptState = {
        ...base,
        promptsShownInCycle: 3,
        cooldownUntil: '2026-02-01T00:00:00.000Z',
      };
      expect(shouldShowSoftPrompt(state, new Date('2026-01-15T00:00:00.000Z'))).toBe(false);
    });

    it('is true once the cooldown has fully elapsed', () => {
      const state: AccountPromptState = {
        ...base,
        promptsShownInCycle: 3,
        cooldownUntil: '2026-02-01T00:00:00.000Z',
      };
      expect(shouldShowSoftPrompt(state, new Date('2026-03-01T00:00:00.000Z'))).toBe(true);
    });
  });

  describe('recordPromptShown', () => {
    it('increments the cycle count on a normal prompt, without touching cooldown or cycle number', () => {
      const state: AccountPromptState = {
        currentCycleNumber: 1,
        promptsShownInCycle: 0,
        cycleStartedAt: '2026-01-01T00:00:00.000Z',
        cooldownUntil: null,
        hasShownThisSession: false,
      };
      const next = recordPromptShown(state, new Date('2026-01-05T00:00:00.000Z'));

      expect(next.promptsShownInCycle).toBe(1);
      expect(next.currentCycleNumber).toBe(1);
      expect(next.cooldownUntil).toBeNull();
      expect(next.cycleStartedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(next.hasShownThisSession).toBe(true);
    });

    it('sets a 30-day cooldown on the prompt that reaches the per-cycle cap', () => {
      const state: AccountPromptState = {
        currentCycleNumber: 1,
        promptsShownInCycle: 2,
        cycleStartedAt: '2026-01-01T00:00:00.000Z',
        cooldownUntil: null,
        hasShownThisSession: false,
      };
      const now = new Date('2026-01-10T00:00:00.000Z');
      const next = recordPromptShown(state, now);

      expect(next.promptsShownInCycle).toBe(3);
      expect(next.currentCycleNumber).toBe(1);
      expect(next.cooldownUntil).toBe(new Date(now.getTime() + 30 * DAY_MS).toISOString());
    });

    // This is the mechanism Architecture doc section 8.3 calls out by name:
    // "the cycle resets; soft prompts resume starting from the next
    // qualifying trigger (not automatically)". A bug here would stay
    // invisible until a real 30-day cooldown window had actually elapsed in
    // production.
    it('starts a new cycle — resetting the count to 1, not 0 — when called after the cooldown has elapsed', () => {
      const state: AccountPromptState = {
        currentCycleNumber: 1,
        promptsShownInCycle: 3,
        cycleStartedAt: '2026-01-01T00:00:00.000Z',
        cooldownUntil: '2026-02-01T00:00:00.000Z',
        hasShownThisSession: false,
      };
      const now = new Date('2026-03-05T00:00:00.000Z');
      const next = recordPromptShown(state, now);

      expect(next.currentCycleNumber).toBe(2);
      expect(next.promptsShownInCycle).toBe(1);
      expect(next.cycleStartedAt).toBe(now.toISOString());
      expect(next.cooldownUntil).toBeNull();
      expect(next.hasShownThisSession).toBe(true);
    });
  });

  describe('resetSessionFlag', () => {
    it('clears hasShownThisSession without changing anything else', () => {
      const state: AccountPromptState = {
        currentCycleNumber: 2,
        promptsShownInCycle: 1,
        cycleStartedAt: '2026-01-01T00:00:00.000Z',
        cooldownUntil: null,
        hasShownThisSession: true,
      };
      expect(resetSessionFlag(state)).toEqual<AccountPromptState>({ ...state, hasShownThisSession: false });
    });
  });
});
