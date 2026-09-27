import { describe, expect, it } from "vitest";
import { tokenUnits } from "./useReadingStats";

describe("tokenUnits", () => {
  const tok = (start: number, end: number) => ({ start, end, orp: 0, pause: 0 as const, weight: 1 });
  it("日本語は空白以外の文字数", () => {
    expect(tokenUnits("吾輩は 猫", tok(0, 5), "ja")).toBe(4);
  });
  it("英語は語数（2語まとめなら2）", () => {
    expect(tokenUnits("The quick fox", tok(0, 9), "en")).toBe(2);
  });
});
