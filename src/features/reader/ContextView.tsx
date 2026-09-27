import { Fragment, useLayoutEffect, useMemo, useRef } from "react";
import { nextSentenceStart, sentenceStart, type Token } from "../../core";

interface Props {
  text: string;
  tokens: readonly Token[];
  index: number;
  finished: boolean;
  onPick: (index: number) => void;
}

const SENTENCES_BEFORE = 3;
const SENTENCES_AFTER = 4;

/** 停止中に現在位置の前後の文を通常の文章として表示する。語を選ぶとそこから再開する */
export function ContextView({ text, tokens, index, finished, onPick }: Props) {
  const currentRef = useRef<HTMLButtonElement>(null);

  const [from, to] = useMemo(() => {
    let from = sentenceStart(tokens, index);
    for (let i = 0; i < SENTENCES_BEFORE && from > 0; i++) from = sentenceStart(tokens, from - 1);
    let to = index;
    for (let i = 0; i < SENTENCES_AFTER && to < tokens.length - 1; i++) to = nextSentenceStart(tokens, to);
    return [from, to === tokens.length - 1 ? tokens.length : to];
  }, [tokens, index]);

  useLayoutEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, [index, from]);

  const items = [];
  for (let i = from; i < to; i++) {
    const t = tokens[i]!;
    const gap = text.slice(i === from ? t.start : tokens[i - 1]!.end, t.start);
    items.push(
      <Fragment key={t.start}>
        {gap.includes("\n") ? <span className="ctx-break" /> : gap}
        <button
          type="button"
          ref={i === index ? currentRef : undefined}
          className={i === index ? "ctx-token is-current" : "ctx-token"}
          aria-current={i === index ? "true" : undefined}
          onClick={() => onPick(i)}
        >
          {text.slice(t.start, t.end)}
        </button>
      </Fragment>,
    );
  }

  return (
    <div className="ctx">
      <p className="ctx-hint">
        {finished ? "最後まで読みました · Space で最初から" : "停止中 · 語を選ぶとその位置から再開"}
      </p>
      <p className="ctx-text">{items}</p>
    </div>
  );
}
