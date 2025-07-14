# GitHub Actions デプロイ設定

このワークフローは、mainブランチへのプッシュ時に自動的にGitHub Pagesにデプロイします。

## セットアップ手順

1. **GitHub Pagesを有効化**
   - リポジトリの Settings > Pages に移動
   - Source を "GitHub Actions" に設定

2. **環境変数（オプション）**
   - APIキーはクライアントサイドで使用されるため、GitHub Secretsには保存しません
   - ユーザーが自分のAPIキーを設定画面から入力します

## ビルド設定

- Node.js 20を使用
- `npm ci`で依存関係をインストール
- `npm run build`でビルド
- `dist`ディレクトリをGitHub Pagesにデプロイ

## URL

デプロイ後のURLは以下のようになります：
```
https://[username].github.io/NovelDrive/
```

## 注意事項

- APIキーは各ユーザーのブラウザのLocalStorageに保存されます
- デプロイ環境にAPIキーを含めないでください