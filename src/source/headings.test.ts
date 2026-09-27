import { describe, expect, it } from "vitest";
import { stripAozora } from "./aozora";
import { extractHeadings, markHeading, markPlainHeadings } from "./headings";
import { fromFile, fromPaste } from "./importText";

const utf8 = (s: string) => new TextEncoder().encode(s);
/** 見出しの offset が本文の該当行を指しているか */
const titlesAt = (text: string, headings: { offset: number; title: string }[]) =>
  headings.map((h) => text.slice(h.offset, h.offset + h.title.length));

describe("extractHeadings", () => {
  it("目印を取り除き、正しい位置を返す", () => {
    const marked = ["前書き", markHeading("第一章", 1), "本文", markHeading("  節", 2), "続き"].join("\n");
    const { text, headings } = extractHeadings(marked);
    expect(text).toBe("前書き\n第一章\n本文\n  節\n続き");
    expect(headings).toEqual([
      { offset: 4, title: "第一章", level: 1 },
      { offset: 13, title: "節", level: 2 },
    ]);
    expect(titlesAt(text, headings)).toEqual(["第一章", "節"]);
  });
});

describe("見出しの検出", () => {
  it("Markdown の見出し", () => {
    const doc = fromFile("a.md", utf8("# 本\n\n前書き。\n\n## 第1章 はじまり\n\n本文。\n\n### 1.1 小節\n\nさらに。"));
    expect(doc.headings.map((h) => [h.title, h.level])).toEqual([
      ["本", 1],
      ["第1章 はじまり", 2],
      ["1.1 小節", 3],
    ]);
    expect(titlesAt(doc.text, doc.headings)).toEqual(doc.headings.map((h) => h.title));
  });

  it("青空文庫の見出し注記", () => {
    const aozora = [
      "吾輩は猫である",
      "",
      "［＃８字下げ］一［＃「一」は中見出し］",
      "",
      "　吾輩《わがはい》は猫である。",
      "［＃中見出し］二［＃中見出し終わり］",
      "　ある日のこと。",
    ].join("\n");
    expect(stripAozora(aozora)).not.toContain("\u0001");
    const doc = fromFile("neko.txt", utf8(aozora));
    expect(doc.headings.map((h) => [h.title, h.level])).toEqual([
      ["一", 2],
      ["二", 2],
    ]);
    expect(titlesAt(doc.text, doc.headings)).toEqual(["一", "二"]);
  });

  it("プレーンテキストの「第一章」などの行", () => {
    const text = "序章\n始まり。\n\n第一章　出会い\n本文。第一章という語が文中にあっても見出しではない。\n\nエピローグ\n終わり。";
    expect(markPlainHeadings(text).split("\n").filter((l) => l.startsWith("\u0001")).length).toBe(3);
    const doc = fromPaste(text);
    expect(doc.headings.map((h) => h.title)).toEqual(["序章", "第一章　出会い", "エピローグ"]);
    expect(titlesAt(doc.text, doc.headings)).toEqual(["序章", "第一章　出会い", "エピローグ"]);
  });

  it("見出しがなければ空", () => {
    expect(fromPaste("ただの文章。").headings).toEqual([]);
  });
});
