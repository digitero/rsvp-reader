import type { Lang } from "./types";

const JA_CHAR = /[぀-ヿ㐀-鿿ｦ-ﾟ]/g;
const LATIN_CHAR = /[A-Za-z]/g;

/** かな・漢字が英字の1割以上あれば日本語とみなす（日本語は1文字あたりの情報量が多い） */
export function detectLang(text: string): Lang {
  const sample = text.slice(0, 5000);
  const ja = sample.match(JA_CHAR)?.length ?? 0;
  const latin = sample.match(LATIN_CHAR)?.length ?? 0;
  return ja > 0 && ja >= latin * 0.1 ? "ja" : "en";
}
