import { useMemo } from "react";
import { detectLang, IntlSegmenter, normalize, remainingMs } from "./core";

const SAMPLE = normalize("吾輩は猫である。名前はまだ無い。\n\nどこで生れたかとんと見当がつかぬ。");

/** M2 でリーダー画面に置き換える。いまはコアエンジンの出力を確認するだけの画面 */
export function App() {
  const { lang, words, seconds } = useMemo(() => {
    const lang = detectLang(SAMPLE);
    const tokens = new IntlSegmenter().segmentSync(SAMPLE, lang);
    return {
      lang,
      words: tokens.map((t) => SAMPLE.slice(t.start, t.end)),
      seconds: Math.round(remainingMs(tokens, 0, { lang, speed: 600 }) / 1000),
    };
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>RSVP Reader</h1>
      <p>lang: {lang} / tokens: {words.length} / 約{seconds}秒</p>
      <p>{words.join(" | ")}</p>
    </main>
  );
}
