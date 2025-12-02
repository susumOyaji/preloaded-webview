# Preloaded WebView (株式ポートフォリオトラッカー)

これは、市場指数、個人のポートフォリオ、およびウォッチリストを追跡するために設計された軽量なWebアプリケーションです。バニラHTML、CSS、JavaScriptで構築されており、Cloudflare Pagesへのデプロイに最適化されています。

## 機能

*   **市場指数**: 主要な市場指数（例：^DJI、USDJPY）をリアルタイムで表示します。
*   **ポートフォリオサマリー**:
    *   現在の株価に基づいて総資産額を計算します。
    *   トータルの評価損益を視覚的なインジケーターで追跡します。
*   **ウォッチリスト**:
    *   銘柄の追加、編集、削除が可能です。
    *   証券会社ごとに銘柄をグループ化して表示します。
    *   現在値、前日比、個別の評価損益を表示します。
*   **ダークモード**: ライトモードとダークモードの切り替えが可能です。
*   **自動更新**: 設定可能な間隔で最新データを自動的に取得します。
*   **レスポンシブデザイン**: デスクトップとモバイルの両方の表示に最適化されています。

## 技術スタック

*   **フロントエンド**: HTML5, CSS3 (Variables, Flexbox/Grid), JavaScript (ES6+).
*   **バックエンド/API**: Cloudflare Workerのエンドポイントからデータを取得します。
*   **デプロイ**: Cloudflare Pages.
*   **ツール**: Wrangler (Cloudflare Developer Platform CLI).

## セットアップとインストール

1.  **リポジトリのクローン**:
    ```bash
    git clone <repository-url>
    cd preloaded-webview
    ```

2.  **依存関係のインストール**:
    ```bash
    npm install
    ```

3.  **ローカルでの実行**:
    Wranglerを使用してローカル開発サーバーを起動します。
    ```bash
    npm run dev
    ```
    アプリは `http://127.0.0.1:8788` で利用可能になります。

## プロジェクト構成

```
preloaded-webview/
├── public/              # Cloudflare Pagesによって配信される静的アセット
│   ├── index.html       # メインHTMLファイル
│   ├── style.css        # グローバルスタイルとテーマ
│   └── script.js        # アプリケーションロジック
├── package.json         # プロジェクトのメタデータとスクリプト
└── README.md            # プロジェクトドキュメント
```

## 設定

*   **APIエンドポイント**: `script.js` で設定されています。デフォルト: `https://preloaded_state.sumitomo0210.workers.dev`.
*   **設定**: ユーザーはUIの設定モーダルから更新間隔とテーマを設定できます。データは `localStorage` に保存されます。

## デプロイ

Cloudflare Pagesへデプロイするには以下のコマンドを実行します:

```bash
npm run deploy
```

## ライセンス

[MIT](LICENSE)
