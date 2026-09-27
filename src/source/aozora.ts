/**
 * 青空文庫形式のテキストから、読書の邪魔になる注記を取り除く。
 * - ルビ: ｜漢字《かんじ》 / 漢字《かんじ》 → 漢字
 * - 注記: ［＃…］ を削除
 * - 冒頭の「【テキスト中に現れる記号について】」の説明ブロックと、区切り線(-----)を削除
 * - 末尾の「底本：」以降（書誌情報）を削除
 */
export function stripAozora(text: string): string {
  let t = text.replace(/\r\n?/g, "\n");
  // 記号説明ブロック: 区切り線に挟まれた部分
  t = t.replace(/^-{20,}\n[\s\S]*?\n-{20,}\n/m, "");
  // 書誌情報
  t = t.replace(/\n\s*底本：[\s\S]*$/, "\n");
  return t
    .replace(/《[^》\n]*》/g, "")
    .replace(/｜/g, "")
    .replace(/［＃[^］\n]*］/g, "")
    .replace(/※(?=\S)/g, "");
}

/** ルビ記号や注記が一定数あれば青空文庫形式とみなす */
export function looksLikeAozora(text: string): boolean {
  const sample = text.slice(0, 20000);
  const ruby = sample.match(/《[^》\n]{1,20}》/g)?.length ?? 0;
  const notes = sample.match(/［＃[^］\n]*］/g)?.length ?? 0;
  return ruby + notes >= 3 || /【テキスト中に現れる記号について】/.test(sample);
}
