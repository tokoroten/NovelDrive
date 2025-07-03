# NovelDrive

NovelDriveは、セレンディピティ付き知識管理システムとマルチエージェント小説創作エンジンを統合した、二層構造の創造的執筆プラットフォームです。人間の創造的記憶と発想プロセスを模倣し、AIとの対話を通じて小説創作を支援します。

## 🌟 特徴

- **二層構造アーキテクチャ**
  - 第1層：創造的知識管理システム（セレンディピティ検索、なんでもボックス）
  - 第2層：マルチエージェント小説創作エンジン

- **セレンディピティ検索**
  - ベクトル類似度検索にノイズを注入し、予期せぬ発見を促進
  - 人間の記憶の曖昧さを再現

- **マルチエージェントシステム**
  - 作家AI、編集AI、校閲AI、副編集長AIが協働
  - 作家AIは編集の意見を「程よく無視」する性格設定

## 📋 要件

- Node.js 20.x以上（Electronとの互換性のため）
- npm 9.x以上
- Windows 10/11、macOS 10.14以上、Ubuntu 20.04以上

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/NovelDrive.git
cd NovelDrive
```

### 2. 依存関係のインストール

現在、依存関係の管理に問題がある場合は、以下のスクリプトを使用してください：

**Linux/WSL:**
```bash
./install-deps.sh
```

**Windows:**
```powershell
# PowerShellで実行
npm install
```

### 3. 開発モードで起動

**Linux/WSL:**
```bash
./run-dev.sh
```

**Windows:**
```powershell
# PowerShellで実行
.\scripts\build-windows.ps1
```

または直接：
```bash
npm start
```

## 🏗️ プロジェクト構造

```
NovelDrive/
├── src/
│   ├── main/              # メインプロセス
│   │   ├── index.js       # アプリケーションエントリーポイント
│   │   ├── preload.js     # プリロードスクリプト
│   │   ├── database.js    # データベース接続（現在はモック実装）
│   │   ├── database/      # データベース関連
│   │   │   ├── schema.sql # SQLスキーマ定義
│   │   │   └── migrate.js # マイグレーションスクリプト
│   │   ├── repositories/  # データアクセス層
│   │   │   ├── base-repository.js
│   │   │   ├── project-repository.js
│   │   │   ├── knowledge-repository.js
│   │   │   └── character-repository.js
│   │   └── utils/         # ユーティリティ
│   │       ├── logger.js  # ロギングシステム
│   │       └── error-handler.js # エラーハンドリング
│   └── renderer/          # レンダラープロセス
│       ├── index.html     # メインHTML
│       └── renderer.js    # レンダラースクリプト
├── docs/                  # ドキュメント
│   └── requirements.md    # 詳細な要求仕様書
├── dev_diary/            # 開発日誌
├── scripts/              # ビルドスクリプト
└── old/                  # 旧コード（gitignore対象）
```

## 🛠️ 技術スタック

- **フレームワーク**: Electron
- **言語**: JavaScript (TypeScriptへの移行予定)
- **データベース**: SQLite3 (better-sqlite3)
- **日本語処理**: TinySegmenter（実装予定）
- **ベクトル検索**: カスタム実装
- **AI API**: OpenAI API（実装予定）

## 📝 現在の実装状況

### ✅ 完了
- Electronアプリケーションの基本構造
- IPC通信の実装
- データベーススキーマ設計
- リポジトリパターンによるデータアクセス層
- エラーハンドリングとロギングシステム
- カウンターとアイテムリストのデモ機能

### 🚧 進行中
- SQLite3への完全移行
- 基本的なUI実装

### 📅 今後の実装予定
- なんでもボックス機能
- ローカル埋め込み生成（@xenova/transformers）
- セレンディピティ検索の実装
- マルチエージェントシステム
- プロット管理機能
- 執筆エディター

## 🐛 既知の問題

1. **node_modules権限エラー（WSL環境）**
   - 一時的な回避策として`install-deps.sh`スクリプトを使用

2. **TypeScriptビルド環境**
   - ネイティブモジュールの問題により、現在はJavaScriptで実装

## 📖 詳細ドキュメント

- [要求仕様書](docs/requirements.md) - プロジェクトの詳細な仕様と設計
- [CLAUDE.md](CLAUDE.md) - Claude Code用の開発ガイドライン

## 🤝 貢献

現在は個人開発プロジェクトですが、フィードバックや提案は歓迎します。

## 📄 ライセンス

ISC License

## 🔗 関連リンク

- [プロジェクトのGitHub](https://github.com/tokoroten/NovelDrive)
- [問題報告](https://github.com/tokoroten/NovelDrive/issues)