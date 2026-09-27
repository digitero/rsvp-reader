import { useCallback, useEffect, useState } from "react";
import type { Lang } from "./core";
import { LibraryView } from "./features/library/LibraryView";
import { Reader } from "./features/reader/Reader";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import type { ImportedText } from "./source/importText";
import { Library, type DocMeta } from "./storage/library";
import { loadSettings, saveSettings, type Settings } from "./storage/settings";
import { useHashRoute } from "./useHashRoute";
import "./styles/global.css";
import "./App.css";

type LibraryState =
  | { status: "loading" }
  | { status: "ready"; lib: Library; docs: DocMeta[] }
  | { status: "error" };

export function App() {
  const [state, setState] = useState<LibraryState>({ status: "loading" });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [route, navigate] = useHashRoute();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readingLang, setReadingLang] = useState<Lang | null>(null);

  useEffect(() => {
    let lib: Library | undefined;
    let cancelled = false;
    Library.open()
      .then(async (opened) => {
        // 開く前にアンマウントされていたら（StrictMode の再実行など）すぐ閉じる
        if (cancelled) return opened.close();
        lib = opened;
        const docs = await opened.list();
        if (!cancelled) setState({ status: "ready", lib: opened, docs });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
      lib?.close();
    };
  }, []);

  useEffect(() => saveSettings(settings), [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  // 画面を移ったら設定シートは閉じる
  useEffect(() => setSettingsOpen(false), [route]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // ライブラリ以外（リーダー画面）にファイルを落としても、ブラウザがそのファイルに移動しないようにする
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const lib = state.status === "ready" ? state.lib : null;

  const refresh = useCallback(async () => {
    if (!lib) return;
    const docs = await lib.list();
    setState((s) => (s.status === "ready" ? { ...s, docs } : s));
  }, [lib]);

  const onAdd = useCallback(
    async (docs: ImportedText[], open: boolean) => {
      if (!lib) return;
      let last: DocMeta | undefined;
      for (const d of docs) last = await lib.add(d);
      await refresh();
      if (open && last) navigate({ name: "read", id: last.id });
    },
    [lib, refresh, navigate],
  );

  const onRemove = useCallback(
    async (id: string) => {
      await lib?.remove(id);
      await refresh();
    },
    [lib, refresh],
  );

  const onSpeedChange = useCallback(
    (lang: Lang, speed: number) => setSettings((s) => ({ ...s, speed: { ...s.speed, [lang]: speed } })),
    [],
  );

  if (state.status === "loading") return null;
  if (state.status === "error") {
    return (
      <p className="app-message">
        文書を保存する領域（IndexedDB）を開けませんでした。プライベートブラウズを解除するか、別のブラウザでお試しください。
      </p>
    );
  }

  const sheet = settingsOpen && (
    <SettingsSheet
      settings={settings}
      lang={route.name === "read" ? (readingLang ?? "ja") : "ja"}
      onChange={setSettings}
      onClose={closeSettings}
    />
  );

  if (route.name === "read") {
    return (
      <>
        <ReaderRoute
          key={route.id}
          lib={state.lib}
          id={route.id}
          settings={settings}
          settingsOpen={settingsOpen}
          onOpenSettings={openSettings}
          onLang={setReadingLang}
          onSpeedChange={onSpeedChange}
          onSaved={refresh}
          onClose={() => navigate({ name: "library" })}
        />
        {sheet}
      </>
    );
  }

  return (
    <>
      <LibraryView
        docs={state.docs}
        speed={settings.speed}
        onAdd={onAdd}
        onOpen={(id) => navigate({ name: "read", id })}
        onRemove={(id) => void onRemove(id)}
        onOpenSettings={openSettings}
      />
      {sheet}
    </>
  );
}

interface ReaderRouteProps {
  lib: Library;
  id: string;
  settings: Settings;
  settingsOpen: boolean;
  onOpenSettings: () => void;
  onLang: (lang: Lang) => void;
  onSpeedChange: (lang: Lang, speed: number) => void;
  onSaved: () => void;
  onClose: () => void;
}

function ReaderRoute(props: ReaderRouteProps) {
  const { lib, id, settings, onSpeedChange, onSaved, onClose, onLang } = props;
  const [doc, setDoc] = useState<{ meta: DocMeta; text: string } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void lib.get(id).then((d) => {
      if (!cancelled) setDoc(d ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [lib, id]);

  const lang = doc?.meta.lang ?? "ja";
  useEffect(() => onLang(lang), [lang, onLang]);
  const onSpeed = useCallback((speed: number) => onSpeedChange(lang, speed), [onSpeedChange, lang]);
  const onProgress = useCallback(
    (offset: number, finished: boolean) => {
      // 画面を閉じる途中で DB が閉じられていても、読書位置の保存失敗で操作を止めない
      lib.saveProgress(id, offset, finished).then(onSaved, () => {});
    },
    [lib, id, onSaved],
  );

  if (doc === undefined) return null;
  if (doc === null) {
    return (
      <div className="app-message">
        <p>この文書は見つかりませんでした。削除された可能性があります。</p>
        <button type="button" className="btn-ghost" onClick={onClose}>
          ライブラリに戻る
        </button>
      </div>
    );
  }

  return (
    <Reader
      title={doc.meta.title}
      text={doc.text}
      lang={doc.meta.lang}
      speed={settings.speed[doc.meta.lang]}
      onSpeedChange={onSpeed}
      initialOffset={doc.meta.finished ? 0 : doc.meta.offset}
      onProgress={onProgress}
      onClose={onClose}
      display={settings}
      settingsOpen={props.settingsOpen}
      onOpenSettings={props.onOpenSettings}
    />
  );
}
