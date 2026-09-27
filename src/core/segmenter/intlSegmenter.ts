import { orpIndex } from "../orp";
import type { Lang, Pause, SegmentOptions, Segmenter, Token } from "../types";

export const DEFAULT_CHUNK_MAX = 10;

/** 助詞・助動詞・送り仮名とみなして直前に連結する */
const HIRAGANA = /^[ぁ-ゟー]+$/;
/** 直前に連結し、そこでかたまりを確定する */
const BREAKING_PUNCT = /^[、。，．,.!?！？…‥:;：；]+$/;
/** 直前に連結するが、かたまりは確定しない */
const CLOSING = /^[」』）)］\]〕】”’・]+$/;
/** 次のかたまりの先頭に付ける */
const OPENING = /^[「『（(［\[〔【“‘]+$/;
const NUMERIC_END = /[0-9０-９]$/;
/** 数字の直後の助数詞（年・月・倍・人 など） */
const COUNTER = /^[一-鿿]{1,2}$/;
/** 「第」とその後の数字（漢数字を含む）。「第2章」「第十一話」を1かたまりにする */
const ORDINAL_OPEN = /^第[0-9０-９一二三四五六七八九十百千〇]*$/;
const ORDINAL_PART = /^(?:[0-9０-９一二三四五六七八九十百千〇]+|[章節話部回編幕巻条項])$/;
const WHITESPACE = /^\s+$/;
const HAS_ALNUM = /[A-Za-z0-9]/;
const HAS_NON_ASCII = /[^\x00-\x7F]/;

/**
 * ひらがなだけで書かれても自立して意味を持つ語。直前には連結しない。
 * 形態素解析なしで「名前はまだ」「それはとても」のような誤連結を減らすための最小限のリスト。
 */
const STANDALONE = new Set([
  "まだ", "もう", "とても", "すでに", "また", "まず", "そして", "しかし", "だから", "ただし",
  "つまり", "さらに", "やはり", "かなり", "もっと", "ずっと", "すぐ", "よく", "いつも", "なぜ",
  "どう", "こう", "そう", "ああ", "それ", "これ", "あれ", "どれ", "その", "この", "あの", "どの",
  "ここ", "そこ", "あそこ", "どこ", "いま", "たとえば", "ところが", "けれども", "なお", "ほぼ",
  "ほとんど", "たぶん", "きっと", "ぜひ", "どうか", "ちょうど", "ちょっと", "いくつ", "いくら", "とんと",
]);

interface Piece {
  text: string;
  index: number;
}

interface Span {
  start: number;
  end: number;
  paraEnd?: boolean;
  /** 連結した元のセグメント数 */
  pieces?: number;
}

/** 長い語の直後でも、この長さまでのひらがなは上限を超えて連結する（「Intl.Segmenterで」など） */
const SHORT_PARTICLE = 2;

/** ブラウザ標準の `Intl.Segmenter` を使う分割。未対応環境では文字種で分割する */
export class IntlSegmenter implements Segmenter {
  readonly id = "intl-v1";
  private readonly ja: Intl.Segmenter | null;

  constructor() {
    this.ja = typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter("ja", { granularity: "word" })
      : null;
  }

  async segment(text: string, lang: Lang, options?: SegmentOptions): Promise<Token[]> {
    return this.segmentSync(text, lang, options);
  }

  segmentSync(text: string, lang: Lang, options: SegmentOptions = {}): Token[] {
    const spans: Span[] = [];
    for (const para of paragraphs(text)) {
      const before = spans.length;
      if (lang === "ja") this.chunkJa(para, options.chunkMax ?? DEFAULT_CHUNK_MAX, spans);
      else chunkEn(para, spans);
      if (spans.length > before) spans[spans.length - 1]!.paraEnd = true;
    }
    return spans.map((s) => toToken(text, s));
  }

  private rawPieces(text: string): Piece[] {
    if (this.ja) {
      return Array.from(this.ja.segment(text), (s) => ({ text: s.segment, index: s.index }));
    }
    const out: Piece[] = [];
    const re = /[一-鿿々]+|[゠-ヿ]+|[ぁ-ゟ]+|[A-Za-z0-9'’.-]+|\s+|./gu;
    for (const m of text.matchAll(re)) out.push({ text: m[0], index: m.index });
    return out;
  }

  private chunkJa(para: Piece, chunkMax: number, out: Span[]): void {
    let cur: Span | null = null;
    let prefixStart: number | null = null;
    const flush = () => {
      if (cur) out.push(cur);
      cur = null;
    };

    for (const piece of this.rawPieces(para.text)) {
      const s = piece.text;
      const start = para.index + piece.index;
      const end = start + s.length;

      if (WHITESPACE.test(s)) {
        flush();
        continue;
      }
      if (BREAKING_PUNCT.test(s)) {
        const target: Span | undefined = cur ?? out[out.length - 1];
        // 空白や段落をまたいで連結しないよう、直前のかたまりと隣接しているときだけ付ける
        if (target && prefixStart === null && target.end === start) {
          target.end = end;
          flush();
          continue;
        }
        // 段落先頭の「……」などは単独のかたまりにする
      }
      if (CLOSING.test(s) && prefixStart === null) {
        // 「…。」と のように閉じ括弧の後に続く助詞を連結できるよう、確定済みのかたまりを開き直す
        if (!cur && out.length > 0 && out[out.length - 1]!.end === start) cur = out.pop()!;
        if (cur) {
          cur.end = end;
          continue;
        }
      }
      if (OPENING.test(s)) {
        flush();
        prefixStart ??= start;
        continue;
      }
      if (cur && prefixStart === null && fits(cur, s, end, chunkMax) && joinsPrevious(para, cur, s)) {
        cur.end = end;
        cur.pieces = (cur.pieces ?? 1) + 1;
        continue;
      }
      flush();
      cur = { start: prefixStart ?? start, end, pieces: 1 };
      prefixStart = null;
    }
    flush();
    if (prefixStart !== null) out.push({ start: prefixStart, end: para.index + para.text.length });
  }
}

function fits(cur: Span, s: string, end: number, chunkMax: number): boolean {
  if (end - cur.start <= chunkMax) return true;
  return cur.pieces === 1 && s.length <= SHORT_PARTICLE && HIRAGANA.test(s);
}

function joinsPrevious(para: Piece, cur: Span, s: string): boolean {
  if (HIRAGANA.test(s)) return !STANDALONE.has(s);
  const prev = para.text.slice(cur.start - para.index, cur.end - para.index);
  if (ORDINAL_OPEN.test(prev) && ORDINAL_PART.test(s)) return true;
  return NUMERIC_END.test(prev) && COUNTER.test(s);
}

function chunkEn(para: Piece, out: Span[]): void {
  for (const m of para.text.matchAll(/\S+/g)) {
    const start = para.index + m.index;
    out.push({ start, end: start + m[0].length });
  }
}

function paragraphs(text: string): Piece[] {
  return Array.from(text.matchAll(/[^\n]+/g), (m) => ({ text: m[0], index: m.index }))
    .filter((p) => !WHITESPACE.test(p.text));
}

function toToken(text: string, span: Span): Token {
  const word = text.slice(span.start, span.end);
  return {
    start: span.start,
    end: span.end,
    orp: orpIndex(word),
    pause: span.paraEnd ? 2 : pauseOf(word),
    weight: HAS_ALNUM.test(word) && HAS_NON_ASCII.test(word) ? 1.3 : 1,
  };
}

function pauseOf(word: string): Pause {
  const last = word.replace(/[」』）)］\]〕】”’"']+$/, "").slice(-1);
  if ("。！？.!?".includes(last)) return 1;
  if ("、，,;；:：…".includes(last)) return 0.5;
  return 0;
}
