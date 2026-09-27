import type { CSSProperties } from "react";
import { SPEED_RANGE, type Lang } from "../../core";

interface Props {
  lang: Lang;
  index: number;
  count: number;
  remainingMs: number;
  playing: boolean;
  speed: number;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (index: number) => void;
  onSpeed: (speed: number) => void;
  /** いま読んでいる章の見出し */
  chapter?: string;
  onBookmark?: () => void;
}

export function Controls(p: Props) {
  const range = SPEED_RANGE[p.lang];
  const unit = p.lang === "ja" ? "字/分" : "WPM";
  const percent = p.count > 1 ? Math.round((p.index / (p.count - 1)) * 100) : 0;

  return (
    <div className="controls">
      <input
        id="reader-progress"
        className="progress"
        type="range"
        min={0}
        max={Math.max(p.count - 1, 0)}
        value={p.index}
        onChange={(e) => p.onSeek(Number(e.target.value))}
        aria-label="読書位置"
        aria-valuetext={`${percent}%`}
        style={{ "--p": `${percent}%` } as CSSProperties}
      />
      <div className="status">
        <span className="status-chapter">
          {p.chapter ? `${p.chapter} · ` : ""}
          {percent}%
        </span>
        <span>残り {formatDuration(p.remainingMs)}</span>
      </div>
      <div className="buttons">
        <button type="button" className="btn-ghost" onClick={p.onPrev} title="一文戻る (←)">
          ◀ 一文戻る
        </button>
        <button
          type="button"
          className="btn-play"
          onClick={p.onToggle}
          aria-label={p.playing ? "停止 (Space)" : "再生 (Space)"}
        >
          {p.playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className="btn-ghost" onClick={p.onNext} title="一文進む (→)">
          一文進む ▶
        </button>
        {p.onBookmark && (
          <button type="button" className="btn-ghost" onClick={p.onBookmark} title="いまの文にしおりを挟む (B)">
            ＋しおり
          </button>
        )}
        <label className="speed" htmlFor="reader-speed">
          速度
          <input
            id="reader-speed"
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={p.speed}
            onChange={(e) => p.onSpeed(Number(e.target.value))}
          />
          <output htmlFor="reader-speed">
            {p.speed}
            {unit}
          </output>
        </label>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const total = Math.max(Math.round(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
