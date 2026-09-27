/**
 * Markdown を読むための平文にする。完全なパーサではなく、読書の邪魔になる記号を落とす程度。
 * 見出し・段落・リストの区切りは改行として残す。
 */
import { markHeading } from "./headings";

export function markdownToText(md: string, options: { markHeadings?: boolean } = {}): string {
  const lines: string[] = [];
  let inFence = false;
  let inFrontMatter = false;

  md.replace(/\r\n?/g, "\n").split("\n").forEach((raw, i) => {
    if (i === 0 && raw.trim() === "---") {
      inFrontMatter = true;
      return;
    }
    if (inFrontMatter) {
      if (raw.trim() === "---" || raw.trim() === "...") inFrontMatter = false;
      return;
    }
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      lines.push(raw);
      return;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(raw)) {
      lines.push(""); // 区切り線
      return;
    }
    if (/^\s*\|?\s*:?-{3,}/.test(raw) && raw.includes("|")) return; // 表の区切り行

    const headingLevel = /^\s{0,3}(#{1,6})\s+/.exec(raw)?.[1]?.length;
    let line = raw
      .replace(/^\s{0,3}#{1,6}\s+/, "") // 見出し
      .replace(/\s+#+\s*$/, "")
      .replace(/^\s*>\s?/, "") // 引用
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, "") // リスト・チェックボックス
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 画像
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // リンク
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
      .replace(/^\s*\[[^\]]+\]:\s+\S+.*$/, "") // 参照リンク定義
      .replace(/<\/?[a-zA-Z][^>]*>/g, "") // HTML タグ
      .replace(/`([^`]+)`/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, "$1$2")
      .replace(/~~(.+?)~~/g, "$1");

    if (line.includes("|") && /^\s*\|.*\|\s*$/.test(line)) {
      line = line.split("|").map((c) => c.trim()).filter(Boolean).join("、");
    }
    lines.push(options.markHeadings && headingLevel ? markHeading(line, headingLevel) : line);
  });

  return lines.join("\n");
}

/** 最初の見出しの文字列 */
export function markdownTitle(md: string): string | undefined {
  return /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m.exec(md)?.[1];
}
