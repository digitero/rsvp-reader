import { useEffect, useRef, useState, type DragEvent } from "react";
import type { Lang } from "../../core";
import { SAMPLE } from "../../sample";
import { ACCEPTED_FILES, fromFile, fromPaste, ImportError, type ImportedText } from "../../source/importText";
import { estimateMinutesLeft, progressRatio, type DocMeta } from "../../storage/library";
import "./library.css";

interface Props {
  docs: DocMeta[];
  speed: Record<Lang, number>;
  onAdd: (docs: ImportedText[], open: boolean) => Promise<void>;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onOpenSettings: () => void;
}

const dateFormat = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" });

export function LibraryView({ docs, speed, onAdd, onOpen, onRemove, onOpenSettings }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const submitPaste = async () => {
    try {
      await onAdd([fromPaste(draft)], true);
      setDraft("");
      setError(null);
    } catch (e) {
      setError(e instanceof ImportError ? e.message : "保存できませんでした。もう一度お試しください。");
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const imported: ImportedText[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        imported.push(fromFile(file.name, await file.arrayBuffer()));
      } catch (e) {
        errors.push(e instanceof ImportError ? e.message : `「${file.name}」を読み込めませんでした。`);
      }
    }
    if (imported.length > 0) {
      try {
        await onAdd(imported, false);
      } catch {
        errors.push("ライブラリに保存できませんでした。もう一度お試しください。");
        imported.length = 0;
      }
    }
    setError(errors.length ? errors.join("\n") : null);
    if (imported.length === 0) return;
    setNotice(imported.length === 1 ? `「${imported[0]!.title}」を追加しました` : `${imported.length}件を追加しました`);
  };

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className="library"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current = Math.max(dragDepth.current - 1, 0);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        void addFiles(e.dataTransfer.files);
      }}
    >
      <header className="library-head">
        <div>
          <h1>RSVP Reader</h1>
          <p>文章を1かたまりずつ画面中央に表示して読む</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onOpenSettings}>
          表示設定
        </button>
      </header>

      <form
        className="intake"
        onSubmit={(e) => {
          e.preventDefault();
          void submitPaste();
        }}
      >
        <label htmlFor="intake-text" className="visually-hidden">
          読みたい文章
        </label>
        <textarea
          id="intake-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submitPaste();
          }}
          placeholder="ここに文章を貼り付け、または .txt / .md ファイルをドロップ"
          rows={draft ? 8 : 3}
        />
        <div className="intake-actions">
          <button type="button" className="btn-ghost" onClick={() => fileInput.current?.click()}>
            ファイルを選ぶ
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_FILES}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="intake-note">{draft ? `${draft.trim().length.toLocaleString()}字 · ⌘+Enter` : ""}</span>
          <button type="submit" className="btn-primary" disabled={!draft.trim()}>
            読み始める
          </button>
        </div>
        {error && (
          <p className="intake-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="intake-notice" role="status">
            {notice}
          </p>
        )}
      </form>

      <section className="shelf" aria-labelledby="shelf-title">
        <h2 id="shelf-title">
          ライブラリ <span>{docs.length}件</span>
        </h2>
        {docs.length === 0 ? (
          <div className="shelf-empty">
            <p>まだ文書がありません。上の欄に文章を貼り付けるか、ファイルを追加してください。</p>
            <button type="button" className="btn-ghost" onClick={() => void onAdd([SAMPLE], true)}>
              サンプルを読む
            </button>
          </div>
        ) : (
          <ul className="shelf-list">
            {docs.map((d) => (
              <DocRow key={d.id} doc={d} speed={speed[d.lang]} onOpen={onOpen} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </section>

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          ドロップしてライブラリに追加
        </div>
      )}
    </div>
  );
}

interface RowProps {
  doc: DocMeta;
  speed: number;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

function DocRow({ doc, speed, onOpen, onRemove }: RowProps) {
  const [confirming, setConfirming] = useState(false);
  const ratio = progressRatio(doc);
  const percent = Math.floor(ratio * 100);
  const minutes = Math.max(Math.ceil(estimateMinutesLeft(doc, speed)), 1);
  const status = doc.finished
    ? "読了"
    : doc.lastReadAt === null
      ? `未読 · 約${minutes}分`
      : `${percent}% · 残り約${minutes}分`;

  return (
    <li className="doc">
      <button type="button" className="doc-open" onClick={() => onOpen(doc.id)}>
        <span className="doc-title">{doc.title}</span>
        <span className="doc-meta">
          <span className="doc-lang">{doc.lang}</span>
          <span className="meter" aria-hidden="true">
            <i style={{ width: `${ratio * 100}%` }} />
          </span>
          <span>{status}</span>
          <span className="doc-date">{dateFormat.format(doc.lastReadAt ?? doc.createdAt)}</span>
        </span>
      </button>
      {confirming ? (
        <span className="doc-confirm">
          <span>削除しますか？</span>
          <button type="button" className="btn-danger" onClick={() => onRemove(doc.id)}>
            削除
          </button>
          <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
            やめる
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="doc-remove"
          onClick={() => setConfirming(true)}
          aria-label={`「${doc.title}」を削除`}
        >
          削除
        </button>
      )}
    </li>
  );
}
