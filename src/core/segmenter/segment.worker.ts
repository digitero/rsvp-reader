/// <reference lib="webworker" />
import type { Lang, Token } from "../types";
import { IntlSegmenter } from "./intlSegmenter";

export interface SegmentRequest {
  id: number;
  text: string;
  lang: Lang;
  chunkMax: number;
}

export interface SegmentResponse {
  id: number;
  tokens: Token[];
}

const segmenter = new IntlSegmenter();

self.onmessage = (e: MessageEvent<SegmentRequest>) => {
  const { id, text, lang, chunkMax } = e.data;
  const tokens = segmenter.segmentSync(text, lang, { chunkMax });
  self.postMessage({ id, tokens } satisfies SegmentResponse);
};
