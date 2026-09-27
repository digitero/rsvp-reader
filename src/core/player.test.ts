import { beforeEach, describe, expect, it } from "vitest";
import { Player, type Scheduler } from "./player";
import { RAMP_TOKENS, tokenDelay, type TimingOptions } from "./timing";
import type { Pause, Token } from "./types";

class FakeScheduler implements Scheduler {
  time = 0;
  private cbs = new Map<number, (now: number) => void>();
  private seq = 0;
  now() { return this.time; }
  request(cb: (now: number) => void) { this.cbs.set(++this.seq, cb); return this.seq; }
  cancel(id: number) { this.cbs.delete(id); }
  /** 16ms ごとにフレームを進める */
  advance(ms: number) {
    const target = this.time + ms;
    while (this.time < target) {
      this.time = Math.min(this.time + 16, target);
      const pending = [...this.cbs.values()];
      this.cbs.clear();
      pending.forEach((cb) => cb(this.time));
    }
  }
}

// 2文字のトークン10個。3番目と7番目で文が終わる
const pauses: Pause[] = [0, 0, 1, 0, 0, 0, 1, 0, 0, 2];
const tokens: Token[] = pauses.map((pause, i) => ({ start: i * 2, end: i * 2 + 2, orp: 1, pause, weight: 1 }));
const timing: TimingOptions = { lang: "ja", speed: 600 };

let clock: FakeScheduler;
let player: Player;
beforeEach(() => {
  clock = new FakeScheduler();
  player = new Player(tokens, timing, clock);
});

describe("Player", () => {
  it("再生すると時間に沿って進み、最後で止まる", () => {
    const seen: number[] = [];
    player.subscribe((s) => seen.push(s.index));
    player.play();
    clock.advance(60_000);
    expect(player.getState()).toEqual({ index: 9, playing: false, finished: true });
    expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("最初のトークンはランプアップぶん長く表示する", () => {
    player.play();
    const first = tokenDelay(tokens[0]!, timing, RAMP_TOKENS);
    clock.advance(first - 20);
    expect(player.getState().index).toBe(0);
    clock.advance(40);
    expect(player.getState().index).toBe(1);
  });

  it("一時停止中は進まない", () => {
    player.play();
    clock.advance(1000);
    player.pause();
    const { index } = player.getState();
    clock.advance(10_000);
    expect(player.getState()).toMatchObject({ index, playing: false });
  });

  it("読了後に play すると先頭から", () => {
    player.play();
    clock.advance(60_000);
    player.play();
    expect(player.getState()).toMatchObject({ index: 0, playing: true, finished: false });
  });

  it("一文戻る・進む", () => {
    player.seek(4);
    player.prevSentence();
    expect(player.getState().index).toBe(3);
    player.prevSentence();
    expect(player.getState().index).toBe(0);
    player.nextSentence();
    expect(player.getState().index).toBe(3);
  });

  it("seekToOffset は保存位置を含む文の先頭から", () => {
    player.seekToOffset(11); // index 5 の途中
    expect(player.getState().index).toBe(3);
    expect(player.currentOffset()).toBe(6);
  });

  it("速度変更は再生中でも反映される", () => {
    player.play();
    clock.advance(2000);
    const before = player.getState().index;
    player.setTiming({ lang: "ja", speed: 1500 });
    clock.advance(2000);
    const fast = player.getState().index - before;
    expect(fast).toBeGreaterThan(3);
  });

  it("空のトークン列では再生しない", () => {
    const empty = new Player([], timing, clock);
    empty.play();
    expect(empty.getState().playing).toBe(false);
  });
});
