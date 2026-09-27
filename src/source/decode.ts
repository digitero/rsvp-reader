/**
 * テキストファイルのバイト列を文字列にする。UTF-8 で読めなければ Shift_JIS とみなす
 * （日本語の古い .txt、青空文庫など）。
 */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view[0] === 0xff && view[1] === 0xfe) return new TextDecoder("utf-16le").decode(view);
  if (view[0] === 0xfe && view[1] === 0xff) return new TextDecoder("utf-16be").decode(view);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("shift_jis").decode(view);
  }
}
