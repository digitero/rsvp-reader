import { detectLang, normalize, type Lang } from "../core";
import { looksLikeAozora, stripAozora } from "./aozora";
import { decodeText } from "./decode";
import { extractHeadings, markPlainHeadings, type Heading } from "./headings";
import { markdownTitle, markdownToText } from "./markdown";

export type SourceKind = "paste" | "txt" | "md";

export interface ImportedText {
  title: string;
  text: string;
  lang: Lang;
  source: SourceKind;
  /** 目次。見出しが見つからなければ空 */
  headings: Heading[];
}

export const ACCEPTED_FILES = ".txt,.md,.markdown,.text,text/plain,text/markdown";
const TITLE_MAX = 40;

export class ImportError extends Error {}

/** 貼り付けた文章から文書を作る。タイトルは最初の行 */
export function fromPaste(input: string): ImportedText {
  const { text, headings } = toPlain(input, false);
  if (!text) throw new ImportError("文章が空です。");
  return { title: truncate(text.split("\n", 1)[0]!), text, lang: detectLang(text), source: "paste", headings };
}

/** ファイル名とバイト列から文書を作る。Markdown は記号を落として最初の見出しをタイトルにする */
export function fromFile(name: string, bytes: ArrayBuffer | Uint8Array): ImportedText {
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
  if (!["txt", "text", "md", "markdown", ""].includes(ext)) {
    throw new ImportError(`「${name}」は読み込めません。.txt または .md のファイルを選んでください。`);
  }
  const raw = decodeText(bytes);
  if (raw.includes("\u0000")) {
    throw new ImportError(`「${name}」はテキストファイルではないようです。`);
  }
  const isMd = ext === "md" || ext === "markdown";
  const { text, headings } = toPlain(raw, isMd);
  if (!text) throw new ImportError(`「${name}」には文章がありません。`);
  const base = name.replace(/\.[^.]+$/, "");
  const title = (isMd ? markdownTitle(raw) : undefined) ?? (base || text.split("\n", 1)[0]!);
  return { title: truncate(title), text, lang: detectLang(text), source: isMd ? "md" : "txt", headings };
}

/** 記法を取り除いて正規化し、見出しの位置を拾う */
function toPlain(raw: string, isMd: boolean): { text: string; headings: Heading[] } {
  const marked = isMd
    ? markdownToText(raw, { markHeadings: true })
    : looksLikeAozora(raw)
      ? stripAozora(raw, { markHeadings: true })
      : markPlainHeadings(raw);
  return extractHeadings(normalize(marked));
}

function truncate(s: string): string {
  const t = s.trim();
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX)}…` : t;
}
