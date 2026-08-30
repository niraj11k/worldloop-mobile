import { useReportStore } from '@store/useReportStore';
import { loadWordReports } from '@services/report/reportRepository';
import { storage, STORAGE_KEYS } from '@services/storage/storage';

/**
 * Everything the app forgets when it is killed: the store is a module-level
 * singleton, so resetting it is what makes the next `load` a genuine cold
 * start against whatever is actually in storage.
 */
const coldStart = () => useReportStore.setState({ reports: [], loaded: false });

describe('useReportStore (WL-505)', () => {
  beforeEach(async () => {
    await storage.removeItem(STORAGE_KEYS.WORD_REPORTS);
    coldStart();
  });

  it('persists a report across a cold start', () => {
    // The task's criterion: a report has to survive, because under D-03 it
    // sits on the device until the player exports it — possibly days later.
    return useReportStore
      .getState()
      .submit({ word: 'eagle', reportType: 'should_be_allowed' })
      .then(async () => {
        coldStart();
        await useReportStore.getState().load();

        const [stored] = useReportStore.getState().reports;
        expect(stored?.word).toBe('eagle');
        expect(stored?.reportType).toBe('should_be_allowed');
        expect(stored?.reviewStatus).toBe('pending');
      });
  });

  it('stamps the word list the word was judged against', () => {
    // Recorded per report rather than assumed at review time: the list is
    // versioned and regenerated (WL-102), so "was this still rejected under
    // the list they played?" is only answerable if the report says which.
    return useReportStore
      .getState()
      .submit({ word: 'eagle', reportType: 'too_obscure' })
      .then(() => {
        expect(useReportStore.getState().reports[0]?.dictionarySource).toContain('ESDB');
      });
  });

  it('does not overwrite a stored queue when submitting before a load', async () => {
    await useReportStore.getState().submit({ word: 'first', reportType: 'offensive' });

    // A fresh launch that goes straight to the game screen and reports a word
    // without Settings ever having loaded the queue.
    coldStart();
    await useReportStore.getState().submit({ word: 'second', reportType: 'offensive' });

    await expect(loadWordReports()).resolves.toHaveLength(2);
  });

  it('clears the queue for the guest-deletion path', async () => {
    await useReportStore.getState().submit({ word: 'eagle', reportType: 'offensive' });
    await useReportStore.getState().clear();

    expect(useReportStore.getState().reports).toEqual([]);
    await expect(loadWordReports()).resolves.toEqual([]);
  });
});
