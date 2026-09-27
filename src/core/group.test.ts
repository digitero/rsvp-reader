import { expect, it } from "vitest";
import { groupTokens } from "./group";
import { IntlSegmenter } from "./segmenter/intlSegmenter";

const text = "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。";
const tokens = new IntlSegmenter().segmentSync(text, "ja");
const words = (size: number) => groupTokens(tokens, text, size).map((t) => text.slice(t.start, t.end));

it("size 1 は元のまま", () => {
  expect(words(1)).toEqual(tokens.map((t) => text.slice(t.start, t.end)));
});

it("2つずつまとめ、句点をまたがない", () => {
  expect(words(2)).toEqual(["吾輩は猫である。", "名前はまだ", "無い。", "どこで生れたか", "とんと見当がつかぬ。"]);
});

it("まとめたトークンの pause と orp", () => {
  const [first] = groupTokens(tokens, text, 2);
  expect(first!.pause).toBe(1);
  expect(first!.orp).toBeLessThan(first!.end - first!.start);
});

it("英語は語数でまとめ、読点で区切る", () => {
  const en = "The quick brown fox, it said.";
  const t = new IntlSegmenter().segmentSync(en, "en");
  expect(groupTokens(t, en, 2).map((x) => en.slice(x.start, x.end))).toEqual(["The quick", "brown fox,", "it said."]);
});

it("maxLength を超えるまとめはしない", () => {
  const t = "日本語には単語の間に空白がない。語にまとめて「文節」に近いかたまりにしている。";
  const tokens = new IntlSegmenter().segmentSync(t, "ja");
  const grouped = groupTokens(tokens, t, 2, 10).map((x) => t.slice(x.start, x.end));
  for (const g of grouped) expect(g.length).toBeLessThanOrEqual(Math.max(10, ...tokens.map((k) => k.end - k.start)));
  expect(grouped).toContain("語にまとめて");
});
