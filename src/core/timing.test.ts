import { describe, expect, it } from "vitest";
import { cumulativeMs, MIN_DELAY_MS, RAMP_TOKENS, remainingMs, tokenDelay } from "./timing";
import type { Token } from "./types";

const tok = (len: number, extra: Partial<Token> = {}): Token => ({
  start: 0, end: len, orp: 0, pause: 0, weight: 1, ...extra,
});

describe("tokenDelay", () => {
  const ja = { lang: "ja" as const, speed: 600 }; // 1文字 100ms

  it("日本語は文字数に比例し、最低2文字ぶん", () => {
    expect(tokenDelay(tok(3), ja)).toBe(300);
    expect(tokenDelay(tok(1), ja)).toBe(200);
  });

  it("句点は4文字ぶん、読点はその半分を足す", () => {
    expect(tokenDelay(tok(3, { pause: 1 }), ja)).toBe(700);
    expect(tokenDelay(tok(3, { pause: 0.5 }), ja)).toBe(500);
    expect(tokenDelay(tok(3, { pause: 1 }), { ...ja, pauseScale: 0.5 })).toBe(500);
  });

  it("weight を掛ける", () => {
    expect(tokenDelay(tok(3, { weight: 1.3 }), ja)).toBeCloseTo(390);
  });

  it("ランプアップ中は長く、残り0で通常に戻る", () => {
    expect(tokenDelay(tok(3), ja, RAMP_TOKENS)).toBeCloseTo(480);
    expect(tokenDelay(tok(3), ja, RAMP_TOKENS / 2)).toBeCloseTo(390);
    expect(tokenDelay(tok(3), ja, 0)).toBe(300);
  });

  it("英語は WPM 基準で長い語ほど長い", () => {
    const en = { lang: "en" as const, speed: 300 }; // 1語 200ms
    expect(tokenDelay(tok(5), en)).toBeCloseTo(200);
    expect(tokenDelay(tok(10), en)).toBeGreaterThan(tokenDelay(tok(3), en));
  });

  it("下限を下回らない", () => {
    expect(tokenDelay(tok(1), { lang: "en", speed: 10000 })).toBe(MIN_DELAY_MS);
  });
});

it("remainingMs は from 以降の合計", () => {
  const tokens = [tok(2), tok(3), tok(4)];
  expect(remainingMs(tokens, 1, { lang: "ja", speed: 600 })).toBe(700);
  expect(remainingMs(tokens, 3, { lang: "ja", speed: 600 })).toBe(0);
});

it("cumulativeMs の差は remainingMs と一致する", () => {
  const tokens = [tok(2), tok(3, { pause: 1 }), tok(4)];
  const opts = { lang: "ja" as const, speed: 600 };
  const acc = cumulativeMs(tokens, opts);
  expect(Array.from(acc)).toEqual([0, 200, 900, 1300]);
  expect(acc[3]! - acc[1]!).toBe(remainingMs(tokens, 1, opts));
});
