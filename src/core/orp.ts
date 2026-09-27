const LEADING = /^[「『（(［\["'“‘]+/;

/**
 * 強調する文字の位置を返す。先頭の括弧や引用符は数えない。
 * 1文字 → 1文字目、2–4 → 2文字目、5–8 → 3文字目、9–13 → 4文字目。
 * それより長いかたまり（2文節まとめなど）は全体の約3割の位置にして、左右の長さの偏りを抑える。
 */
export function orpIndex(word: string): number {
  if (word.length === 0) return 0;
  const lead = LEADING.exec(word)?.[0].length ?? 0;
  const n = word.length - lead;
  const k = n <= 1 ? 0 : n <= 4 ? 1 : n <= 8 ? 2 : n <= 13 ? 3 : Math.round(n * 0.3);
  return Math.min(lead + k, word.length - 1);
}
