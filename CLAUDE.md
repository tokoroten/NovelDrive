# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 NovelDrive v3 - マルチエージェント協働執筆システム

### プロジェクト概要
NovelDrive v3は、複数のAIエージェントが協働してドキュメントを編集するWebアプリケーションです。Electronから完全に移行し、モダンなWeb技術スタックを採用しています。

### 技術スタック
- **フロントエンド**: React + TypeScript
- **ビルドツール**: Vite
- **状態管理**: Zustand
- **スタイリング**: Tailwind CSS
- **データ永続化**: IndexedDB
- **AI**: OpenAI API (直接ブラウザから呼び出し)

## 📋 重要な設計原則

### 1. シンプルさを保つ
- 過度に複雑な機能は避ける
- コア機能（エージェント会議室、人格設定、設定画面）に集中
- 明確で直感的なUIを維持

### 2. トレーサビリティの確保
- すべての編集履歴を記録
- エージェントの意思決定過程を追跡可能に
- 編集の理由と根拠を保存

### 3. ユーザー中心設計
- ユーザーが常に最高権限を持つ
- エージェントの議論を一時停止/再開可能
- 直接編集とエージェント経由の編集の両方をサポート

## 🏗️ プロジェクト構造（v3）

```
NovelDrive/
├── src/
│   ├── App.tsx          # メインアプリケーションコンポーネント
│   ├── main.tsx         # エントリーポイント
│   ├── index.css        # グローバルスタイル（Tailwind）
│   ├── types.ts         # TypeScript型定義
│   ├── agents.ts        # エージェント定義
│   └── openai-client.ts # OpenAI API クライアント
├── public/              # 静的アセット
├── docs/                # ドキュメント
│   └── v3-concept.md    # v3設計ドキュメント
├── index.html           # HTMLエントリーポイント
├── package.json         # 依存関係
├── vite.config.ts       # Vite設定
├── tailwind.config.js   # Tailwind CSS設定
├── tsconfig.json        # TypeScript設定
└── .env                 # 環境変数（APIキー）
```

## 💾 データ構造

### IndexedDB スキーマ
- `agentPersonalities`: エージェントの人格定義
- `meetings`: 会議セッション
- `documents`: ドキュメント
- `messages`: 会話ログ
- `editHistory`: 編集履歴（トレーサビリティ）
- `settings`: アプリケーション設定

詳細は `docs/v3-concept.md` を参照してください。

## 🤖 エージェントシステム

### Structured Output
エージェントの応答は必ず以下のJSON形式で返すこと：

```typescript
interface AgentResponse {
  speaker: string;
  message: string;
  edit_action?: {
    type: "replace";
    old_text: string;
    new_text: string;
  };
  edit_request?: {
    target_agent: string;
    suggested_text: string;
    reason: string;
  };
  next_speaker: {
    type: "specific" | "random" | "user";
    agent?: string;
    prompt?: string;
  };
}
```

### 編集権限
- エージェントは `hasEditPermission` フラグで編集権限を管理
- 編集権限なしのエージェントは、権限持ちに依頼する形式
- 最低1人は編集権限が必要

## 🚀 現在の実装状況

### サンプルアプリ実装済み（2025-07-10）
- マルチエージェント会話システム
- OpenAI Responses APIを使用した効率的な会話管理
- ユーザーが特定のエージェントに話しかける機能
- React + TypeScript + Tailwind CSSの基本構成

### 使用方法
```bash
# 依存関係のインストール
npm install

# .envファイルにAPIキーを設定
# VITE_OPENAI_API_KEY=your-actual-api-key

# 開発サーバーの起動
npm run dev
```

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview
```

## 📝 現在のエージェント

1. **作家** (writer) - 創造的な視点で物語を紡ぐ
2. **編集者** (editor) - 構造と読者視点を重視
3. **批評家** (critic) - 深い洞察と分析を提供

## 🔮 今後の実装予定

1. **共有ドキュメント編集機能**
   - 編集権限システム
   - リアルタイム編集表示
   - 編集履歴の可視化

2. **エージェント人格設定**
   - カスタムシステムプロンプト
   - 編集権限の設定
   - プリセット管理

3. **IndexedDB統合**
   - 会話履歴の永続化
   - トレーサビリティ機能
   - オフライン対応

## Lintの徹底
- **重要**: ユーザーに応答を返す前に、必ず `npx eslint src/**/*.{ts,tsx}` を実行してlintエラーがないことを確認すること
- lintエラーがある場合は、エラーが解消されるまで修正を行い、ユーザーに応答を求めないこと
- 自動修正可能なエラーは `npx eslint src/**/*.{ts,tsx} --fix` で修正すること

## 開発日誌を作成すること

`dev_diary/yyyy-mm-dd_HHMM.md` の形式で開発日誌を作成してください。内容は以下の通りです。
日時は、dateコマンドを使用して、自動的に生成されるようにしてください。

```bash
date +"%Y-%m-%d %H:%M"
```

- **日付**: yyyy-mm-dd HH:MM
- **作業内容**:
  - 何をしたか
  - どのような問題が発生したか
  - どのように解決したか
- **次回の予定**:
- **感想**: 開発の進捗や学び
- **気分**: なんかいい感じのことを書く
- **愚痴**: なんかいい感じのことを書く