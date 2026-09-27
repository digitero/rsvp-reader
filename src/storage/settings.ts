import { DEFAULT_SPEED, SPEED_RANGE, type Lang } from "../core";

export type FontChoice = "gothic" | "mincho";
export type SizeChoice = "s" | "m" | "l";
export type ThemeChoice = "auto" | "light" | "dark" | "sepia";
export type AccentChoice = "red" | "blue" | "green" | "none";
export type PauseChoice = 0.5 | 1 | 1.5;
export type GroupChoice = 1 | 2;

export interface Settings {
  speed: Record<Lang, number>;
  /** 1回に表示するかたまりの数（1: 文節ずつ、2: 2文節ずつ） */
  group: GroupChoice;
  font: FontChoice;
  size: SizeChoice;
  theme: ThemeChoice;
  accent: AccentChoice;
  /** 句読点での停止の強さ */
  pause: PauseChoice;
}

export const DEFAULT_SETTINGS: Settings = {
  speed: { ...DEFAULT_SPEED },
  group: 1,
  font: "gothic",
  size: "m",
  theme: "auto",
  accent: "red",
  pause: 1,
};

const KEY = "rsvp-reader:settings";

/** 保存されていた値を検証し、不正・欠落は既定値で埋める */
export function parseSettings(raw: unknown): Settings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const speed = (o.speed && typeof o.speed === "object" ? o.speed : {}) as Record<string, unknown>;
  return {
    speed: { ja: clampSpeed("ja", speed.ja), en: clampSpeed("en", speed.en) },
    group: pick(o.group, [1, 2] as const, DEFAULT_SETTINGS.group),
    font: pick(o.font, ["gothic", "mincho"] as const, DEFAULT_SETTINGS.font),
    size: pick(o.size, ["s", "m", "l"] as const, DEFAULT_SETTINGS.size),
    theme: pick(o.theme, ["auto", "light", "dark", "sepia"] as const, DEFAULT_SETTINGS.theme),
    accent: pick(o.accent, ["red", "blue", "green", "none"] as const, DEFAULT_SETTINGS.accent),
    pause: pick(o.pause, [0.5, 1, 1.5] as const, DEFAULT_SETTINGS.pause),
  };
}

/** 設定は小さいので localStorage に置く。使えない環境（プライベートモードなど）では既定値 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return parseSettings(raw ? JSON.parse(raw) : null);
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

function pick<T>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function clampSpeed(lang: Lang, v: unknown): number {
  const { min, max } = SPEED_RANGE[lang];
  return typeof v === "number" && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : DEFAULT_SPEED[lang];
}
