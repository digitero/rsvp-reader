import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countUnits, estimateMinutesLeft, Library, progressRatio } from "./library";

let lib: Library;
let n = 0;
beforeEach(async () => {
  lib = await Library.open(`test-${++n}`);
});
afterEach(() => lib.close());

const doc = (title: string, text = "吾輩は猫である。") => ({
  title,
  text,
  lang: "ja" as const,
  source: "paste" as const,
  headings: [{ offset: 0, title, level: 1 }],
});

describe("Library", () => {
  it("追加した文書の本文とメタ情報を取り出せる", async () => {
    const meta = await lib.add(doc("猫", "吾輩は 猫である。"), 1000);
    expect(meta).toMatchObject({ title: "猫", charCount: 9, unitCount: 8, offset: 0, finished: false, lastReadAt: null });
    expect(meta.headings).toEqual([{ offset: 0, title: "猫", level: 1 }]);
    expect(await lib.get(meta.id)).toEqual({ meta, text: "吾輩は 猫である。" });
  });

  it("一覧は最近読んだ順、未読は追加した順で並ぶ", async () => {
    const a = await lib.add(doc("A"), 1000);
    await lib.add(doc("B"), 2000);
    await lib.add(doc("C"), 3000);
    await lib.saveProgress(a.id, 3, false, 4000);
    expect((await lib.list()).map((d) => d.title)).toEqual(["A", "C", "B"]);
  });

  it("進捗を保存できる", async () => {
    const a = await lib.add(doc("A"));
    const saved = await lib.saveProgress(a.id, 5, true, 5000);
    expect(saved).toMatchObject({ offset: 5, finished: true, lastReadAt: 5000 });
    expect((await lib.get(a.id))?.meta.offset).toBe(5);
  });

  it("存在しない文書への保存は何もしない", async () => {
    expect(await lib.saveProgress("missing", 1, false)).toBeUndefined();
  });

  it("削除すると本文も消える", async () => {
    const a = await lib.add(doc("A"));
    await lib.remove(a.id);
    expect(await lib.get(a.id)).toBeUndefined();
    expect(await lib.list()).toEqual([]);
  });
});

describe("目安の計算", () => {
  it("countUnits は日本語で文字数、英語で語数", () => {
    expect(countUnits("吾輩は 猫\nである", "ja")).toBe(7);
    expect(countUnits("The quick  brown\nfox", "en")).toBe(4);
  });

  it("progressRatio と残り時間", () => {
    const base = { id: "x", title: "", lang: "ja" as const, source: "paste" as const, createdAt: 0, lastReadAt: null };
    const meta = { ...base, charCount: 1000, unitCount: 1000, offset: 250, finished: false };
    expect(progressRatio(meta)).toBe(0.25);
    expect(estimateMinutesLeft(meta, 600)).toBeCloseTo(1.5);
    expect(progressRatio({ ...meta, finished: true })).toBe(1);
  });
});
