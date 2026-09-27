# RSVP Reader

文章を1かたまりずつ画面中央に表示して読む、RSVP（Rapid Serial Visual Presentation）方式の読書アプリです。日本語と英語に対応しています。

**公開版:** https://digitero.github.io/rsvp-reader/

## 主な機能

- 日本語はブラウザ標準の `Intl.Segmenter` で語を切り出し、助詞などを前の語にまとめて文節に近い単位で表示
- 強調文字（ORP）を中心線に固定。句読点で少し止まり、長いかたまりはゆっくり表示
- 停止すると前後の文を表示し、語を選んでその位置から再開
- テキストの貼り付け、`.txt` / `.md` の読み込み（Shift_JIS、青空文庫形式に対応）
- 目次と章への移動、読書位置の自動保存
- 表示設定（速度、2文節表示、UDゴシック / UD明朝、テーマ、強調色 など）
- PWA 対応。ホーム画面に追加でき、オフラインでも読める

文書と設定はすべてブラウザ内（IndexedDB / localStorage）に保存され、外部には送信しません。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm test           # 単体テスト（Vitest）
npm run test:e2e   # E2E テスト（Playwright。初回は npx playwright install chromium）
npm run build      # 本番ビルド（GitHub Pages 向けは BASE_PATH=/rsvp-reader/）
```

main ブランチに push すると、GitHub Actions でテストを実行し、GitHub Pages に公開します。
