# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 NovelDrive v3 - マルチエージェント協働執筆システム

### プロジェクト概要
NovelDrive v3は、複数のAIエージェントが協働してドキュメントを編集するWebアプリケーションです。完全にモダンなWeb技術スタックを採用し、高度な会話管理とドキュメント編集機能を提供します。

### 技術スタック
- **フロントエンド**: React 18 + TypeScript 5
- **ビルドツール**: Vite 5
- **状態管理**: Zustand 4
- **スタイリング**: Tailwind CSS 3
- **データ永続化**: IndexedDB (Dexie)
- **AI**: OpenAI API / Anthropic Claude API (直接ブラウザから呼び出し)
- **差分処理**: カスタムBitapアルゴリズム + Web Worker

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
│   ├── App.tsx                      # メインアプリケーションコンポーネント
│   ├── main.tsx                     # エントリーポイント
│   ├── index.css                    # グローバルスタイル（Tailwind）
│   ├── types.ts                     # TypeScript型定義
│   ├── agents.ts                    # エージェント定義
│   ├── store.ts                     # Zustand状態管理
│   ├── ConversationQueue.ts         # 会話キュー管理
│   ├── llm/                         # LLMプロバイダー
│   │   ├── index.ts                 # 統一インターフェース
│   │   ├── openai.ts                # OpenAI実装
│   │   ├── claude.ts                # Claude実装
│   │   └── types.ts                 # 共通型定義
│   ├── components/                  # UIコンポーネント
│   │   ├── Settings.tsx             # 設定画面
│   │   ├── AgentManager.tsx         # エージェント管理
│   │   ├── SessionHistory.tsx       # セッション履歴
│   │   ├── VersionTimeline.tsx      # バージョンタイムライン
│   │   ├── Sidebar.tsx              # サイドバー
│   │   └── Help.tsx                 # ヘルプダイアログ
│   ├── utils/                       # ユーティリティ
│   │   ├── diffMatcher.ts           # diff処理（TypeScript側）
│   │   ├── diffWorkerHelper.ts      # Web Workerヘルパー
│   │   ├── conversationManager.ts   # 会話履歴管理
│   │   └── conversationSummarizer.ts # 会話要約
│   └── db/                          # データベース層
│       ├── index.ts                 # Dexie設定
│       └── schema.ts                # スキーマ定義
├── public/                          # 静的アセット
│   └── diffWorkerV2.js             # Web Worker（高度なdiff処理）
├── docs/                            # ドキュメント
│   └── v3-concept.md               # v3設計ドキュメント
├── dev_diary/                       # 開発日誌
├── index.html                       # HTMLエントリーポイント
├── package.json                     # 依存関係
├── vite.config.ts                   # Vite設定
├── tailwind.config.js               # Tailwind CSS設定
├── tsconfig.json                    # TypeScript設定
└── .env.example                     # 環境変数例（使用しない）
```

## 💾 データ構造

### IndexedDB スキーマ（Dexie）
```typescript
// Sessions table
interface Session {
  id?: number;
  sessionId: string;
  title: string;
  conversation: ConversationTurn[];
  documentContent: string;
  agents: Agent[];
  activeAgentIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ConversationTurn
interface ConversationTurn {
  id: string;
  speaker: string;
  message: string;
  timestamp: Date;
  targetAgent?: string;
  documentAction?: DocumentAction;
  isThinking?: boolean;
  editResult?: EditResult;
}
```

## 🤖 エージェントシステム

### Structured Output
エージェントの応答は必ず以下のJSON形式で返すこと：

```typescript
interface AgentResponse {
  speaker: string;
  message: string;
  document_action?: {
    type: "none" | "diff" | "append" | "request_edit";
    diffs?: Array<{ oldText: string; newText: string }>;
    contents?: string[];
    content?: string;
    target_agent?: string;
  };
  next_speaker: {
    type: "specific" | "random" | "user";
    agent?: string;
  };
}
```

### 編集権限
- エージェントは `canEdit` フラグで編集権限を管理
- 編集権限なしのエージェントは、権限持ちに依頼する形式
- 最低1人は編集権限が必要

## 🔧 高度な機能

### Diff処理システム
- **diffWorkerV2.js**: Bitapアルゴリズムによるファジーマッチング
- 3段階のマッチング戦略:
  1. exact: 完全一致
  2. normalized: 正規化後の一致（全角・半角、空白など）
  3. fuzzy: ファジーマッチング（類似度スコアベース）
- Web Workerで非同期処理、UIをブロックしない

### 会話管理システム
- **ConversationManager**: 複数回の要約を適切に管理
- 要約の要約（summary-of-summaries）を防ぐ
- 古い会話履歴の自動削除でメモリ効率を最適化
- ターン数は最後の要約からカウント

### マルチLLMサポート
- 統一されたインターフェースで複数プロバイダーに対応
- 現在サポート: OpenAI, Claude
- Function Callingによる構造化された応答

## 🚀 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# プレビュー
npm run preview

# Lintチェック
npx eslint src/**/*.{ts,tsx}

# Lint自動修正
npx eslint src/**/*.{ts,tsx} --fix
```

## 📝 現在のエージェント

1. **作家「夢織」** (writer) - 創造的な視点で物語を紡ぐ
2. **編集者「赤羽」** (editor) - 構造と読者視点を重視
3. **批評家「辛島」** (critic) - 深い洞察と分析を提供
4. **言語学者「紡」** (linguist) - 言葉と文体の専門家
5. **ターゲット分析官「狙」** (target_analyst) - 読者層と市場分析
6. **世界構築師「創界」** (worldbuilder) - 設定と世界観構築
7. **プロット構成師「筋書」** (plotter) - 物語構造設計
8. その他多数...

## ⚠️ 注意事項

### APIキー管理
- **重要**: 環境変数からAPIキーを読み込まない
- APIキーは必ずアプリ内の設定画面から入力
- localStorageに暗号化なしで保存（ブラウザ内完結のため）

### セキュリティ
- APIキーをコードにハードコードしない
- 環境変数（.env）は使用しない
- すべてのAPIコールはブラウザから直接実行

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

## 🔮 最近の実装

1. **高度なdiff処理**（2025-07-15）
   - diffWorkerV2.jsでBitapアルゴリズム実装
   - 全角・半角文字の自動正規化
   - ファジーマッチングで柔軟な置換

2. **会話管理の改善**（2025-07-15）
   - ConversationManagerクラスの実装
   - 複数回の要約に対応
   - メモリ効率の最適化

3. **マルチLLMサポート**（実装済み）
   - OpenAI/Claude APIの統一インターフェース
   - プロバイダー切り替えが容易

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.