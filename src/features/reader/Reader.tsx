import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  cumulativeMs,
  groupTokens,
  indexAtOffset,
  SPEED_RANGE,
  type Lang,
  type TimingOptions,
  type Token,
} from "../../core";
import type { Heading } from "../../source/headings";
import type { Settings } from "../../storage/settings";
import { ContextView } from "./ContextView";
import { Controls } from "./Controls";
import { usePlayer } from "./usePlayer";
import { TocSheet } from "./TocSheet";
import { useReaderKeys } from "./useReaderKeys";
import { WordDisplay } from "./WordDisplay";
import "./reader.css";

/** これ以上横に動かしたら、タップではなく左右スワイプとみなす */
const SWIPE_PX = 48;
/** 2文節（2語）まとめで、これより長くなるならまとめない */
const GROUP_MAX_LENGTH: Record<Lang, number> = { ja: 10, en: 18 };
/** 再生中に読書位置を保存する間隔 */
const SAVE_INTERVAL_MS = 5000;

export interface ReaderProps {
  title: string;
  /** normalize 済みの本文 */
  text: string;
  lang: Lang;
  /** 本文を分割したトークン（表示単位でまとめる前） */
  baseTokens: readonly Token[];
  /** 目次。空なら目次ボタンを出さない */
  headings?: readonly Heading[];
  speed: number;
  onSpeedChange: (speed: number) => void;
  /** 保存しておいた読書位置（文字オフセット） */
  initialOffset?: number;
  /** 停止・読了・画面を離れたとき、および再生中は一定間隔で読書位置を通知する */
  onProgress?: (offset: number, finished: boolean) => void;
  onClose?: () => void;
  /** 表示単位・書体・文字サイズ・強調色・句読点での停止 */
  display: Pick<Settings, "group" | "font" | "size" | "accent" | "pause">;
  /** 表示設定シートが開いている間は再生を止め、キー操作を受け付けない */
  settingsOpen?: boolean;
  onOpenSettings?: () => void;
  /** 上部バーの右側に置く操作 */
  actions?: ReactNode;
}

export function Reader(props: ReaderProps) {
  const { text, lang, speed, onSpeedChange, onProgress, onClose, display, baseTokens } = props;
  const headings = props.headings ?? [];
  const [tocOpen, setTocOpen] = useState(false);
  // 設定や目次のシートが開いている間は、再生を止めてリーダーのキー操作を受け付けない
  const settingsOpen = props.settingsOpen ?? false;
  const sheetOpen = settingsOpen || tocOpen;
  const tokens = useMemo(
    () => groupTokens(baseTokens, text, display.group, GROUP_MAX_LENGTH[lang]),
    [baseTokens, text, display.group, lang],
  );
  const timing = useMemo<TimingOptions>(
    () => ({ lang, speed, pauseScale: display.pause }),
    [lang, speed, display.pause],
  );
  const timeline = useMemo(() => cumulativeMs(tokens, timing), [tokens, timing]);
  const [player, state] = usePlayer(tokens, timing);

  // 開いたときに一度だけ保存位置へ移動する。表示単位を変えたときの位置は Player が保つ
  useEffect(() => {
    if (props.initialOffset) player.seekToOffset(props.initialOffset);
  }, [player]);

  useEffect(() => {
    if (sheetOpen) player.pause();
  }, [sheetOpen, player]);

  const closeToc = useCallback(() => setTocOpen(false), []);
  const currentOffset = tokens[state.index]?.start ?? 0;
  let chapter = -1;
  for (let i = 0; i < headings.length && headings[i]!.offset <= currentOffset; i++) chapter = i;

  // 再生中は画面が消えないようにする（対応していない環境では何もしない）
  useEffect(() => {
    if (!state.playing || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let released = false;
    navigator.wakeLock
      .request("screen")
      .then((s) => {
        if (released) void s.release();
        else sentinel = s;
      })
      .catch(() => {});
    return () => {
      released = true;
      void sentinel?.release();
    };
  }, [state.playing]);

  // 読書位置の保存。最新の onProgress を ref 経由で呼び、購読を張り直さない
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  useEffect(() => {
    const report = () => {
      const { finished } = player.getState();
      progressRef.current?.(player.currentOffset(), finished);
    };
    // 開いて閉じただけなら保存しない（読了した文書が 0% に戻ったり、文の途中の位置が文頭に巻き戻ったりしないように）。
    // 保存位置への初期移動はこの購読より前に済んでいるので数えない
    let touched = false;
    const reportIfTouched = () => {
      if (touched) report();
    };
    let wasPlaying = player.getState().playing;
    let lastTokens = tokensRef.current;
    const unsubscribe = player.subscribe((s) => {
      // 表示単位の変更によるトークン列の差し替えは、読んだことに数えない
      if (tokensRef.current !== lastTokens) {
        lastTokens = tokensRef.current;
        wasPlaying = s.playing;
        return;
      }
      touched = true;
      if (wasPlaying && !s.playing) report();
      wasPlaying = s.playing;
    });
    const timer = setInterval(() => {
      if (player.getState().playing) report();
    }, SAVE_INTERVAL_MS);
    window.addEventListener("pagehide", reportIfTouched);
    return () => {
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("pagehide", reportIfTouched);
      reportIfTouched();
    };
  }, [player]);

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
  useReaderKeys(keyHandlers, !sheetOpen);

  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || sheetOpen) return;
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
  // 設定中は文脈表示を隠し、書体や強調色の変化を表示語で確かめられるようにする
  const showContext = !state.playing && !sheetOpen && tokens.length > 0;

  return (
    <div
      className="reader"
      data-font={display.font}
      data-size={display.size}
      data-accent={display.accent}
    >
      <header className="reader-bar">
        {onClose && (
          <button type="button" className="reader-back" onClick={onClose} title="ライブラリに戻る (Esc)">
            ← ライブラリ
          </button>
        )}
        <span className="reader-title">{props.title}</span>
        <span className="reader-meta">
          {lang} · {tokens.length.toLocaleString()} 語
        </span>
        {headings.length > 0 && (
          <button type="button" className="bar-button" onClick={() => setTocOpen(true)}>
            目次
          </button>
        )}
        {props.onOpenSettings && (
          <button type="button" className="bar-button" onClick={props.onOpenSettings}>
            表示設定
          </button>
        )}
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
        chapter={chapter >= 0 ? headings[chapter]!.title : undefined}
      />
      {tocOpen && (
        <TocSheet
          headings={headings}
          current={chapter}
          onPick={(h) => {
            player.seek(indexAtOffset(tokens, h.offset));
            setTocOpen(false);
          }}
          onClose={closeToc}
        />
      )}
    </div>
  );
}
