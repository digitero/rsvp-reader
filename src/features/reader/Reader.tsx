import { useEffect, useMemo, useRef, type PointerEvent, type ReactNode } from "react";
import {
  cumulativeMs,
  DEFAULT_CHUNK_MAX,
  IntlSegmenter,
  SPEED_RANGE,
  type Lang,
  type TimingOptions,
} from "../../core";
import { ContextView } from "./ContextView";
import { Controls } from "./Controls";
import { usePlayer } from "./usePlayer";
import { useReaderKeys } from "./useReaderKeys";
import { WordDisplay } from "./WordDisplay";
import "./reader.css";

const segmenter = new IntlSegmenter();
/** これ以上横に動かしたら、タップではなく左右スワイプとみなす */
const SWIPE_PX = 48;

export interface ReaderProps {
  title: string;
  /** normalize 済みの本文 */
  text: string;
  lang: Lang;
  speed: number;
  onSpeedChange: (speed: number) => void;
  /** 保存しておいた読書位置（文字オフセット） */
  initialOffset?: number;
  /** 停止したときに現在の文字オフセットを通知する */
  onProgress?: (offset: number) => void;
  onClose?: () => void;
  /** 上部バーの右側に置く操作 */
  actions?: ReactNode;
}

export function Reader(props: ReaderProps) {
  const { text, lang, speed, onSpeedChange, onProgress, onClose } = props;
  const tokens = useMemo(
    () => segmenter.segmentSync(text, lang, { chunkMax: DEFAULT_CHUNK_MAX }),
    [text, lang],
  );
  const timing = useMemo<TimingOptions>(() => ({ lang, speed }), [lang, speed]);
  const timeline = useMemo(() => cumulativeMs(tokens, timing), [tokens, timing]);
  const [player, state] = usePlayer(tokens, timing);

  useEffect(() => {
    // 本文が変わったときだけ保存位置へ移動する（initialOffset の更新では動かさない）
    if (props.initialOffset) player.seekToOffset(props.initialOffset);
  }, [player, tokens]);

  // 停止したら位置を知らせる
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !state.playing) onProgress?.(player.currentOffset());
    wasPlaying.current = state.playing;
  }, [state.playing, player, onProgress]);

  // タブが裏に回ったら止める
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) player.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [player]);

  const range = SPEED_RANGE[lang];
  const setSpeed = (v: number) => onSpeedChange(Math.min(Math.max(v, range.min), range.max));

  const keyHandlers = useMemo(
    () => ({
      toggle: () => player.toggle(),
      prev: () => player.prevSentence(),
      next: () => player.nextSentence(),
      faster: () => onSpeedChange(Math.min(speed + range.step, range.max)),
      slower: () => onSpeedChange(Math.max(speed - range.step, range.min)),
      close: onClose,
    }),
    [player, speed, range, onSpeedChange, onClose],
  );
  useReaderKeys(keyHandlers);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // マウスのドラッグは文脈表示での文字選択に使うので、スワイプはタッチとペンだけ
    if (e.pointerType !== "mouse" && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) player.prevSentence();
      else player.nextSentence();
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      // 文脈表示の語はそれ自身のクリックで再開する
      if (!(e.target as HTMLElement).closest(".ctx-token")) player.toggle();
    }
  };

  const total = timeline[tokens.length] ?? 0;
  const remaining = total - (timeline[state.index] ?? 0);
  const showContext = !state.playing && tokens.length > 0;

  return (
    <div className="reader">
      <header className="reader-bar">
        <span className="reader-title">{props.title}</span>
        <span className="reader-meta">
          {lang} · {tokens.length.toLocaleString()} 語
        </span>
        {props.actions}
      </header>

      <div
        className="stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        role="application"
        aria-label="リーダー。Space で再生と停止、左右の矢印キーで一文ずつ移動"
      >
        <div className="guide guide-top" />
        <div className="guide guide-bottom" />
        <WordDisplay text={text} token={tokens[state.index]} />
        {showContext && (
          <ContextView
            text={text}
            tokens={tokens}
            index={state.index}
            finished={state.finished}
            onPick={(i) => {
              player.seek(i);
              player.play();
            }}
          />
        )}
      </div>

      <Controls
        lang={lang}
        index={state.index}
        count={tokens.length}
        remainingMs={remaining}
        playing={state.playing}
        speed={speed}
        onToggle={() => player.toggle()}
        onPrev={() => player.prevSentence()}
        onNext={() => player.nextSentence()}
        onSeek={(i) => player.seek(i)}
        onSpeed={setSpeed}
      />
    </div>
  );
}
