import { describe, expect, it } from "vitest";
import { decodeText } from "./decode";
import { fromFile, fromPaste, ImportError } from "./importText";
import { markdownTitle, markdownToText } from "./markdown";

const utf8 = (s: string) => new TextEncoder().encode(s);

describe("markdownToText", () => {
  it("記号を落として文章だけを残す", () => {
    const md = [
      "---",
      "title: meta",
      "---",
      "# 見出し",
      "",
      "これは**太字**と*斜体*と`コード`、[リンク](https://example.com)です。",
      "![図](a.png)",
      "- 項目1",
      "1. 項目2",
      "> 引用文",
      "",
      "```js",
      "const a = 1;",
      "```",
      "---",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| 速度 | 600 |",
    ].join("\n");
    expect(markdownToText(md).split("\n")).toEqual([
      "見出し",
      "",
      "これは太字と斜体とコード、リンクです。",
      "",
      "項目1",
      "項目2",
      "引用文",
      "",
      "const a = 1;",
      "",
      "名前、値",
      "速度、600",
    ]);
  });

  it("snake_case のような語中のアンダースコアは残す", () => {
    expect(markdownToText("use snake_case_name here")).toBe("use snake_case_name here");
  });

  it("markdownTitle は最初の見出し", () => {
    expect(markdownTitle("前置き\n## 第1章 はじめに ##\n# 次")).toBe("第1章 はじめに");
    expect(markdownTitle("見出しなし")).toBeUndefined();
  });
});

describe("decodeText", () => {
  it("UTF-8", () => {
    expect(decodeText(utf8("吾輩は猫である"))).toBe("吾輩は猫である");
  });

  it("UTF-8 として不正なら Shift_JIS で読む", () => {
    // 「吾輩は猫」の Shift_JIS
    const sjis = new Uint8Array([0x8c, 0xe1, 0x94, 0x79, 0x82, 0xcd, 0x94, 0x4c]);
    expect(decodeText(sjis)).toBe("吾輩は猫");
  });

  it("UTF-16 LE の BOM", () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, 0x42, 0x30]))).toBe("あ");
  });
});

describe("import", () => {
  it("fromPaste は最初の行をタイトルに、言語を判定する", () => {
    const doc = fromPaste("\r\n  最初の行です。\r\n\r\n本文。");
    expect(doc).toEqual({
      title: "最初の行です。",
      text: "最初の行です。\n\n本文。",
      lang: "ja",
      source: "paste",
      headings: [],
    });
  });

  it("fromPaste は長いタイトルを切り詰める", () => {
    expect(fromPaste("あ".repeat(60)).title).toBe(`${"あ".repeat(40)}…`);
  });

  it("空の入力はエラー", () => {
    expect(() => fromPaste("  \n ")).toThrow(ImportError);
  });

  it(".md は見出しをタイトルにして記号を落とす", () => {
    const doc = fromFile("notes.md", utf8("# Reading Notes\n\nSome **bold** text."));
    expect(doc).toMatchObject({ title: "Reading Notes", text: "Reading Notes\n\nSome bold text.", lang: "en", source: "md" });
  });

  it(".txt はファイル名をタイトルにする", () => {
    expect(fromFile("吾輩は猫である.txt", utf8("本文")).title).toBe("吾輩は猫である");
  });

  it("対応していない拡張子やバイナリは読み込まない", () => {
    expect(() => fromFile("book.pdf", utf8("x"))).toThrow(/\.txt または \.md/);
    expect(() => fromFile("a.txt", new Uint8Array([0x41, 0x00, 0x42]))).toThrow(/テキストファイルではない/);
  });
});
