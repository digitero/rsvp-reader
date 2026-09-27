import { describe, expect, it } from "vitest";
import { cumulativeMs, MIN_DELAY_MS, RAMP_TOKENS, remainingMs, tokenDelay } from "./timing";
import type { Token } from "./types";

const tok = (len: number, extra: Partial<Token> = {}): Token => ({
  start: 0, end: len, orp: 0, pause: 0, weight: 1, ...extra,
});

describe("tokenDelay", () => {
  const ja = { lang: "ja" as const, speed: 600 }; // 1文字 100ms

  it("日本語は固定分＋文字数比例。短いかたまりは長めに、長いかたまりは短めに", () => {
    expect(tokenDelay(tok(1), ja)).toBeCloseTo(280);
    expect(tokenDelay(tok(2), ja)).toBeCloseTo(320);
    expect(tokenDelay(tok(4), ja)).toBeCloseTo(400); // 平均的な長さでは文字数に比例した場合と同じ
    expect(tokenDelay(tok(10), ja)).toBeCloseTo(640);
  });

  it("句点は4文字ぶん、読点はその半分を足す", () => {
    expect(tokenDelay(tok(3, { pause: 1 }), ja)).toBeCloseTo(760);
    expect(tokenDelay(tok(3, { pause: 0.5 }), ja)).toBeCloseTo(560);
    expect(tokenDelay(tok(3, { pause: 1 }), { ...ja, pauseScale: 0.5 })).toBeCloseTo(560);
  });

  it("weight を掛ける", () => {
    expect(tokenDelay(tok(3, { weight: 1.3 }), ja)).toBeCloseTo(468);
  });

  it("ランプアップ中は長く、残り0で通常に戻る", () => {
    expect(tokenDelay(tok(3), ja, RAMP_TOKENS)).toBeCloseTo(576);
    expect(tokenDelay(tok(3), ja, RAMP_TOKENS / 2)).toBeCloseTo(468);
    expect(tokenDelay(tok(3), ja, 0)).toBeCloseTo(360);
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
  expect(remainingMs(tokens, 1, { lang: "ja", speed: 600 })).toBeCloseTo(760);
  expect(remainingMs(tokens, 3, { lang: "ja", speed: 600 })).toBe(0);
});

it("cumulativeMs の差は remainingMs と一致する", () => {
  const tokens = [tok(2), tok(3, { pause: 1 }), tok(4)];
  const opts = { lang: "ja" as const, speed: 600 };
  const acc = cumulativeMs(tokens, opts);
  expect(Array.from(acc).map(Math.round)).toEqual([0, 320, 1080, 1480]);
  expect(acc[3]! - acc[1]!).toBeCloseTo(remainingMs(tokens, 1, opts));
});
