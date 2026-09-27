import { describe, expect, it } from "vitest";
import type { Lang, Token } from "../types";
import { IntlSegmenter } from "./intlSegmenter";

const seg = new IntlSegmenter();
const words = (text: string, lang: Lang = "ja", chunkMax?: number) =>
  seg.segmentSync(text, lang, { chunkMax }).map((t) => text.slice(t.start, t.end));

describe("IntlSegmenter (ja)", () => {
  it.each([
    ["吾輩は猫である。名前はまだ無い。", ["吾輩は", "猫である。", "名前は", "まだ", "無い。"]],
    ["それはとても良かったので、また行きたいと思います。", ["それは", "とても", "良かったので、", "また", "行きたいと", "思います。"]],
    ["2026年9月27日に3.5倍の速度で読んだ。", ["2026年", "9月", "27日に", "3.5倍の", "速度で", "読んだ。"]],
    ["彼は「こんにちは。」と言った。", ["彼は", "「こんにちは。」と", "言った。"]],
    ["ブラウザ標準のIntl.Segmenterで語を切り出す。", ["ブラウザ", "標準の", "Intl.Segmenterで", "語を", "切り出す。"]],
  ])("%s", (text, expected) => {
    expect(words(text)).toEqual(expected);
  });

  it("ひらがなの連結は chunkMax を超えない", () => {
    for (const w of words("ここにあるものはすべてあなたのものになるかもしれない。", "ja", 6)) {
      expect(w.length).toBeLessThanOrEqual(7); // 句点ぶんの+1
    }
  });

  it("段落を越えて連結しない", () => {
    expect(words("最初の段落\n\nつぎの段落")).toEqual(["最初の", "段落", "つぎの", "段落"]);
  });
});

describe("IntlSegmenter (en)", () => {
  it("空白で区切り、句読点は単語に付けたままにする", () => {
    expect(words('The fox, it said. "Hello!"', "en")).toEqual(["The", "fox,", "it", "said.", '"Hello!"']);
  });
});

describe("Token の不変条件", () => {
  const samples: [string, Lang][] = [
    ["文章を速く読むための方法はいくつもある。RSVPはその一つだ。\n\n「見失ったら止める」と覚えておく。", "ja"],
    ["Reading faster is not the goal.\nUnderstanding is.\n\n— Anonymous", "en"],
    ["（注）先頭の括弧だけの段落\n「", "ja"],
    ["前の段落。\n\n……そうか。", "ja"],
    ["猫 。です", "ja"],
  ];

  it.each(samples)("空白以外の全文字を順序通り重複なく覆う: %s", (text, lang) => {
    const tokens = seg.segmentSync(text, lang);
    let covered = "";
    let prevEnd = 0;
    for (const t of tokens) {
      expect(t.start).toBeGreaterThanOrEqual(prevEnd);
      expect(t.end).toBeGreaterThan(t.start);
      covered += text.slice(t.start, t.end);
      prevEnd = t.end;
    }
    expect(covered).toBe(text.replace(/\s+/g, ""));
  });

  it("orp はトークンの範囲内", () => {
    const text = samples[0]![0];
    for (const t of seg.segmentSync(text, "ja")) expect(t.orp).toBeLessThan(t.end - t.start);
  });

  it("句読点と段落末に pause が付く", () => {
    const text = "読んで、止まる。\n\n次へ";
    const pauses = seg.segmentSync(text, "ja").map((t: Token) => [text.slice(t.start, t.end), t.pause]);
    expect(pauses).toEqual([["読んで、", 0.5], ["止まる。", 2], ["次へ", 2]]);
  });

  it("英数字を含む日本語のかたまりは weight を上げる", () => {
    const text = "RSVPは速い";
    const [first, second] = seg.segmentSync(text, "ja");
    expect(first!.weight).toBe(1.3);
    expect(second!.weight).toBe(1);
  });
});
