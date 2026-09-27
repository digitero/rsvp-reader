import type { Lang, Token } from "../types";
import { IntlSegmenter } from "./intlSegmenter";
import type { SegmentRequest, SegmentResponse } from "./segment.worker";

/** これより短い文章はその場で分割する（Worker の起動より速い） */
export const WORKER_THRESHOLD = 20_000;

const local = new IntlSegmenter();
let worker: Worker | null | undefined;
let seq = 0;
interface Pending {
  request: SegmentRequest;
  resolve: (tokens: Token[]) => void;
}
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./segment.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<SegmentResponse>) => {
      pending.get(e.data.id)?.resolve(e.data.tokens);
      pending.delete(e.data.id);
    };
    worker.onerror = () => {
      // Worker が使えなくなったら、待っている分も含めてその場で分割に切り替える
      worker?.terminate();
      worker = null;
      for (const { request, resolve } of pending.values()) {
        resolve(local.segmentSync(request.text, request.lang, { chunkMax: request.chunkMax }));
      }
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * 長い文章は Web Worker で分割し、画面が固まらないようにする。
 * Worker が使えない環境ではその場で分割する。
 */
export function segmentAsync(text: string, lang: Lang, chunkMax: number): Promise<Token[]> {
  const w = text.length >= WORKER_THRESHOLD ? getWorker() : null;
  if (!w) return Promise.resolve(local.segmentSync(text, lang, { chunkMax }));
  return new Promise((resolve) => {
    const request: SegmentRequest = { id: ++seq, text, lang, chunkMax };
    pending.set(request.id, { request, resolve });
    w.postMessage(request);
  });
}
