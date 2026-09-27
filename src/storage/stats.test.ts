import { describe, expect, it } from "vitest";
import { addToDay, dateKey, emptyDay, summarize, type DailyStats } from "./stats";

const now = new Date(2026, 8, 27, 21, 0); // 2026-09-27
const day = (date: string, ja = 0, jaMs = 0): DailyStats => addToDay(emptyDay(date), "ja", jaMs, ja);

describe("stats", () => {
  it("dateKey はローカル日付", () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("addToDay は言語ごとに足し、負の値は無視する", () => {
    const d = addToDay(addToDay(emptyDay("2026-09-27"), "ja", 60_000, 500), "en", -5, -1);
    expect(d).toEqual({ date: "2026-09-27", ja: { ms: 60_000, units: 500 }, en: { ms: 0, units: 0 } });
  });

  it("直近7日・連続日数・平均速度・累計", () => {
    const records = [
      day("2026-09-01", 1000, 120_000), // 7日より前: 速度には入らず累計には入る
      day("2026-09-24", 600, 60_000),
      day("2026-09-25", 1200, 120_000),
      day("2026-09-26", 900, 60_000),
      day("2026-09-27", 300, 60_000),
    ];
    const s = summarize(records, now);
    expect(s.week.map((d) => d.date)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27",
    ]);
    expect(s.today.ja.units).toBe(300);
    expect(s.streak).toBe(4);
    expect(s.speed.ja).toBe(Math.round(3000 / 5)); // 3000字 / 5分
    expect(s.speed.en).toBeNull();
    expect(s.total.ja).toBe(4000);
  });

  it("今日まだ読んでいなければ昨日までの連続日数", () => {
    const s = summarize([day("2026-09-25", 10, 1000), day("2026-09-26", 10, 1000)], now);
    expect(s.streak).toBe(2);
    expect(summarize([day("2026-09-25", 10, 1000)], now).streak).toBe(0);
  });

  it("読んだ時間が30秒未満なら速度は出さない", () => {
    expect(summarize([day("2026-09-27", 100, 10_000)], now).speed.ja).toBeNull();
  });
});
