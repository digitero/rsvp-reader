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
 * 文字入力中や、フォーカスしたスライダーが自分で処理する矢印キーには反応しない。
 */
export function useReaderKeys(handlers: ReaderKeyHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "TEXTAREA" || el?.isContentEditable) return;
      if (tag === "INPUT" && (el as HTMLInputElement).type !== "range") return;
      const onRange = tag === "INPUT";

      switch (e.key) {
        case " ":
          // フォーカスがボタンにあっても Space は常に再生/停止。
          // preventDefault でボタン自身のクリック（設定を開き直す・もう一文戻るなど）を起こさない
          e.preventDefault();
          if (!e.repeat) handlers.toggle();
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
    // ボタンは Space の keyup でクリックされるので、そちらも止める
    const onKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === " " && tag === "BUTTON") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handlers, enabled]);
}
