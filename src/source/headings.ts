/** 目次の1項目。offset は正規化後の本文での、見出し行の先頭位置 */
export interface Heading {
  offset: number;
  title: string;
  /** 1 が最上位 */
  level: number;
}

/**
 * 見出し行の先頭に付ける目印。本文の正規化（改行や空白の整理）を通した後で位置を拾うために使い、
 * `extractHeadings` で取り除く。本文に現れない制御文字を使う。
 */
const MARK = "\u0001";
const TITLE_MAX = 40;

export function markHeading(line: string, level: number): string {
  return `${MARK}${Math.min(Math.max(level, 1), 6)}${line}`;
}

/** 目印を取り除き、見出しの位置と文字列を返す */
export function extractHeadings(marked: string): { text: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const out: string[] = [];
  let offset = 0;
  for (const line of marked.split("\n")) {
    let content = line;
    if (line.startsWith(MARK)) {
      content = line.slice(2);
      const title = content.trim();
      if (title) {
        headings.push({
          offset: offset + (content.length - content.trimStart().length),
          title: title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX)}…` : title,
          level: Number(line[1]) || 1,
        });
      }
    }
    content = content.replaceAll(MARK, "");
    out.push(content);
    offset += content.length + 1;
  }
  return { text: out.join("\n"), headings };
}

/** 「第一章」「第3話」「序章」「プロローグ」などの短い行を見出しとみなす（プレーンテキスト用） */
const PLAIN_HEADING =
  /^[\s　]*(?:第[一二三四五六七八九十百千〇零\d０-９]+[章節話部回編幕]|序章|終章|序|跋|プロローグ|エピローグ|あとがき|はじめに|おわりに|Chapter\s+\w+|CHAPTER\s+\w+|Prologue|Epilogue)(?:[\s　:：.．、]|$)/;

export function markPlainHeadings(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim().length <= 30 && PLAIN_HEADING.test(line) ? markHeading(line, 1) : line))
    .join("\n");
}
