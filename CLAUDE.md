# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 重要な制約事項

### ❌ OpenAIの埋め込みAPIは使用禁止
- **埋め込み生成には必ずローカルモデル（LocalEmbeddingService）を使用すること**
- OpenAIのembeddings APIは絶対に使用しない
- テキスト生成（completion/chat）のみOpenAI APIを使用可能
- 埋め込み関連のコードを書く際は必ずLocalEmbeddingServiceを使用

## 📚 API Documentation Maintenance Rules

### 🔄 Always Update API.md When Modifying APIs
**重要**: APIを変更する場合は、必ずAPI.mdを同時に更新してください。

#### When to Update API.md:
1. **新しいIPCハンドラーを追加した時**
   - 新しいエンドポイントをAPI.mdに追加
   - パラメータとレスポンス形式を文書化
   - 使用例を提供

2. **既存のIPCハンドラーを変更した時**
   - パラメータが変更された場合
   - レスポンス形式が変更された場合
   - 動作が変更された場合

3. **データベーススキーマを変更した時**
   - 新しいテーブルを追加した場合
   - テーブル構造を変更した場合
   - 外部キー関係を変更した場合

4. **新しいサービスを追加した時**
   - サービス層の説明を更新
   - 新しいビジネスロジックを文書化

#### API Documentation Update Process:
```bash
# 1. API変更を実装
# 2. API.mdを更新
# 3. 変更をコミット
git add API.md src/main/ipc-handlers/your-handler.js
git commit -m "feat: add new API endpoint and update documentation"
```

#### API.md Update Checklist:
- [ ] エンドポイント名とメソッド
- [ ] パラメータの型と必須フィールド
- [ ] レスポンス形式
- [ ] エラーハンドリング
- [ ] 使用例のJavaScriptコード
- [ ] 関連するデータベーステーブル

#### Example API Documentation Format:
```markdown
#### `your-module:yourAction`
説明文
- **Parameters**:
  - `param1` (type): 説明
  - `param2` (type, optional): 説明
- **Returns**: `{success: boolean, data: Type}`
```javascript
const result = await window.electronAPI.invoke('your-module:yourAction', {
    param1: 'value',
    param2: 'value'
});
```

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