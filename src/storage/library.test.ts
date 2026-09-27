import "fake-indexeddb/auto";
import { openDB } from "idb";
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

describe("しおり", () => {
  it("追加すると位置順に並び、同じ位置は重複しない", async () => {
    const a = await lib.add(doc("A", "一文目。二文目。三文目。"));
    await lib.addBookmark(a.id, 8, 1);
    await lib.addBookmark(a.id, 4, 2);
    const meta = await lib.addBookmark(a.id, 8, 3);
    expect(meta?.bookmarks?.map((b) => b.offset)).toEqual([4, 8]);
  });

  it("削除できる", async () => {
    const a = await lib.add(doc("A"));
    const added = await lib.addBookmark(a.id, 2);
    const meta = await lib.removeBookmark(a.id, added!.bookmarks![0]!.id);
    expect(meta?.bookmarks).toEqual([]);
  });
});

describe("読書の記録", () => {
  it("同じ日の記録は足し合わせる", async () => {
    const day = new Date(2026, 8, 27, 10);
    await lib.addReading("ja", 60_000, 500, day);
    await lib.addReading("ja", 30_000, 200, new Date(2026, 8, 27, 22));
    await lib.addReading("en", 10_000, 40, day);
    await lib.addReading("ja", 0, 0, day);
    expect(await lib.listStats()).toEqual([
      { date: "2026-09-27", ja: { ms: 90_000, units: 700 }, en: { ms: 10_000, units: 40 } },
    ]);
  });
});

it("バージョン1のデータベースから、文書を残したまま移行できる", async () => {
  const name = `legacy-${++n}`;
  const v1 = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore("docs", { keyPath: "id" });
      db.createObjectStore("texts");
    },
  });
  await v1.put("docs", { id: "old", title: "旧", createdAt: 1, lastReadAt: null });
  await v1.put("texts", "本文", "old");
  v1.close();

  const upgraded = await Library.open(name);
  expect((await upgraded.list()).map((d) => d.id)).toEqual(["old"]);
  await upgraded.addReading("ja", 1000, 10);
  expect(await upgraded.listStats()).toHaveLength(1);
  upgraded.close();
});

it("古い版の接続が開いたままなら onBlocked を呼び、閉じられたら開ける", async () => {
  const name = `blocked-${++n}`;
  const v1 = await openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore("docs", { keyPath: "id" });
      db.createObjectStore("texts");
    },
  });
  let blocked = false;
  const opening = Library.open(name, () => {
    blocked = true;
    v1.close(); // 利用者が古いタブを閉じた
  });
  const lib2 = await opening;
  expect(blocked).toBe(true);
  expect(await lib2.listStats()).toEqual([]);
  lib2.close();
});

it("新しい版が開かれたら、自分の接続を閉じて更新を妨げない", async () => {
  const name = `blocking-${++n}`;
  const first = await Library.open(name);
  let blocked = false;
  const newer = await openDB(name, 3, {
    blocked() {
      blocked = true;
    },
  });
  expect(blocked).toBe(false);
  newer.close();
  first.close();
});
