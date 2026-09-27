import { expect, it } from "vitest";
import { detectLang } from "./detectLang";
import { normalize } from "./normalize";

it("normalize は改行コードと余分な空行・行末空白をそろえる", () => {
  expect(normalize("  一行目　\r\n\r\n\r\n\r\n二行目 x\r三行目 \n")).toBe("一行目\n\n二行目 x\n三行目");
});

it.each([
  ["吾輩は猫である。", "ja"],
  ["RSVPはRapid Serial Visual Presentationの略です。", "ja"],
  ["The quick brown fox jumps over the lazy dog.", "en"],
  ["", "en"],
])("detectLang(%j) = %s", (text, lang) => {
  expect(detectLang(text)).toBe(lang);
});
