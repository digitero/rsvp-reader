import { expect, it } from "vitest";
import { orpIndex } from "./orp";

it.each([
  ["", 0],
  ["猫", 0],
  ["吾輩は", 1],
  ["表示時間を", 2],
  ["recognition", 3],
  ["「文節」に", 2],
  ['"Hi"', 2],
])("orpIndex(%j) = %i", (word, expected) => {
  expect(orpIndex(word)).toBe(expected);
});
