import { DEFAULT_SPEED, SPEED_RANGE, type Lang } from "../core";

export interface Settings {
  speed: Record<Lang, number>;
}

const KEY = "rsvp-reader:settings";

export const DEFAULT_SETTINGS: Settings = { speed: { ...DEFAULT_SPEED } };

/** 設定は小さいので localStorage に置く。使えない環境（プライベートモードなど）では既定値 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      speed: {
        ja: clampSpeed("ja", parsed.speed?.ja),
        en: clampSpeed("en", parsed.speed?.en),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても読書は続けられる
  }
}

function clampSpeed(lang: Lang, v: unknown): number {
  const { min, max } = SPEED_RANGE[lang];
  return typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : DEFAULT_SPEED[lang];
}
