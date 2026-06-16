// Web shim for @react-native-async-storage/async-storage. Backs the preview's
// data store with localStorage (so data persists across reloads in the browser,
// matching device behavior), falling back to in-memory if unavailable.
const mem: Record<string, string> = {};

function ls(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const s = ls();
    return s ? s.getItem(key) : key in mem ? mem[key] : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    const s = ls();
    if (s) s.setItem(key, value);
    else mem[key] = value;
  },
  async removeItem(key: string): Promise<void> {
    const s = ls();
    if (s) s.removeItem(key);
    else delete mem[key];
  },
  async clear(): Promise<void> {
    const s = ls();
    if (s) s.clear();
    else for (const k of Object.keys(mem)) delete mem[k];
  },
};

export default AsyncStorage;
