import type { CSSProperties } from "react";
import type { Token } from "../../core";

interface Props {
  text: string;
  token: Token | undefined;
}

/** 強調文字（ORP）を中心線に揃えて1かたまりを表示する */
export function WordDisplay({ text, token }: Props) {
  const word = token ? text.slice(token.start, token.end) : "";
  const orp = token?.orp ?? 0;
  // 強調文字の左右で長い側の文字数。長いかたまりでも中心線からはみ出さないよう文字を縮める
  const side = Math.max(orp, word.length - orp - 1, 1);
  return (
    <div className="word" aria-hidden="true" style={{ "--side": side } as CSSProperties}>
      <span className="word-left">{word.slice(0, orp)}</span>
      <span className="word-focus">{word.charAt(orp)}</span>
      <span className="word-right">{word.slice(orp + 1)}</span>
    </div>
  );
}
