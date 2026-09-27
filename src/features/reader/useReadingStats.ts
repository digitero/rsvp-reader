import { useEffect, useRef } from "react";
import type { Lang, Player, Token } from "../../core";

/** 記録をまとめて渡す間隔 */
const FLUSH_INTERVAL_MS = 10_000;

/** かたまりの読んだ量。日本語は空白以外の文字数、英語は語数 */
export function tokenUnits(text: string, token: Token, lang: Lang): number {
  const s = text.slice(token.start, token.end);
  return lang === "ja" ? s.replace(/\s+/g, "").length : (s.match(/\S+/g)?.length ?? 0);
}

/**
 * 再生中に実際に表示し終えたかたまりの量と、再生していた時間を数えて、一定間隔と停止時に通知する。
 * シークで飛ばした部分は数えない。
 */
export function useReadingStats(
  player: Player,
  text: string,
  lang: Lang,
  onReading: ((ms: number, units: number) => void) | undefined,
): void {
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const tokensRef = useRef<readonly Token[]>([]);

  useEffect(() => {
    let units = 0;
    let ms = 0;
    let playingSince: number | null = null;
    let last = player.getState();

    const flush = () => {
      const now = performance.now();
      if (playingSince !== null) {
        ms += now - playingSince;
        playingSince = now;
      }
      if (ms > 0 || units > 0) onReadingRef.current?.(Math.round(ms), units);
      ms = 0;
      units = 0;
    };

    const unsubscribe = player.subscribe((s) => {
      const tokens = player.getTokens();
      if (tokens !== tokensRef.current) {
        // 表示単位の変更でトークン列が替わった。index の変化は読んだ量に数えない
        tokensRef.current = tokens;
        last = s;
        return;
      }
      if (last.playing && s.index === last.index + 1) units += tokenUnits(text, tokens[last.index]!, lang);
      if (s.finished && !last.finished && tokens[s.index]) units += tokenUnits(text, tokens[s.index]!, lang);
      if (s.playing && !last.playing) playingSince = performance.now();
      if (!s.playing && last.playing) {
        flush();
        playingSince = null;
      }
      last = s;
    });
    tokensRef.current = player.getTokens();

    const timer = setInterval(() => {
      if (player.getState().playing) flush();
    }, FLUSH_INTERVAL_MS);
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [player, text, lang]);
}
