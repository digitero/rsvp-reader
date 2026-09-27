import { indexAtOffset, nextSentenceStart, prevSentenceStart, sentenceStart } from "./sentence";
import { RAMP_TOKENS, tokenDelay, type TimingOptions } from "./timing";
import type { Token } from "./types";

/** 時刻とフレーム要求を差し替え可能にして、テストで時間を進められるようにする */
export interface Scheduler {
  now(): number;
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

export const rafScheduler: Scheduler = {
  now: () => performance.now(),
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export interface PlayerState {
  index: number;
  playing: boolean;
  /** 最後のトークンまで表示し終えた */
  finished: boolean;
}

type Listener = (state: PlayerState) => void;

/**
 * トークン列を時間に沿って進める。React に依存しない。
 * 表示の切り替えは `subscribe` で受け取った index を使って描画側が行う。
 */
export class Player {
  private tokens: readonly Token[];
  private timing: TimingOptions;
  private readonly scheduler: Scheduler;
  private state: PlayerState = { index: 0, playing: false, finished: false };
  private listeners = new Set<Listener>();
  private frame: number | null = null;
  private nextAt = 0;
  private rampLeft = 0;

  constructor(tokens: readonly Token[], timing: TimingOptions, scheduler: Scheduler = rafScheduler) {
    this.tokens = tokens;
    this.timing = timing;
    this.scheduler = scheduler;
  }

  getState(): PlayerState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(): void {
    if (this.tokens.length === 0 || this.state.playing) return;
    const index = this.state.finished ? 0 : this.state.index;
    this.rampLeft = RAMP_TOKENS;
    this.update({ index, playing: true, finished: false });
    this.scheduleCurrent();
    this.loop();
  }

  pause(): void {
    if (!this.state.playing) return;
    this.stopLoop();
    this.update({ ...this.state, playing: false });
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  /** 指定したトークンへ移動する。再生中なら少しゆっくり再開する */
  seek(index: number): void {
    const i = Math.min(Math.max(index, 0), Math.max(this.tokens.length - 1, 0));
    this.update({ ...this.state, index: i, finished: false });
    if (this.state.playing) {
      this.rampLeft = RAMP_TOKENS;
      this.scheduleCurrent();
    }
  }

  /** 文字オフセットを含む文の先頭へ移動する（保存位置からの再開用） */
  seekToOffset(offset: number): void {
    this.seek(sentenceStart(this.tokens, indexAtOffset(this.tokens, offset)));
  }

  prevSentence(): void {
    this.seek(prevSentenceStart(this.tokens, this.state.index));
  }

  nextSentence(): void {
    this.seek(nextSentenceStart(this.tokens, this.state.index));
  }

  /** 速度などの変更。次のトークンから反映する */
  setTiming(timing: TimingOptions): void {
    this.timing = timing;
  }

  /**
   * トークン列を差し替える（表示単位の変更など）。同じ本文なら、いま表示している位置を保つ。
   * 再生中なら止める。
   */
  setTokens(tokens: readonly Token[], keepPosition = true): void {
    if (tokens === this.tokens) return;
    const offset = this.currentOffset();
    this.stopLoop();
    this.tokens = tokens;
    const index = keepPosition && tokens.length > 0 ? indexAtOffset(tokens, offset) : 0;
    this.update({ index, playing: false, finished: false });
  }

  /** 現在のトークンの原文オフセット（保存用） */
  currentOffset(): number {
    return this.tokens[this.state.index]?.start ?? 0;
  }

  destroy(): void {
    this.stopLoop();
    this.listeners.clear();
  }

  private scheduleCurrent(): void {
    const token = this.tokens[this.state.index];
    if (!token) return;
    this.nextAt = this.scheduler.now() + tokenDelay(token, this.timing, this.rampLeft);
  }

  private loop(): void {
    this.frame = this.scheduler.request((now) => this.tick(now));
  }

  private tick(now: number): void {
    this.frame = null;
    if (!this.state.playing) return;
    if (now >= this.nextAt) {
      const next = this.state.index + 1;
      if (next >= this.tokens.length) {
        this.update({ index: this.state.index, playing: false, finished: true });
        return;
      }
      if (this.rampLeft > 0) this.rampLeft--;
      this.update({ ...this.state, index: next });
      // 描画の遅れで表示時間が累積してずれないよう、予定時刻を基準に次を決める
      const token = this.tokens[next]!;
      this.nextAt = Math.max(this.nextAt, now - 50) + tokenDelay(token, this.timing, this.rampLeft);
    }
    this.loop();
  }

  private stopLoop(): void {
    if (this.frame !== null) this.scheduler.cancel(this.frame);
    this.frame = null;
  }

  private update(next: PlayerState): void {
    this.state = next;
    for (const l of this.listeners) l(next);
  }
}
