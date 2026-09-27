import { useEffect, useRef, useState } from "react";
import type { Heading } from "../../source/headings";
import type { Bookmark } from "../../storage/library";
import "../../styles/sheet.css";

type Tab = "toc" | "bookmarks";

interface Props {
  text: string;
  headings: readonly Heading[];
  bookmarks: readonly Bookmark[];
  /** 現在の章（headings のインデックス、なければ -1） */
  current: number;
  initialTab: Tab;
  onPickOffset: (offset: number) => void;
  onRemoveBookmark: (id: string) => void;
  onClose: () => void;
}

const SNIPPET_MAX = 36;

/** 目次としおりを切り替えて表示するシート */
export function TocSheet(props: Props) {
  const { text, headings, bookmarks, current, onPickOffset, onRemoveBookmark, onClose } = props;
  const [tab, setTab] = useState<Tab>(props.initialTab);
  const focusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    focusRef.current?.scrollIntoView({ block: "center" });
    focusRef.current?.focus();
  }, [tab]);

  const minLevel = headings.length ? Math.min(...headings.map((h) => h.level)) : 1;
  const chapterOf = (offset: number) => {
    let found: Heading | undefined;
    for (const h of headings) if (h.offset <= offset) found = h;
    return found?.title;
  };
  const snippet = (offset: number) => {
    const line = text.slice(offset, offset + SNIPPET_MAX + 20).split("\n", 1)[0]!.trim();
    return line.length > SNIPPET_MAX ? `${line.slice(0, SNIPPET_MAX)}…` : line;
  };

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="目次としおり">
        <div className="sheet-head">
          <div className="nav-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "toc"} onClick={() => setTab("toc")}>
              目次 <span>{headings.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === "bookmarks"} onClick={() => setTab("bookmarks")}>
              しおり <span>{bookmarks.length}</span>
            </button>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>

        {tab === "toc" &&
          (headings.length === 0 ? (
            <p className="nav-empty">この文書には見出しがありません。</p>
          ) : (
            <ol className="toc">
              {headings.map((h, i) => (
                <li key={`${h.offset}-${i}`} style={{ paddingLeft: `${(h.level - minLevel) * 1.2}em` }}>
                  <button
                    type="button"
                    ref={i === Math.max(current, 0) ? focusRef : undefined}
                    className={i === current ? "toc-item is-current" : "toc-item"}
                    aria-current={i === current ? "true" : undefined}
                    onClick={() => onPickOffset(h.offset)}
                  >
                    {h.title}
                  </button>
                </li>
              ))}
            </ol>
          ))}

        {tab === "bookmarks" &&
          (bookmarks.length === 0 ? (
            <p className="nav-empty">
              しおりはまだありません。読んでいる途中で「しおり」ボタン（キーボードでは B）を押すと、その文を記録できます。
            </p>
          ) : (
            <ol className="toc">
              {bookmarks.map((b, i) => {
                const chapter = chapterOf(b.offset);
                return (
                  <li key={b.id} className="bookmark">
                    <button
                      type="button"
                      ref={i === 0 ? focusRef : undefined}
                      className="toc-item bookmark-open"
                      onClick={() => onPickOffset(b.offset)}
                    >
                      <span className="bookmark-text">{snippet(b.offset)}</span>
                      <span className="bookmark-meta">
                        {chapter ? `${chapter} · ` : ""}
                        {Math.floor((b.offset / Math.max(text.length, 1)) * 100)}%
                      </span>
                    </button>
                    <button
                      type="button"
                      className="doc-remove"
                      aria-label={`しおり「${snippet(b.offset)}」を削除`}
                      onClick={() => onRemoveBookmark(b.id)}
                    >
                      削除
                    </button>
                  </li>
                );
              })}
            </ol>
          ))}
      </div>
    </div>
  );
}
