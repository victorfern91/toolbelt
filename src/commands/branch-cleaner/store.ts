import {
  createContext,
  createElement,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { enableMapSet, produce } from "immer";
import type { Branch } from "../../capabilities/git/index.ts";

enableMapSet();

export type Result = { name: string; ok: boolean; err: string };

export const safe = (b: Branch) => !b.current && (b.merged || b.gone);

export type State = {
  base: string;
  branches: Branch[];
  error: string;
  loading: boolean;
  cursor: number;
  picked: Set<string>;
  force: boolean;
  confirming: boolean;
  results: Result[] | null;
};

export type Action =
  | { type: "loaded"; base: string; branches: Branch[] }
  | { type: "failed"; error: string }
  | { type: "move"; delta: number }
  | { type: "toggle"; name: string }
  | { type: "pick-safe" }
  | { type: "toggle-force" }
  | { type: "confirm" }
  | { type: "cancel" }
  | { type: "deleted"; results: Result[]; branches: Branch[] };

const initial: State = {
  base: "",
  branches: [],
  error: "",
  loading: true,
  cursor: 0,
  picked: new Set(),
  force: false,
  confirming: false,
  results: null,
};

function reducer(state: State, action: Action): State {
  return produce(state, (draft) => {
    switch (action.type) {
      case "loaded":
        draft.loading = false;
        draft.base = action.base;
        draft.branches = action.branches;
        break;
      case "failed":
        draft.loading = false;
        draft.error = action.error;
        break;
      case "move":
        draft.cursor = Math.max(
          0,
          Math.min(state.cursor + action.delta, state.branches.length - 1),
        );
        break;
      case "toggle":
        if (draft.picked.has(action.name)) draft.picked.delete(action.name);
        else draft.picked.add(action.name);
        break;
      case "pick-safe": {
        const targets = state.branches.filter(safe).map((b) => b.name);
        draft.picked = state.picked.size === targets.length ? new Set() : new Set(targets);
        break;
      }
      case "toggle-force":
        draft.force = !state.force;
        break;
      case "confirm":
        if (state.picked.size > 0) draft.confirming = true;
        break;
      case "cancel":
        draft.confirming = false;
        break;
      case "deleted":
        draft.results = action.results;
        draft.branches = action.branches;
        draft.confirming = false;
        draft.picked = new Set();
        break;
    }
  });
}

type Store = { state: State; dispatch: Dispatch<Action> };

const BranchCleanerContext = createContext<Store | null>(null);

export function BranchCleanerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return createElement(BranchCleanerContext.Provider, { value: { state, dispatch } }, children);
}

export function useBranchCleanerState(): Store {
  const store = useContext(BranchCleanerContext);
  if (!store) throw new Error("useBranchCleanerState must be used within BranchCleanerProvider");
  return store;
}
