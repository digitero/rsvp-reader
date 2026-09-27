import type { Lang, Token } from "./types";

export interface TimingOptions {
  lang: Lang;
  /** 日本語は字/分、英語はWPM */
  speed: number;
  /** 句読点での停止の強さ。弱 0.5 / 標準 1 / 強 1.5 */
  pauseScale?: number;
}

export const DEFAULT_SPEED: Record<Lang, number> = { ja: 600, en: 300 };
export const SPEED_RANGE: Record<Lang, { min: number; max: number; step: number }> = {
  ja: { min: 300, max: 1500, step: 50 },
  en: { min: 150, max: 800, step: 25 },
};

/** 再生開始から何トークンかけて設定速度に戻すか */
export const RAMP_TOKENS = 8;
const RAMP_EXTRA = 0.6;
/**
 * 日本語のかたまりの表示時間 = (JA_FIXED + JA_PER_CHAR × 文字数) 文字ぶん。
 * 文字数にそのまま比例させると、1〜2文字のかたまりが続く所は速すぎて追えず、
 * 長いかたまりは遅く感じる。平均的な4文字では比例と同じ長さ（4文字ぶん）になるように決めている。
 */
const JA_FIXED = 2.4;
const JA_PER_CHAR = 0.4;
/** 1回の停止を何単位ぶんにするか */
const PAUSE_UNITS: Record<Lang, number> = { ja: 4, en: 2 };
export const MIN_DELAY_MS = 120;

/**
 * トークンの表示時間(ms)。
 * @param rampLeft ランプアップの残りトークン数（0 なら設定速度）
 */
export function tokenDelay(token: Token, opts: TimingOptions, rampLeft = 0): number {
  const unit = 60000 / opts.speed;
  const len = token.end - token.start;
  const base = opts.lang === "ja" ? unit * (JA_FIXED + JA_PER_CHAR * len) : unit * (0.8 + 0.04 * len);
  const pause = unit * PAUSE_UNITS[opts.lang] * token.pause * (opts.pauseScale ?? 1);
  const ramp = 1 + RAMP_EXTRA * (Math.min(Math.max(rampLeft, 0), RAMP_TOKENS) / RAMP_TOKENS);
  return Math.max((base + pause) * token.weight * ramp, MIN_DELAY_MS);
}

/**
 * 各トークンの表示開始時刻(ms)の累積。長さは tokens.length + 1 で、最後の要素が合計。
 * 残り時間を毎回ループで数えずに `total - cumulative[i]` で出すために使う。
 */
export function cumulativeMs(tokens: readonly Token[], opts: TimingOptions): Float64Array {
  const acc = new Float64Array(tokens.length + 1);
  for (let i = 0; i < tokens.length; i++) acc[i + 1] = acc[i]! + tokenDelay(tokens[i]!, opts);
  return acc;
}

/** `from` から最後までの表示時間の合計(ms)。ランプアップは含めない */
export function remainingMs(tokens: readonly Token[], from: number, opts: TimingOptions): number {
  let ms = 0;
  for (let i = Math.max(from, 0); i < tokens.length; i++) ms += tokenDelay(tokens[i]!, opts);
  return ms;
}
