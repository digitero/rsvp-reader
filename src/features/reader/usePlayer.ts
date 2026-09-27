import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Player, type PlayerState, type TimingOptions, type Token } from "../../core";

/** Player を1つ作り、その状態を React に購読させる */
export function usePlayer(tokens: readonly Token[], timing: TimingOptions): [Player, PlayerState] {
  const [player] = useState(() => new Player(tokens, timing));

  useEffect(() => {
    player.setTokens(tokens);
  }, [player, tokens]);

  useEffect(() => {
    player.setTiming(timing);
  }, [player, timing]);

  // 画面を離れたら止める。StrictMode の再実行でも壊れないよう destroy はしない
  useEffect(() => () => player.pause(), [player]);

  const subscribe = useCallback((onChange: () => void) => player.subscribe(onChange), [player]);
  const getState = useCallback(() => player.getState(), [player]);
  const state = useSyncExternalStore(subscribe, getState);
  return [player, state];
}
