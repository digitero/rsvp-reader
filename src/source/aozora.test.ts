import { expect, it } from "vitest";
import { looksLikeAozora, stripAozora } from "./aozora";
import { fromFile, fromPaste } from "./importText";

const sample = [
  "吾輩は猫である",
  "夏目漱石",
  "",
  "-------------------------------------------------------",
  "【テキスト中に現れる記号について】",
  "《》：ルビ",
  "-------------------------------------------------------",
  "",
  "［＃８字下げ］一［＃「一」は中見出し］",
  "",
  "　吾輩《わがはい》は猫である。名前はまだ無い。",
  "　どこで生れたかとんと見当《けんとう》がつかぬ。｜何《なん》でも薄暗い所で泣いていた事だけは記憶している。",
  "",
  "底本：「夏目漱石全集1」ちくま文庫、筑摩書房",
  "入力：柴田卓治",
].join("\n");

it("ルビ・注記・記号説明・書誌情報を取り除く", () => {
  expect(stripAozora(sample)).toBe(
    [
      "吾輩は猫である",
      "夏目漱石",
      "",
      "",
      "一",
      "",
      "　吾輩は猫である。名前はまだ無い。",
      "　どこで生れたかとんと見当がつかぬ。何でも薄暗い所で泣いていた事だけは記憶している。",
      "",
    ].join("\n"),
  );
});

it("looksLikeAozora", () => {
  expect(looksLikeAozora(sample)).toBe(true);
  expect(looksLikeAozora("普通の文章。《引用》ではない。")).toBe(false);
});

it(".txt が青空文庫形式なら自動で注記を落とす", () => {
  const doc = fromFile("wagahai.txt", new TextEncoder().encode(sample));
  expect(doc.text).not.toMatch(/[《》｜［］]/);
  expect(doc.text).toContain("吾輩は猫である。名前はまだ無い。");
});

it("貼り付けた青空文庫形式の文章も注記を落とす", () => {
  expect(fromPaste(sample).text).not.toMatch(/[《》｜［］]/);
});
