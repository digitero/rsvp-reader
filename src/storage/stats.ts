import type { Lang } from "../core";

/** 1日分の読書の記録。units は日本語なら文字数（空白を除く）、英語なら語数 */
export interface DailyStats {
  /** ローカル日付 YYYY-MM-DD */
  date: string;
  ja: { ms: number; units: number };
  en: { ms: number; units: number };
}

export interface StatsSummary {
  today: DailyStats;
  /** 今日を含む直近7日（古い順） */
  week: DailyStats[];
  /** 今日（今日まだ読んでいなければ昨日）まで続けて読んだ日数 */
  streak: number;
  /** 直近7日の実際の平均速度（日本語は字/分、英語は語/分）。読んでいなければ null */
  speed: Record<Lang, number | null>;
  /** 累計 */
  total: Record<Lang, number>;
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyDay(date: string): DailyStats {
  return { date, ja: { ms: 0, units: 0 }, en: { ms: 0, units: 0 } };
}

export function addToDay(day: DailyStats, lang: Lang, ms: number, units: number): DailyStats {
  return {
    ...day,
    [lang]: { ms: day[lang].ms + Math.max(ms, 0), units: day[lang].units + Math.max(units, 0) },
  };
}

const read = (d: DailyStats) => d.ja.units + d.en.units > 0;

export function summarize(records: readonly DailyStats[], now = new Date()): StatsSummary {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const dayAt = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = dateKey(d);
    return byDate.get(key) ?? emptyDay(key);
  };

  const week = Array.from({ length: 7 }, (_, i) => dayAt(6 - i));
  const today = week[6]!;

  let streak = 0;
  for (let i = read(today) ? 0 : 1; read(dayAt(i)); i++) streak++;

  const speed = (lang: Lang) => {
    const ms = week.reduce((s, d) => s + d[lang].ms, 0);
    const units = week.reduce((s, d) => s + d[lang].units, 0);
    return ms >= 30_000 ? Math.round(units / (ms / 60_000)) : null;
  };
  const total = (lang: Lang) => records.reduce((s, d) => s + d[lang].units, 0);

  return { today, week, streak, speed: { ja: speed("ja"), en: speed("en") }, total: { ja: total("ja"), en: total("en") } };
}
