import {
  reportError,
  logBreadcrumb,
  setCrashReporter,
  type CrashReporter,
} from '@services/crashReporting/crashReporting';

function recordingReporter() {
  const errors: Array<{ error: Error; context?: Record<string, unknown> }> = [];
  const logs: string[] = [];
  const reporter: CrashReporter = {
    recordError: (error, context) => errors.push({ error, context }),
    log: message => logs.push(message),
  };
  return { reporter, errors, logs };
}

describe('crashReporting', () => {
  afterEach(() => {
    setCrashReporter({ recordError: () => {}, log: () => {} });
  });

  it('forwards errors to the installed reporter', () => {
    const { reporter, errors } = recordingReporter();
    setCrashReporter(reporter);

    const boom = new Error('boom');
    reportError(boom, { screen: 'Game' });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.error).toBe(boom);
    expect(errors[0]?.context).toEqual({ screen: 'Game' });
  });

  it('wraps a non-Error throw so the reporter always gets an Error', () => {
    // Anything can be thrown in JS; the provider expects an Error.
    const { reporter, errors } = recordingReporter();
    setCrashReporter(reporter);

    reportError('just a string');

    expect(errors[0]?.error).toBeInstanceOf(Error);
    expect(errors[0]?.error.message).toBe('just a string');
  });

  it('forwards breadcrumbs', () => {
    const { reporter, logs } = recordingReporter();
    setCrashReporter(reporter);

    logBreadcrumb('computer turn started');

    expect(logs).toEqual(['computer turn started']);
  });

  it('never throws when the reporter itself fails', () => {
    // A failure inside error reporting must not become a second error on a
    // path that is already handling one.
    setCrashReporter({
      recordError: () => {
        throw new Error('reporter is down');
      },
      log: () => {
        throw new Error('reporter is down');
      },
    });

    expect(() => reportError(new Error('original'))).not.toThrow();
    expect(() => logBreadcrumb('note')).not.toThrow();
  });

  it('is inert before any reporter is installed', () => {
    expect(() => reportError(new Error('early'))).not.toThrow();
  });
});
