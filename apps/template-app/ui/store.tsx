import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The generated app's data layer: a tiny persisted store so apps have REAL,
 * shared, durable data instead of per-screen hardcoded samples.
 *
 *   const habits = useEntity("Habit");
 *   habits.items                       // current rows (array of objects with `id`)
 *   habits.add({ name: "Read" })       // append (id auto-assigned)
 *   habits.update(id, { streak: 3 })   // patch one row
 *   habits.remove(id)                  // delete one row
 *
 * Data is seeded from the blueprint, shared across every screen, and persisted
 * (AsyncStorage on device, localStorage in the web preview via a shim).
 */

type Row = { id: string; [k: string]: any };
type Db = Record<string, Row[]>;

type Action =
  | { type: "hydrate"; db: Db }
  | { type: "add"; entity: string; item: Row }
  | { type: "update"; entity: string; id: string; patch: any }
  | { type: "remove"; entity: string; id: string };

function reducer(state: Db, action: Action): Db {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.db };
    case "add":
      return {
        ...state,
        [action.entity]: [...(state[action.entity] ?? []), action.item],
      };
    case "update":
      return {
        ...state,
        [action.entity]: (state[action.entity] ?? []).map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r,
        ),
      };
    case "remove":
      return {
        ...state,
        [action.entity]: (state[action.entity] ?? []).filter(
          (r) => r.id !== action.id,
        ),
      };
    default:
      return state;
  }
}

const StoreCtx = createContext<{
  db: Db;
  dispatch: React.Dispatch<Action>;
} | null>(null);

const STORAGE_KEY = "appable.store.v1";

export function StoreProvider({
  seed = {},
  children,
}: {
  seed?: Db;
  children: React.ReactNode;
}) {
  const [db, dispatch] = useReducer(reducer, seed);
  const hydrated = useRef(false);

  // Load any saved data once on mount (overrides the seed for those entities).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (alive && raw) dispatch({ type: "hydrate", db: JSON.parse(raw) });
      } catch {
        /* ignore corrupt/unavailable storage */
      }
      hydrated.current = true;
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persist on every change (after the initial hydrate, so we don't clobber
  // saved data with the seed before it loads).
  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)).catch(() => {});
  }, [db]);

  return (
    <StoreCtx.Provider value={{ db, dispatch }}>{children}</StoreCtx.Provider>
  );
}

let idSeq = 0;
function genId(): string {
  idSeq += 1;
  return `id_${Date.now().toString(36)}_${idSeq}`;
}

export interface EntityApi {
  items: Row[];
  add: (item: Record<string, any>) => string;
  update: (id: string, patch: Record<string, any>) => void;
  remove: (id: string) => void;
}

/** Read + mutate one collection. Safe to call even with no provider (no-ops). */
export function useEntity(name: string): EntityApi {
  const ctx = useContext(StoreCtx);
  const items = ctx?.db[name] ?? [];
  return useMemo<EntityApi>(
    () => ({
      items,
      add: (item) => {
        const id = genId();
        ctx?.dispatch({ type: "add", entity: name, item: { id, ...item } });
        return id;
      },
      update: (id, patch) =>
        ctx?.dispatch({ type: "update", entity: name, id, patch }),
      remove: (id) => ctx?.dispatch({ type: "remove", entity: name, id }),
    }),
    [ctx, items, name],
  );
}
