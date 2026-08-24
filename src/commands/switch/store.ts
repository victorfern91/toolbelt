import {
  createContext,
  createElement,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { produce } from "immer";
import type { Branch } from "../../capabilities/git/index.ts";

export type State = {
  branches: Branch[];
  error: string;
  loading: boolean;
  cursor: number;
  status: string;
};

export type Action =
  | { type: "loaded"; branches: Branch[] }
  | { type: "failed"; error: string }
  | { type: "move"; delta: number }
  | { type: "status"; status: string };

const initial: State = {
  branches: [],
  error: "",
  loading: true,
  cursor: 0,
  status: "",
};

function firstOther(branches: Branch[]) {
  const i = branches.findIndex((b) => !b.current);
  return i === -1 ? 0 : i;
}

function reducer(state: State, action: Action): State {
  return produce(state, (draft) => {
    switch (action.type) {
      case "loaded":
        draft.loading = false;
        draft.branches = action.branches;
        draft.cursor = firstOther(action.branches);
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
        draft.status = "";
        break;
      case "status":
        draft.status = action.status;
        break;
    }
  });
}

type Store = { state: State; dispatch: Dispatch<Action> };

const SwitchContext = createContext<Store | null>(null);

export function SwitchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  return createElement(SwitchContext.Provider, { value: { state, dispatch } }, children);
}

export function useSwitchState(): Store {
  const store = useContext(SwitchContext);
  if (!store) throw new Error("useSwitchState must be used within SwitchProvider");
  return store;
}
