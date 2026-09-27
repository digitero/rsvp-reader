import type { Token } from "./types";

/** `i` を含む文の先頭トークンのインデックス */
export function sentenceStart(tokens: readonly Token[], i: number): number {
  let k = clamp(i, 0, tokens.length - 1);
  while (k > 0 && tokens[k - 1]!.pause < 1) k--;
  return k;
}

/** `i` の次の文の先頭。最後の文なら最終トークン */
export function nextSentenceStart(tokens: readonly Token[], i: number): number {
  let k = clamp(i, 0, tokens.length - 1);
  while (k < tokens.length - 1 && tokens[k]!.pause < 1) k++;
  return Math.min(k + 1, tokens.length - 1);
}

/** 現在の文の先頭にいればひとつ前の文へ、そうでなければ現在の文の先頭へ */
export function prevSentenceStart(tokens: readonly Token[], i: number): number {
  const s = sentenceStart(tokens, i);
  return s === i && s > 0 ? sentenceStart(tokens, s - 1) : s;
}

/** 文字オフセットを含む（またはその直後の）トークンのインデックス */
export function indexAtOffset(tokens: readonly Token[], offset: number): number {
  let lo = 0;
  let hi = tokens.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tokens[mid]!.end <= offset) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(lo, 0);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(max, min));
}
