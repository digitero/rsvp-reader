import { useCallback, useEffect, useState } from "react";

export type Route = { name: "library" } | { name: "read"; id: string };

interface HistoryState {
  fromLibrary?: boolean;
}

function parse(hash: string): Route {
  const m = /^#\/read\/([\w-]+)$/.exec(hash);
  return m ? { name: "read", id: m[1]! } : { name: "library" };
}

/**
 * `#/read/<id>` とライブラリの2画面だけのルーティング。
 * 一覧から開いた文書を閉じるときは履歴を1つ戻すので、ブラウザの戻る・進むと食い違わない。
 */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState(() => parse(location.hash));

  useEffect(() => {
    const sync = () => setRoute(parse(location.hash));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const navigate = useCallback((next: Route) => {
    if (next.name === "read") {
      history.pushState({ fromLibrary: true } satisfies HistoryState, "", `#/read/${next.id}`);
      setRoute(next);
      return;
    }
    if ((history.state as HistoryState | null)?.fromLibrary) {
      history.back(); // popstate で route が更新される
    } else {
      // URL を直接開いた場合は戻る先がないので、履歴を置き換えて一覧を出す
      history.replaceState(null, "", location.pathname + location.search);
      setRoute(next);
    }
  }, []);

  return [route, navigate];
}
