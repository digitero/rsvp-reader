import { describe, expect, it } from "vitest";
import { indexAtOffset, nextSentenceStart, prevSentenceStart, sentenceStart } from "./sentence";
import type { Pause, Token } from "./types";

// 文: [0,1,2] [3,4] [5]
const pauses: Pause[] = [0, 0.5, 1, 0, 1, 2];
const tokens: Token[] = pauses.map((pause, i) => ({ start: i * 3, end: i * 3 + 2, orp: 0, pause, weight: 1 }));

describe("文の移動", () => {
  it("sentenceStart は読点では区切らない", () => {
    expect(sentenceStart(tokens, 2)).toBe(0);
    expect(sentenceStart(tokens, 4)).toBe(3);
    expect(sentenceStart(tokens, 5)).toBe(5);
  });

  it("nextSentenceStart", () => {
    expect(nextSentenceStart(tokens, 0)).toBe(3);
    expect(nextSentenceStart(tokens, 3)).toBe(5);
    expect(nextSentenceStart(tokens, 5)).toBe(5);
  });

  it("prevSentenceStart は文の途中なら文頭、文頭なら前の文へ", () => {
    expect(prevSentenceStart(tokens, 4)).toBe(3);
    expect(prevSentenceStart(tokens, 3)).toBe(0);
    expect(prevSentenceStart(tokens, 0)).toBe(0);
  });
});

describe("indexAtOffset", () => {
  it.each([
    [0, 0], [1, 0], [2, 1], [3, 1], [7, 2], [17, 5], [99, 5],
  ])("offset %i → %i", (offset, expected) => {
    expect(indexAtOffset(tokens, offset)).toBe(expected);
  });
});
