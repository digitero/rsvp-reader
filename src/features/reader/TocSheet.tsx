import { useEffect, useRef } from "react";
import type { Heading } from "../../source/headings";
import "../../styles/sheet.css";

interface Props {
  headings: readonly Heading[];
  /** 現在の章（headings のインデックス、なければ -1） */
  current: number;
  onPick: (heading: Heading) => void;
  onClose: () => void;
}

export function TocSheet({ headings, current, onPick, onClose }: Props) {
  const currentRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target = currentRef.current ?? firstRef.current;
    target?.scrollIntoView({ block: "center" });
    target?.focus();
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

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="toc-title">
        <div className="sheet-head">
          <h2 id="toc-title">目次</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>
        <ol className="toc">
          {headings.map((h, i) => (
            <li key={`${h.offset}-${i}`} style={{ paddingLeft: `${(h.level - minLevel) * 1.2}em` }}>
              <button
                type="button"
                ref={i === current ? currentRef : i === 0 ? firstRef : undefined}
                className={i === current ? "toc-item is-current" : "toc-item"}
                aria-current={i === current ? "true" : undefined}
                onClick={() => onPick(h)}
              >
                {h.title}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
