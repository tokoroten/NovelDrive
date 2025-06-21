# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発日誌を作成すること

`dev_diary/yyyy-mm-dd_hhmm.md` の形式で開発日誌を作成してください。内容は以下の通りです。

- **日付**: yyyy-mm-dd hh:mm
- **作業内容**:
  - 何をしたか
  - どのような問題が発生したか
  - どのように解決したか
- **次回の予定**:

- **感想**: 開発の進捗や学び
- **気分**: なんかいい感じのことを書く
- **愚痴**: なんかいい感じのことを書く


## Project Overview

NovelDrive is a two-layer creative writing platform that combines a serendipitous knowledge management system with a multi-agent novel creation engine. The project aims to mimic human creative memory and ideation processes through innovative AI integration.

## Technology Stack

- **Language**: TypeScript (unified for frontend/backend)
- **Desktop Framework**: Electron
- **Database**: DuckDB WASM
- **Japanese Processing**: TinySegmenter
- **Vector Search**: DuckDB VSS extension
- **Full-text Search**: DuckDB FTS with Japanese tokenizer
- **AI APIs**: OpenAI API (GPT-4, DALL-E)

## Development Commands

Since the project is not yet implemented, here are the planned/expected commands:

```bash
# Initial setup (once implemented)
pnpm install

# Development
pnpm run dev        # Start Electron app in development mode
pnpm run build      # Build production version
pnpm run test       # Run tests
pnpm run lint       # Run ESLint
pnpm run typecheck  # Run TypeScript type checking
```

## Architecture Overview

### Two-Layer Architecture

**Layer 1: Creative Knowledge Management**
- Serendipity-enabled knowledge base (Obsidian/Scrapbox-like)
- Anything Box for capturing all types of information
- Automatic node generation and linking
- AI-powered inspiration extraction

**Layer 2: Novel Creation Engine**
- Multi-agent system for collaborative writing
- Plot generation, discussion, writing, and proofreading
- Interactive human intervention at any point

### Multi-Agent System
The system consists of multiple AI agents working in hierarchy:
1. **Editor-in-Chief** (User) - Makes final decisions
2. **Deputy Editor AI** - Analyzes narrative, raises potential issues, quality evaluation
3. **Writer AI & Editor AI** - Collaborate through discussion (Writer AI "moderately ignores" feedback)
4. **Proofreader AI** - Detects contradictions and consistency issues

### Core Components

1. **Anything Box System**
   - Universal input for news, social media, papers, notes
   - Automatic inspiration extraction and node creation
   - Preserves both original content and creative seeds
   - Vector embedding for serendipity search

2. **Serendipity Search**
   - High-dimensional vector space manipulation
   - Noise injection and dimensional perturbation
   - "Middle distance" discovery for unexpected connections
   - Time-aware retrieval for memory simulation

3. **Knowledge Management**
   - Global knowledge (shared across all projects)
   - Project-specific knowledge (characters, world settings)
   - Automatic linking based on content analysis
   - Visual graph representation

4. **Plot & Writing Management**
   - Version control for plots (A → A' → A'')
   - Multi-agent discussion and refinement
   - Chapter-by-chapter writing with real-time checks
   - Feedback loop to knowledge base

## Key Features

### Operating Modes
- **Normal Mode**: Active only when app is open
- **24-Hour Mode**: Background autonomous creation with quality filtering

### Workflow
1. Human inputs information into Anything Box
2. Writer AI discovers serendipitous connections for plots
3. Multi-agent discussion refines the plot
4. Human intervenes via chat to guide direction
5. Writer AI writes chapter by chapter
6. Completed work feeds back into Layer 1 knowledge

### Main Screens
1. Dashboard
2. Anything Box
3. Knowledge Graph
4. Plot Management
5. Agent Meeting Room
6. Writing Editor
7. Project Knowledge
8. Idea Gacha
9. Analytics Dashboard
10. Settings

## Key Design Principles

1. **Serendipity-First**: Writer AI always uses serendipity search to maintain creative diversity
2. **Moderate Ignorance**: Writer AI "moderately ignores" feedback to preserve creativity
3. **Japanese-First**: Optimize for Japanese text processing and writing conventions
4. **Local-First**: All data processing happens locally for privacy and offline capability
5. **Emergence Over Determinism**: Allow unexpected connections rather than rigid rule-following

## Important Considerations

- The project aims to solve the "overly context-aware LLM" problem by implementing controlled randomness
- All text processing must handle Japanese correctly (tokenization, search, etc.)
- The system should support parallel world/timeline management for complex narratives
- Performance is critical - the system must be responsive during real-time writing

## Reference Documentation

- `docs/concept.md` - Detailed project concept and design philosophy
- `docs/specifications.md` - Functional specifications
- `docs/ai-behavior-spec.md` - AI agent behavior patterns
- `docs/workflow.md` - Complete workflow documentation
- `docs/screen-specifications.md` - Screen and UI specifications

## 開発TODOリストの管理

開発作業を進める際は、TodoWrite/TodoReadツールを使用してTODOリストを作成・管理してください。

### TODOリスト管理の原則
1. **常にTODOリストを確認**: 作業開始時、作業中、作業終了時にTodoReadで確認
2. **即座に更新**: タスクの状態が変わったらすぐにTodoWriteで更新
3. **適切な粒度**: タスクは具体的で実行可能な単位に分割
4. **優先度設定**: high/medium/lowで優先度を設定
5. **進捗の可視化**: in_progressは常に1つのみ

### タスクのライフサイクル
1. `pending`: 未着手のタスク
2. `in_progress`: 現在作業中（同時に1つのみ）
3. `completed`: 完了したタスク

### コミットのタイミング
- 論理的な機能単位が完成したとき
- 大きな変更を加えた後
- テストが通った後
- 作業を中断する前

### 自律的な開発フロー
1. TodoReadでタスクを確認
2. 優先度の高いタスクを選択
3. タスクをin_progressに更新
4. 実装作業を実施
5. テスト実行（可能な場合）
6. タスクをcompletedに更新
7. 適切なタイミングでgit commit & push
8. 開発日誌を更新
9. 定期的にコードのリファクタリングを検討
   - 重複コードの削除
   - コンポーネントの適切な分割
   - 型定義の改善
   - パフォーマンスの最適化
10. 次のタスクへ

### リファクタリングのタイミング
- 3-5個のタスクを完了した後
- 同じパターンのコードが3箇所以上ある場合
- コンポーネントが100行を超えた場合
- 新機能追加前の準備として

この指針に従って、自律的に開発を進めてください。