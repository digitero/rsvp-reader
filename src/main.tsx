import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadSettings } from "./storage/settings";

// 最初の描画より前にテーマを当てて、OS のテーマで一瞬描かれるのを防ぐ
const { theme } = loadSettings();
if (theme !== "auto") document.documentElement.dataset.theme = theme;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
