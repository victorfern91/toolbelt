import "../../../web/reset.css";
import { createRoot } from "react-dom/client";
import { Provider } from "jotai";
import { App } from "./app.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(
  <Provider>
    <App />
  </Provider>,
);
