# NovelDrive v3 コンセプトドキュメント

## 概要

NovelDrive v3は、複数のAIエージェントが協働してドキュメントを編集する、マルチエージェント協働執筆システムです。ChatGPTのCanvas機能のように、エージェント間の会話とドキュメント編集が同時に進行し、ユーザーが強い制御権を持って創作プロセスを導きます。

## コア・コンセプト

### 1. マルチエージェント協働システム
- 複数のAIエージェントが独自の視点で議論しながら共通のドキュメントを編集
- 各エージェントはシステムプロンプトで定義された独自の個性と役割を持つ
- エージェント間の自然な会話フローを実現

### 2. 編集権限システム
- エージェントは「編集権限」の有無を設定可能
- 編集権限を持つエージェント：ドキュメントを直接編集
- 編集権限を持たないエージェント：編集権限者に修正を依頼
- 最低1人は編集権限を持つ必要がある

### 3. ユーザーの強い制御権
- ユーザーは議論に参加し、ドキュメントを直接編集可能
- エージェントの議論を一時停止/再開できる
- 議論の方向性を制御し、特定のエージェントに発言を促せる
- エージェントを会話に動的に追加/削除できる

## 技術スタック

- **フロントエンド**: React + TypeScript
- **ビルドツール**: Vite
- **状態管理**: Zustand
- **スタイリング**: Tailwind CSS
- **データ永続化**: IndexedDB
- **AI**: OpenAI API (GPT-4o, o1, o3)

## 主要機能

### 1. エージェント会議室
- 左側：会話ログ（チャット形式）
- 右側：共有ドキュメント（Canvas）
- リアルタイムでの協働編集
- 編集履歴のタイムライン表示

### 2. エージェント人格設定
- カスタムシステムプロンプトの作成/編集
- 編集権限の設定
- プリセット人格の管理

### 3. 設定画面
- OpenAI APIキーの管理
- 使用モデルの選択
- その他のアプリケーション設定

## データ構造

### IndexedDBスキーマ

```typescript
// agentPersonalities - エージェントの人格定義
{
  id: string,
  name: string,
  systemPrompt: string,
  hasEditPermission: boolean,
  createdAt: Date,
  updatedAt: Date
}

// meetings - 会議セッション
{
  id: string,
  title: string,
  participantIds: string[],
  documentId: string,
  createdAt: Date
}

// documents - ドキュメント
{
  id: string,
  meetingId: string,
  content: string,
  version: number,
  createdAt: Date,
  updatedAt: Date
}

// messages - 会話ログ
{
  id: string,
  meetingId: string,
  speaker: string,
  message: string,
  editRequest?: object,
  editAction?: object,
  nextSpeaker: object,
  timestamp: Date
}

// editHistory - 編集履歴（トレーサビリティ）
{
  id: string,
  documentId: string,
  meetingId: string,
  editedBy: string,
  editType: string,
  oldText: string,
  newText: string,
  reason: string,
  relatedMessageId: string,
  timestamp: Date
}

// settings - アプリケーション設定
{
  id: 'user-settings',
  openaiApiKey: string,
  defaultAgentSettings: object
}
```

## 会話フローとStructured Output

エージェントの発言は以下のJSON構造で制御されます：

```json
{
  "speaker": "agent_id",
  "message": "発言内容",
  "edit_action": {
    "type": "replace",
    "old_text": "置換前のテキスト",
    "new_text": "置換後のテキスト"
  },
  "edit_request": {
    "target_agent": "編集権限を持つエージェントID",
    "suggested_text": "提案するテキスト",
    "reason": "修正理由"
  },
  "next_speaker": {
    "type": "specific" | "random" | "user",
    "agent": "次の発言者ID（specificの場合）",
    "prompt": "ユーザーへの質問（userの場合）"
  }
}
```

## 設計原則

1. **シンプルさ**: 過度に複雑な機能は避け、コア機能に集中
2. **トレーサビリティ**: すべての編集と意思決定過程を追跡可能に
3. **ユーザー中心**: ユーザーが常に制御権を持ち、AIは支援ツールとして機能
4. **拡張性**: 将来的な機能追加を考慮した設計

## 移行計画

1. 既存のElectron実装を保存（完了）
2. 新規Vite + Reactプロジェクトのセットアップ
3. IndexedDBラッパーの実装
4. 基本UIコンポーネントの構築
5. OpenAI API統合
6. 各機能の段階的実装

## 今後の拡張可能性

- クラウド同期機能
- リアルタイムコラボレーション（複数ユーザー）
- より高度な編集操作（段落の移動、構造的な編集）
- エクスポート機能（PDF、Word、Markdown）
- バージョン管理とブランチング