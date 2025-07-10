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
│   ├── components/       # Reactコンポーネント
│   ├── pages/           # ページコンポーネント
│   ├── stores/          # Zustandストア
│   ├── hooks/           # カスタムフック
│   ├── lib/             # ユーティリティ関数
│   ├── types/           # TypeScript型定義
│   └── styles/          # グローバルスタイル
├── public/              # 静的アセット
├── docs/                # ドキュメント
│   └── v3-concept.md    # v3設計ドキュメント
└── index.html           # エントリーポイント
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

## 開発日誌を作成すること

`dev_diary/yyyy-mm-dd_HHMM.md` の形式で開発日誌を作成してください。内容は以下の通りです。
日時は、timeコマンドを使用して、自動的に生成されるようにしてください。

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


## Lintの徹底
- ユーザに応答を求める前に、lintを実行し、lintのエラーが無いことを確認すること
- もし、lintのエラーがある場合は、治るまでユーザの応答を求めないこと

## Project Overview

NovelDrive is a two-layer creative writing platform that combines a serendipitous knowledge management system with a multi-agent novel creation engine. The project aims to mimic human creative memory and ideation processes through innovative AI integration.

## Technology Stack

- **Language**: JavaScript (Node.js backend, Browser frontend)
- **Desktop Framework**: Electron
- **Database**: SQLite with better-sqlite3
- **Japanese Processing**: TinySegmenter
- **Vector Search**: Local embedding service with multilingual-e5-base
- **AI APIs**: OpenAI API (GPT-4o, o1, o3 models)
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Architecture

### IPC Communication Pattern
```
Renderer Process (Frontend)
    ↓ window.electronAPI.invoke()
Main Process (Backend)
    ↓ IPC Handlers
    ↓ Services (Business Logic)
    ↓ Repositories (Data Access)
    ↓ SQLite Database
```

### Key Directories
- `src/main/ipc-handlers/`: API endpoint definitions
- `src/main/services/`: Business logic layer
- `src/main/repositories/`: Data access layer
- `src/main/database/`: Database schema and migrations
- `src/renderer/js/`: Frontend JavaScript modules

## Development Guidelines

### 🚨 Security Rules
1. **Never hardcode API keys** - Store in settings with proper encryption
2. **Always validate input** at IPC handler level
3. **Use parameterized queries** for all database operations
4. **Sanitize user input** before displaying in HTML

### 📁 File Organization
- Keep IPC handlers focused and single-responsibility
- Use services for complex business logic
- Keep repositories for data access only
- Use consistent naming conventions

### 🧪 Testing Approach
- Test IPC handlers with mock data
- Test database operations with test database
- Test UI functionality manually or with integration tests

### 🔍 Error Handling
- All IPC handlers should return `{success: boolean, data?: any, error?: string}`
- Log errors with context information
- Provide user-friendly error messages

## Current Features

### ✅ Implemented
- Project management system
- Knowledge management with vector search
- Multi-agent writing assistance
- Plot and character management
- Settings and configuration
- Analytics and progress tracking

### 🚧 In Development
- Workspace interface improvements
- API documentation maintenance
- Error handling enhancements

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Check database schema
sqlite3 ./user-data/database/noveldrive.db ".schema"
```

## Important Files to Know

- `API.md`: Complete API documentation (MUST be kept up to date)
- `src/main/database/schema.sql`: Database structure
- `src/main/index.js`: Main process entry point
- `src/renderer/settings.html`: Settings page
- `package.json`: Dependencies and scripts