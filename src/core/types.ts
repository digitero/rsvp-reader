export type Lang = "ja" | "en";

/** 読点・句点・段落末で追加する停止の強さ */
export type Pause = 0 | 0.5 | 1 | 2;

/**
 * 表示の1単位。原文は持たず、原文への文字オフセットだけを持つ。
 * 表示文字列は常に `text.slice(start, end)` で取り出す。
 */
export interface Token {
  /** 原文での開始オフセット */
  start: number;
  /** 原文での終了オフセット（exclusive） */
  end: number;
  /** 強調する文字のトークン内インデックス */
  orp: number;
  pause: Pause;
  /** 表示時間の倍率。既定 1 */
  weight: number;
}

export interface SegmentOptions {
  /** 日本語のかたまりの最大文字数 */
  chunkMax?: number;
}

export interface Segmenter {
  /** キャッシュのキーに使う識別子 */
  readonly id: string;
  segment(text: string, lang: Lang, options?: SegmentOptions): Promise<Token[]>;
}
