import { expect, it } from "vitest";
import { DEFAULT_SETTINGS, parseSettings } from "./settings";

it("空や壊れた値は既定値", () => {
  expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
});

it("正しい値はそのまま、不正な値は既定値に置き換える", () => {
  const s = parseSettings({
    speed: { ja: 900, en: "fast" },
    group: 2,
    font: "mincho",
    size: "xl",
    theme: "sepia",
    accent: "none",
    pause: 1.5,
  });
  expect(s).toEqual({
    speed: { ja: 900, en: 300 },
    group: 2,
    font: "mincho",
    size: "m",
    theme: "sepia",
    accent: "none",
    pause: 1.5,
  });
});

it("速度は範囲内に収める", () => {
  expect(parseSettings({ speed: { ja: 99999, en: 1 } }).speed).toEqual({ ja: 1500, en: 150 });
});
