import { useCallback, useState } from "react";
import { DEFAULT_SPEED, detectLang, normalize, type Lang } from "./core";
import { Reader } from "./features/reader/Reader";
import "./styles/global.css";
import "./App.css";

const SAMPLE = normalize(`文章を速く読むための方法はいくつもある。RSVPはその一つで、画面の同じ場所に言葉を次々と表示していく。目を左右に動かす必要がないため、視線の移動にかかる時間を減らせる。

ただし、速ければ良いわけではない。内容が頭に残らなければ意味がないからだ。このアプリでは、句読点で少し止まり、長い語はゆっくり見せる。見失ったときは止めれば、前後の文がすぐに表示される。

日本語には単語の間に空白がない。そこでブラウザ標準のIntl.Segmenterで語を切り出し、助詞などを前の語にまとめて「文節」に近いかたまりにしている。`);

interface Doc {
  title: string;
  text: string;
  lang: Lang;
}

/** M3 でライブラリ画面に置き換えるまでの仮の画面。サンプル文と貼り付けだけを扱う */
export function App() {
  const [doc, setDoc] = useState<Doc>({ title: "サンプル：速く読むということ", text: SAMPLE, lang: "ja" });
  const [speeds, setSpeeds] = useState<Record<Lang, number>>(DEFAULT_SPEED);
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState("");

  const onSpeedChange = useCallback(
    (speed: number) => setSpeeds((s) => ({ ...s, [doc.lang]: speed })),
    [doc.lang],
  );

  const load = () => {
    const text = normalize(draft);
    if (!text) return;
    const firstLine = text.split("\n", 1)[0]!;
    setDoc({
      title: firstLine.length > 30 ? `${firstLine.slice(0, 30)}…` : firstLine,
      text,
      lang: detectLang(text),
    });
    setDraft("");
    setPasting(false);
  };

  return (
    <>
      <Reader
        key={doc.text}
        title={doc.title}
        text={doc.text}
        lang={doc.lang}
        speed={speeds[doc.lang]}
        onSpeedChange={onSpeedChange}
        actions={
          <button type="button" className="bar-button" onClick={() => setPasting(true)}>
            文章を貼り付け
          </button>
        }
      />
      {pasting && (
        <div className="sheet-backdrop" onClick={() => setPasting(false)}>
          <form
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <label htmlFor="paste-text" className="sheet-title">
              読みたい文章を貼り付け
            </label>
            <textarea
              id="paste-text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setPasting(false);
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) load();
              }}
              placeholder="日本語または英語の文章"
            />
            <div className="sheet-actions">
              <span className="sheet-note">⌘+Enter で読み始める</span>
              <button type="button" className="btn-ghost" onClick={() => setPasting(false)}>
                キャンセル
              </button>
              <button type="submit" className="btn-primary" disabled={!draft.trim()}>
                読み始める
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
