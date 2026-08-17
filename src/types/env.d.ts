/**
 * Ambient type for the `process.env` shim React Native's
 * `setUpGlobals.js` installs at startup (guarantees only NODE_ENV;
 * everything else is undefined unless set). Declared here instead of
 * pulling in `@types/node`, which would add unrelated Node-only globals
 * (Buffer, fs, require, ...) that don't exist in the RN runtime.
 */
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test';
    WORDLOOP_API_BASE_URL?: string;
  };
};
