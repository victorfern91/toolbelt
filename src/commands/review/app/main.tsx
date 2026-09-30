import { createRoot } from "react-dom/client";
import { Provider } from "jotai";
import { EditProvider } from "@pierre/diffs/react";
import { Editor, type EditorOptions } from "@pierre/diffs/edit";
import { App } from "./app.tsx";
import type { CommentMeta } from "./store.ts";

const createEditor = (options: EditorOptions<CommentMeta>) => new Editor(options);

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <Provider>
    <EditProvider createEditor={createEditor}>
      <App />
    </EditProvider>
  </Provider>,
);
