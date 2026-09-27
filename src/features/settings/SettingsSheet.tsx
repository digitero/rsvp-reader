import { useEffect, useId, useRef } from "react";
import { SPEED_RANGE, type Lang } from "../../core";
import type { Settings } from "../../storage/settings";
import "../../styles/sheet.css";
import "./settings.css";

interface Props {
  settings: Settings;
  /** 速度を表示する言語（リーダーから開いたときはその文書の言語） */
  lang: Lang;
  onChange: (next: Settings) => void;
  onClose: () => void;
}

interface Option<T> {
  value: T;
  label: string;
}

/** リーダーやライブラリに重ねて開く表示設定。変更はその場で反映する */
export function SettingsSheet({ settings, lang, onChange, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value });
  const range = SPEED_RANGE[lang];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("input")?.focus();
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

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title" ref={panelRef}>
        <div className="sheet-head">
          <h2 id="settings-title">表示設定</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="setting-row">
          <label htmlFor="settings-speed" className="setting-label">
            速度（{lang === "ja" ? "日本語" : "英語"}）</label>
          <div className="setting-speed">
            <input
              id="settings-speed"
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={settings.speed[lang]}
              onChange={(e) => set("speed", { ...settings.speed, [lang]: Number(e.target.value) })}
            />
            <output htmlFor="settings-speed">
              {settings.speed[lang]}
              {lang === "ja" ? "字/分" : "WPM"}
            </output>
          </div>
        </div>

        <Segmented
          label="表示単位"
          value={settings.group}
          options={[
            { value: 1, label: lang === "ja" ? "文節" : "1語" },
            { value: 2, label: lang === "ja" ? "2文節" : "2語" },
          ]}
          onChange={(v) => set("group", v)}
        />
        <Segmented
          label="フォント"
          value={settings.font}
          options={[
            { value: "gothic", label: "UDゴシック" },
            { value: "mincho", label: "UD明朝" },
          ]}
          onChange={(v) => set("font", v)}
        />
        <Segmented
          label="文字サイズ"
          value={settings.size}
          options={[
            { value: "s", label: "小" },
            { value: "m", label: "中" },
            { value: "l", label: "大" },
          ]}
          onChange={(v) => set("size", v)}
        />
        <Segmented
          label="テーマ"
          value={settings.theme}
          options={[
            { value: "auto", label: "自動" },
            { value: "light", label: "ライト" },
            { value: "dark", label: "ダーク" },
            { value: "sepia", label: "セピア" },
          ]}
          onChange={(v) => set("theme", v)}
        />
        <Segmented
          label="強調色"
          value={settings.accent}
          options={[
            { value: "red", label: "赤" },
            { value: "blue", label: "青" },
            { value: "green", label: "緑" },
            { value: "none", label: "なし" },
          ]}
          onChange={(v) => set("accent", v)}
          swatch
        />
        <Segmented
          label="句読点で停止"
          value={settings.pause}
          options={[
            { value: 0.5, label: "短め" },
            { value: 1, label: "標準" },
            { value: 1.5, label: "長め" },
          ]}
          onChange={(v) => set("pause", v)}
        />
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  swatch?: boolean;
}

function Segmented<T extends string | number>({ label, value, options, onChange, swatch }: SegmentedProps<T>) {
  const name = useId();
  return (
    <div className="setting-row" role="radiogroup" aria-labelledby={`${name}-label`}>
      <span id={`${name}-label`} className="setting-label">
        {label}
      </span>
      <div className="segmented">
        {options.map((o) => (
          <label key={String(o.value)} className={o.value === value ? "is-on" : undefined}>
            <input
              type="radio"
              name={name}
              value={String(o.value)}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {swatch && <i className={`swatch swatch-${o.value}`} aria-hidden="true" />}
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
