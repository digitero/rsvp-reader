import { useEffect } from "react";

export interface ReaderKeyHandlers {
  toggle: () => void;
  prev: () => void;
  next: () => void;
  faster: () => void;
  slower: () => void;
  close?: () => void;
}

/**
 * Space: 再生/停止、←→: 一文戻る/進む、↑↓: 速度、Esc: 閉じる。
 * 文字入力中や、フォーカスしたスライダー・ボタンが自分で処理するキーには反応しない。
 */
export function useReaderKeys(handlers: ReaderKeyHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "TEXTAREA" || el?.isContentEditable) return;
      if (tag === "INPUT" && (el as HTMLInputElement).type !== "range") return;
      const onRange = tag === "INPUT";
      const onButton = tag === "BUTTON";

      switch (e.key) {
        case " ":
          if (onButton) return; // ボタン自身の Space クリックと二重にならないように
          e.preventDefault();
          handlers.toggle();
          break;
        case "ArrowLeft":
          if (onRange) return;
          e.preventDefault();
          handlers.prev();
          break;
        case "ArrowRight":
          if (onRange) return;
          e.preventDefault();
          handlers.next();
          break;
        case "ArrowUp":
          if (onRange) return;
          e.preventDefault();
          handlers.faster();
          break;
        case "ArrowDown":
          if (onRange) return;
          e.preventDefault();
          handlers.slower();
          break;
        case "Escape":
          handlers.close?.();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
