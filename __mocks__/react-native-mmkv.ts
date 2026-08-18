/**
 * Manual Jest mock for react-native-mmkv.
 *
 * The real package imports react-native-nitro-modules at module scope,
 * which reaches into TurboModuleRegistry and throws immediately under Jest
 * (no native binary to register against) — before the library's own
 * isTest() escape hatch in createMMKV() ever runs. An in-memory stand-in
 * keeps storage.ts's Jest coverage exercising real logic instead of a
 * native binding no test environment can provide.
 */

export function createMMKV(): {
  getString: (key: string) => string | undefined;
  set: (key: string, value: boolean | string | number) => void;
  remove: (key: string) => boolean;
  contains: (key: string) => boolean;
} {
  const store = new Map<string, string>();

  return {
    getString: key => store.get(key),
    set: (key, value) => {
      store.set(key, String(value));
    },
    remove: key => store.delete(key),
    contains: key => store.has(key),
  };
}
