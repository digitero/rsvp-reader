import { expect, test, type Page } from "@playwright/test";

const playButton = (page: Page) => page.locator(".btn-play");
const isPlaying = async (page: Page) => ((await playButton(page).getAttribute("aria-label")) ?? "").startsWith("停止");

async function openSample(page: Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "サンプルを読む" }).click();
  await expect(page.locator(".reader")).toBeVisible();
}

async function paste(page: Page, text: string) {
  await page.goto("./");
  await page.locator("#intake-text").fill(text);
  await page.getByRole("button", { name: "読み始める" }).click();
  await expect(page.locator(".reader")).toBeVisible();
}

test("サンプルを読み、戻ると進捗が一覧に出る", async ({ page }) => {
  await openSample(page);
  await page.keyboard.press("Space");
  await expect.poll(() => isPlaying(page)).toBe(true);
  await page.waitForTimeout(2500);
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await expect(page.locator(".library")).toBeVisible();
  await expect(page.locator(".doc-meta").first()).toContainText("%");
});

test("Space は常に再生/停止（設定を閉じた直後・一文戻るの直後）", async ({ page, isMobile }) => {
  test.skip(isMobile, "キーボード操作はデスクトップで確認する");
  await openSample(page);

  await page.getByRole("button", { name: "表示設定" }).click();
  await expect(page.locator(".sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".sheet")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator(".sheet")).toHaveCount(0);
  await expect.poll(() => isPlaying(page)).toBe(true);
  await page.keyboard.press("Space");
  await expect.poll(() => isPlaying(page)).toBe(false);

  await page.getByRole("button", { name: /一文進む/ }).click();
  await page.getByRole("button", { name: /一文戻る/ }).click();
  const before = await page.locator(".ctx-token.is-current").textContent();
  await page.keyboard.press("Space");
  await expect.poll(() => isPlaying(page)).toBe(true);
  expect(await page.locator(".word").textContent()).toBe(before);
});

test("開いて閉じただけでは読了や読書位置を上書きしない", async ({ page }) => {
  await paste(page, "One two three four.");
  await playButton(page).click();
  await expect(page.locator(".ctx-hint")).toContainText("最後まで読みました", { timeout: 10_000 });
  await page.locator(".reader-back").click();
  await expect(page.locator(".doc-meta").first()).toContainText("読了");

  await page.locator(".doc-open").first().click();
  await expect(page.locator(".reader")).toBeVisible();
  await page.locator(".reader-back").click();
  await expect(page.locator(".doc-meta").first()).toContainText("読了");
});

test("アプリ内の戻るの後、ブラウザの戻るで文書が開き直さない", async ({ page }) => {
  await openSample(page);
  await page.locator(".reader-back").click();
  await expect(page.locator(".library")).toBeVisible();
  await page.goBack();
  await expect(page.locator(".reader")).toHaveCount(0);
});

test("Markdown を取り込み、目次から章へ移動できる", async ({ page }) => {
  await page.goto("./");
  const body = "本文です。".repeat(40);
  const md = `# 読書メモ\n\n## 第1章 はじめに\n\n${body}\n\n## 第2章 速く読む\n\n${body}\n\n## 第3章 まとめ\n\n${body}`;
  await page.locator('input[type="file"]').setInputFiles({ name: "memo.md", mimeType: "text/markdown", buffer: Buffer.from(md) });
  await expect(page.locator(".intake-notice")).toContainText("読書メモ");
  await page.locator(".doc-open").first().click();

  await page.getByRole("button", { name: "目次" }).click();
  await expect(page.locator(".toc-item")).toHaveText(["読書メモ", "第1章 はじめに", "第2章 速く読む", "第3章 まとめ"]);
  await page.locator(".toc-item", { hasText: "第2章" }).click();
  await expect(page.locator(".status-chapter")).toContainText("第2章 速く読む");
  await expect(page.locator(".ctx-token.is-current")).toHaveText("第2章");
});

test("スマホ幅で横にはみ出さず、強調文字が中心線に揃う", async ({ page, isMobile }) => {
  test.skip(!isMobile, "スマホ幅で確認する");
  await openSample(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(await overflow()).toBe(0);

  await page.locator(".btn-play").click();
  const offsets = await page.evaluate(async () => {
    const stage = document.querySelector(".stage")!.getBoundingClientRect();
    const cx = stage.left + stage.width / 2;
    const out: number[] = [];
    let last = "";
    for (let i = 0; i < 600 && out.length < 12; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const w = document.querySelector(".word")!.textContent ?? "";
      if (w && w !== last) {
        last = w;
        const f = document.querySelector(".word-focus")!.getBoundingClientRect();
        out.push(Math.abs(f.left + f.width / 2 - cx));
      }
    }
    return out;
  });
  expect(offsets.length).toBeGreaterThan(5);
  expect(Math.max(...offsets)).toBeLessThan(1.5);
  expect(await overflow()).toBe(0);
  // 操作ボタン（一文戻る・再生・一文進む・＋しおり）が1行に収まる
  const tops = await page.locator(".buttons > button").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
  expect(new Set(tops).size).toBe(1);

  await page.getByRole("button", { name: "表示設定" }).click();
  const wordBottom = await page.locator(".word").evaluate((e) => e.getBoundingClientRect().bottom);
  const sheetTop = await page.locator(".sheet").evaluate((e) => e.getBoundingClientRect().top);
  expect(wordBottom).toBeLessThan(sheetTop);
});

test("PWA: Service Worker が登録され、オフラインでも開ける", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "1回確認すれば十分");
  await page.goto("./");
  await expect(page.locator(".library")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Service Worker がページを制御するまで待つ
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".library")).toBeVisible();
  await page.getByRole("button", { name: "サンプルを読む" }).click();
  await expect(page.locator(".reader")).toBeVisible();
  await context.setOffline(false);
});

test("しおりを挟み、一覧から戻れる", async ({ page }) => {
  await openSample(page);
  await page.getByRole("button", { name: /一文進む/ }).click();
  const sentenceHead = await page.locator(".ctx-token.is-current").textContent();
  await page.getByRole("button", { name: "＋しおり" }).click();
  await expect(page.locator(".reader-toast")).toHaveText("しおりを挟みました");

  await page.getByRole("button", { name: /一文進む/ }).click();
  await page.getByRole("button", { name: /一文進む/ }).click();
  await page.getByRole("button", { name: "しおり", exact: true }).click();
  await expect(page.locator(".bookmark-open")).toHaveCount(1);
  await page.locator(".bookmark-open").click();
  await expect(page.locator(".ctx-token.is-current")).toHaveText(sentenceHead!);

  // 再読み込みしても残る
  await page.reload();
  await page.getByRole("button", { name: "しおり", exact: true }).click();
  await expect(page.locator(".bookmark-open")).toHaveCount(1);
});

test("読んだ量が「読書の記録」に出る", async ({ page }) => {
  await openSample(page);
  await page.locator(".btn-play").click();
  await page.waitForTimeout(3000);
  await page.locator(".btn-play").click();
  await page.locator(".reader-back").click();
  await expect(page.locator(".stats")).toBeVisible();
  const today = await page.locator(".stats-figures dd").first().textContent();
  expect(Number(today!.replace(/[^\d]/g, ""))).toBeGreaterThan(5);
  await expect(page.locator(".stats-figures")).toContainText("連続1日");
});
