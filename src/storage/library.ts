import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Lang } from "../core";
import type { Heading } from "../source/headings";
import type { ImportedText, SourceKind } from "../source/importText";
import { addToDay, dateKey, emptyDay, type DailyStats } from "./stats";

/** ライブラリ一覧に出す情報。本文は大きいので別のストアに置く */
export interface DocMeta {
  id: string;
  title: string;
  lang: Lang;
  source: SourceKind;
  createdAt: number;
  /** 最後に開いた、または進捗を保存した時刻 */
  lastReadAt: number | null;
  charCount: number;
  /** 日本語は空白以外の文字数、英語は語数。残り時間の目安に使う */
  unitCount: number;
  /** 読書位置（本文の文字オフセット） */
  offset: number;
  finished: boolean;
  /** 目次。M5 より前に追加した文書には無い */
  headings?: Heading[];
  /** しおり（本文の位置の昇順） */
  bookmarks?: Bookmark[];
}

export interface Bookmark {
  id: string;
  /** しおりを挟んだ文の先頭の文字オフセット */
  offset: number;
  createdAt: number;
}

interface Schema extends DBSchema {
  docs: { key: string; value: DocMeta };
  texts: { key: string; value: string };
  stats: { key: string; value: DailyStats };
}

const DB_NAME = "rsvp-reader";

export class Library {
  private constructor(private readonly db: IDBPDatabase<Schema>) {}

  /**
   * @param onBlocked 古い版のアプリが別のタブなどで開いたままで、データベースを更新できないときに呼ぶ。
   *   そのタブが閉じられると、開く処理はそのまま続く。
   */
  static async open(name = DB_NAME, onBlocked?: () => void): Promise<Library> {
    let opened: IDBPDatabase<Schema> | undefined;
    const db = await openDB<Schema>(name, 2, {
      blocked() {
        onBlocked?.();
      },
      // 新しい版が別のタブで開かれたら、こちらの接続を閉じて更新を妨げない
      blocking() {
        opened?.close();
      },
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("docs", { keyPath: "id" });
          db.createObjectStore("texts");
        }
        if (oldVersion < 2) db.createObjectStore("stats", { keyPath: "date" });
      },
    });
    opened = db;
    return new Library(db);
  }

  /** 最近読んだ順（未読は追加した順） */
  async list(): Promise<DocMeta[]> {
    const docs = await this.db.getAll("docs");
    return docs.sort((a, b) => (b.lastReadAt ?? b.createdAt) - (a.lastReadAt ?? a.createdAt));
  }

  async get(id: string): Promise<{ meta: DocMeta; text: string } | undefined> {
    const tx = this.db.transaction(["docs", "texts"]);
    const [meta, text] = await Promise.all([tx.objectStore("docs").get(id), tx.objectStore("texts").get(id)]);
    await tx.done;
    return meta && text !== undefined ? { meta, text } : undefined;
  }

  async add(doc: ImportedText, now = Date.now()): Promise<DocMeta> {
    const meta: DocMeta = {
      id: newId(),
      title: doc.title,
      lang: doc.lang,
      source: doc.source,
      createdAt: now,
      lastReadAt: null,
      charCount: doc.text.length,
      unitCount: countUnits(doc.text, doc.lang),
      offset: 0,
      finished: false,
      headings: doc.headings,
    };
    const tx = this.db.transaction(["docs", "texts"], "readwrite");
    await Promise.all([tx.objectStore("docs").put(meta), tx.objectStore("texts").put(doc.text, meta.id), tx.done]);
    return meta;
  }

  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(["docs", "texts"], "readwrite");
    await Promise.all([tx.objectStore("docs").delete(id), tx.objectStore("texts").delete(id), tx.done]);
  }

  async saveProgress(id: string, offset: number, finished: boolean, now = Date.now()): Promise<DocMeta | undefined> {
    const tx = this.db.transaction("docs", "readwrite");
    const meta = await tx.store.get(id);
    if (!meta) return undefined;
    const next = { ...meta, offset, finished, lastReadAt: now };
    await tx.store.put(next);
    await tx.done;
    return next;
  }

  /** しおりを追加する。同じ位置にすでにあれば何もしない */
  async addBookmark(id: string, offset: number, now = Date.now()): Promise<DocMeta | undefined> {
    return this.updateDoc(id, (meta) => {
      const bookmarks = meta.bookmarks ?? [];
      if (bookmarks.some((b) => b.offset === offset)) return meta;
      const next = [...bookmarks, { id: newId(), offset, createdAt: now }].sort((a, b) => a.offset - b.offset);
      return { ...meta, bookmarks: next };
    });
  }

  async removeBookmark(id: string, bookmarkId: string): Promise<DocMeta | undefined> {
    return this.updateDoc(id, (meta) => ({
      ...meta,
      bookmarks: (meta.bookmarks ?? []).filter((b) => b.id !== bookmarkId),
    }));
  }

  /** 読んだ時間と量を、その日の記録に足す */
  async addReading(lang: Lang, ms: number, units: number, now = new Date()): Promise<void> {
    if (ms <= 0 && units <= 0) return;
    const tx = this.db.transaction("stats", "readwrite");
    const key = dateKey(now);
    const day = (await tx.store.get(key)) ?? emptyDay(key);
    await tx.store.put(addToDay(day, lang, ms, units));
    await tx.done;
  }

  async listStats(): Promise<DailyStats[]> {
    return this.db.getAll("stats");
  }

  private async updateDoc(id: string, fn: (meta: DocMeta) => DocMeta): Promise<DocMeta | undefined> {
    const tx = this.db.transaction("docs", "readwrite");
    const meta = await tx.store.get(id);
    if (!meta) return undefined;
    const next = fn(meta);
    await tx.store.put(next);
    await tx.done;
    return next;
  }

  close(): void {
    this.db.close();
  }
}

/** `crypto.randomUUID` は安全なコンテキスト（https / localhost）でしか使えないので、LAN の http でも動くようにする */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function countUnits(text: string, lang: Lang): number {
  return lang === "ja" ? text.replace(/\s+/g, "").length : (text.match(/\S+/g)?.length ?? 0);
}

/** 読んだ割合（0–1） */
export function progressRatio(meta: DocMeta): number {
  if (meta.finished) return 1;
  return meta.charCount > 0 ? Math.min(meta.offset / meta.charCount, 1) : 0;
}

/** 句読点の停止ぶんを 2 割見込んだ残り時間の目安（分） */
export function estimateMinutesLeft(meta: DocMeta, speed: number): number {
  return (meta.unitCount * (1 - progressRatio(meta)) * 1.2) / speed;
}
