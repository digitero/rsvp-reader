/**
 * 改行コードと空白を正規化する。トークンのオフセットはこの結果に対して計算するので、
 * 保存する本文もこの関数を通したものにする。
 */
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t　]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
