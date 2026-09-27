import { orpIndex } from "./orp";
import type { Token } from "./types";

/**
 * 連続する `size` 個までのトークンを1つにまとめる（「2文節ずつ」表示など）。
 * 読点・句点・段落末で止まるトークンの後ではまとめを区切るので、文をまたがない。
 * まとめた結果が `maxLength` 文字を超える場合はまとめない（狭い画面で文字が小さくなりすぎないように）。
 */
export function groupTokens(
  tokens: readonly Token[],
  text: string,
  size: number,
  maxLength = Number.POSITIVE_INFINITY,
): Token[] {
  if (size <= 1) return tokens.slice();
  const out: Token[] = [];
  let i = 0;
  while (i < tokens.length) {
    const first = tokens[i]!;
    let last = first;
    let weight = first.weight;
    let n = 1;
    while (n < size && last.pause === 0 && i + n < tokens.length) {
      const next = tokens[i + n]!;
      if (next.end - first.start > maxLength) break;
      last = next;
      weight = Math.max(weight, last.weight);
      n++;
    }
    out.push({
      start: first.start,
      end: last.end,
      orp: orpIndex(text.slice(first.start, last.end)),
      pause: last.pause,
      weight,
    });
    i += n;
  }
  return out;
}
