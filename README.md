# NovelDrive

NovelDrive（ノベルドライブ）は、セレンディピティ駆動の知識管理システムと多エージェント小説創作エンジンを組み合わせた、2層構造の創作支援プラットフォームです。

## 概要

人間の創造的記憶と発想プロセスを模倣し、予期せぬつながりから新しい物語を生み出すことを目指したデスクトップアプリケーションです。

### 主な特徴

- **セレンディピティ検索**: ベクトル空間での意図的なノイズ注入により、予期せぬ発見を促進
- **多エージェントシステム**: 複数のAIエージェントが協調して物語を創作
- **なんでもボックス**: あらゆる情報をインスピレーションの種として取り込む
- **知識グラフ可視化**: 情報間の関係性を直感的に把握
- **プロット管理**: バージョン管理機能付きのプロット編集システム
- **日本語最適化**: TinySegmenterによる高速な日本語処理

## 技術スタック

- **言語**: TypeScript
- **デスクトップフレームワーク**: Electron
- **UI**: React + Tailwind CSS
- **データベース**: DuckDB
- **日本語処理**: TinySegmenter
- **AI API**: OpenAI API (GPT-4, DALL-E)
- **ビジュアライゼーション**: React Flow

## アーキテクチャ

NovelDriveは、クリーンアーキテクチャの原則に基づいて設計されています：

### レイヤー構造

1. **Domain Layer** - ビジネスロジックとエンティティ
   - 知識（Knowledge）、プロット（Plot）、キャラクター（Character）などのエンティティ
   - リポジトリインターフェース
   - ドメインイベント

2. **Application Layer** - ユースケースとアプリケーションサービス
   - 知識管理、プロット生成、エージェント議論などのサービス
   - Unit of Workパターンの実装

3. **Infrastructure Layer** - 外部システムとの統合
   - DuckDBリポジトリ実装
   - OpenAI API統合
   - ローカル埋め込み生成（Transformers.js）

4. **Presentation Layer** - UI
   - React コンポーネント
   - Electron IPC ハンドラー

## インストール

### 前提条件

- Node.js 18以上
- npm または pnpm

### セットアップ

1. リポジトリをクローン
```bash
git clone https://github.com/yourusername/NovelDrive.git
cd NovelDrive
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定
```bash
cp .env.example .env
```

`.env`ファイルを編集して、OpenAI APIキーを設定してください：
```
OPENAI_API_KEY=your-api-key-here
```

4. データベースをマイグレーション
```bash
npm run db:migrate
```

5. 開発サーバーを起動
```bash
npm run dev
```

## 使い方

### 基本的なワークフロー

1. **情報収集**: なんでもボックスに気になる情報を投入
2. **インスピレーション抽出**: AIが自動的にキーワードやテーマを抽出
3. **セレンディピティ検索**: 意外な組み合わせを発見
4. **プロット作成**: 発見した要素を組み合わせてプロットを構築
5. **エージェント会議**: 複数のAIが議論してプロットを洗練
6. **執筆**: AIアシスタントと共に本文を執筆

### 主な機能

#### Anything Box
- URL、テキスト、画像など様々な形式の情報を受け入れ
- 自動的にインスピレーションを抽出して知識ベースに保存

#### 知識グラフ
- 保存された情報の関係性を可視化
- インタラクティブな操作で探索可能

#### エージェント会議室
- ライターAI、エディターAI、校正AI、副編集長AIが協調
- リアルタイムで議論の様子を確認可能

#### 執筆エディタ
- リアルタイム文字数カウント
- 自動保存機能
- AIによる執筆提案

#### アイディアガチャ
- ランダムな要素の組み合わせから物語のアイデアを生成
- お気に入り機能で良いアイデアを保存

## 開発

### ビルドコマンド

```bash
# 開発サーバー
npm run dev

# プロダクションビルド
npm run build

# TypeScriptの型チェック
npm run typecheck

# Linting
npm run lint

# フォーマット
npm run format

# テスト実行
npm run test              # 単体テスト
npm run test:e2e          # E2Eテスト
npm run test:coverage     # カバレッジレポート付きテスト

# データベース操作
npm run db:migrate        # マイグレーション実行
npm run db:seed          # テストデータ投入
```

### プロジェクト構造

```
NovelDrive/
├── src/
│   ├── main/              # Electronメインプロセス
│   │   ├── core/          # コアビジネスロジック
│   │   │   ├── domain/    # ドメインエンティティ
│   │   │   ├── events/    # ドメインイベント
│   │   │   └── errors/    # カスタムエラー
│   │   ├── services/      # アプリケーションサービス
│   │   ├── repositories/  # リポジトリ実装
│   │   ├── infrastructure/# 外部システム統合
│   │   └── ipc/          # IPCハンドラー
│   ├── renderer/         # Electronレンダラープロセス
│   │   ├── components/   # Reactコンポーネント
│   │   │   └── graph/    # グラフ関連コンポーネント
│   │   ├── utils/       # ユーティリティ関数
│   │   └── App.tsx      # メインアプリケーション
│   └── shared/          # 共有型定義
├── docs/               # ドキュメント
├── dev_diary/          # 開発日誌
├── e2e/                # E2Eテスト
│   ├── tests/         # テストスペック
│   ├── utils/         # テストヘルパー
│   └── fixtures/      # テストデータ
├── tests/             # 単体テスト
└── CLAUDE.md          # AI開発アシスタント用ガイド
```

### テスト

本プロジェクトでは以下のテスト戦略を採用しています：

1. **単体テスト** - Jest を使用したサービス層のテスト
2. **E2Eテスト** - Playwright を使用したエンドツーエンドテスト
3. **CI/CD** - GitHub Actions による自動テスト実行

### 主な技術的特徴

- **クリーンアーキテクチャ**: ビジネスロジックとインフラストラクチャの分離
- **イベント駆動**: ドメインイベントによる疎結合な設計
- **型安全性**: TypeScriptによる厳密な型チェック
- **ローカルファースト**: 埋め込み生成などの処理をローカルで実行
- **リアクティブUI**: React + Framer Motion による滑らかなアニメーション

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを作成して変更内容について議論してください。

## 謝辞

このプロジェクトは、創作活動におけるセレンディピティの重要性に着目し、AIと人間の協調による新しい創作体験を実現することを目指しています。

---

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>