# NovelDrive データベース設計書

## 概要

NovelDriveのデータベースは、DuckDB WASMを使用したローカルファーストのアーキテクチャを採用しています。
すべてのデータはユーザーのローカル環境に保存され、高速なベクトル検索と全文検索をサポートします。

## テーブル設計

### 1. projects（プロジェクト）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | プロジェクトID（UUID） |
| name | VARCHAR | NO | - | プロジェクト名 |
| description | TEXT | YES | NULL | プロジェクトの説明 |
| genre | VARCHAR | YES | NULL | ジャンル |
| status | VARCHAR | NO | 'active' | ステータス（active/archived/completed） |
| settings | JSON | YES | '{}' | プロジェクト設定 |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (id)
- INDEX idx_projects_status (status)
- INDEX idx_projects_updated (updated_at DESC)

### 2. knowledge（知識ベース）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | 知識ID（UUID） |
| title | VARCHAR | NO | - | タイトル |
| content | TEXT | NO | - | 内容 |
| type | VARCHAR | NO | - | タイプ（inspiration/article/idea/url/image/audio/term/world_setting/theme） |
| project_id | VARCHAR | YES | NULL | プロジェクトID（NULL=グローバル） |
| source_url | VARCHAR | YES | NULL | ソースURL |
| source_id | VARCHAR | YES | NULL | 派生元の知識ID |
| metadata | JSON | YES | '{}' | メタデータ |
| embedding | FLOAT[] | YES | NULL | ベクトル埋め込み（1536次元） |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (source_id) REFERENCES knowledge(id) ON DELETE SET NULL
- INDEX idx_knowledge_type (type)
- INDEX idx_knowledge_project (project_id)
- INDEX idx_knowledge_created (created_at DESC)
- FULLTEXT INDEX idx_knowledge_fts (title, content) -- 日本語トークナイザー使用

**ベクトルインデックス（DuckDB VSS）:**
```sql
CREATE INDEX idx_knowledge_embedding 
ON knowledge 
USING HNSW (embedding) 
WITH (metric = 'cosine');
```

### 3. characters（キャラクター）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | キャラクターID（UUID） |
| project_id | VARCHAR | NO | - | プロジェクトID |
| name | VARCHAR | NO | - | キャラクター名 |
| profile | TEXT | YES | NULL | プロフィール |
| personality | TEXT | YES | NULL | 性格 |
| speech_style | TEXT | YES | NULL | 話し方の特徴 |
| background | TEXT | YES | NULL | 背景・経歴 |
| dialogue_samples | TEXT | YES | NULL | セリフサンプル |
| metadata | JSON | YES | '{}' | その他の情報 |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- INDEX idx_characters_project (project_id)
- INDEX idx_characters_name (name)

### 4. plots（プロット）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | プロットID（UUID） |
| project_id | VARCHAR | NO | - | プロジェクトID |
| version | VARCHAR | NO | - | バージョン（A, A', A''等） |
| parent_version | VARCHAR | YES | NULL | 親バージョン |
| title | VARCHAR | NO | - | タイトル |
| synopsis | TEXT | NO | - | あらすじ |
| structure | JSON | NO | '{}' | 構造（幕・章構成等） |
| status | VARCHAR | NO | 'draft' | ステータス（draft/reviewing/approved/rejected） |
| created_by | VARCHAR | NO | - | 作成者（human/agent名） |
| metadata | JSON | YES | '{}' | 分析スコア等 |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- UNIQUE KEY uk_plot_version (project_id, version)
- INDEX idx_plots_parent (parent_version)
- INDEX idx_plots_status (status)

### 5. chapters（章）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | 章ID（UUID） |
| project_id | VARCHAR | NO | - | プロジェクトID |
| plot_id | VARCHAR | NO | - | プロットID |
| chapter_number | INTEGER | NO | - | 章番号 |
| title | VARCHAR | NO | - | 章タイトル |
| content | TEXT | NO | - | 本文 |
| word_count | INTEGER | NO | 0 | 文字数 |
| status | VARCHAR | NO | 'draft' | ステータス（draft/writing/review/complete） |
| version | INTEGER | NO | 1 | バージョン番号 |
| metadata | JSON | YES | '{}' | メタデータ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
- UNIQUE KEY uk_chapter_number (project_id, plot_id, chapter_number)
- INDEX idx_chapters_status (status)

### 6. agent_discussions（エージェント議論）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | 議論ID（UUID） |
| project_id | VARCHAR | YES | NULL | プロジェクトID |
| plot_id | VARCHAR | YES | NULL | プロットID |
| chapter_id | VARCHAR | YES | NULL | 章ID |
| topic | VARCHAR | NO | - | 議論トピック |
| status | VARCHAR | NO | 'active' | ステータス（active/paused/completed） |
| thread_id | VARCHAR | NO | - | OpenAI Thread ID |
| participants | JSON | NO | '[]' | 参加エージェント情報 |
| metadata | JSON | YES | '{}' | メタデータ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
- FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
- FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
- INDEX idx_discussions_status (status)
- INDEX idx_discussions_created (created_at DESC)

### 7. agent_messages（エージェントメッセージ）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | メッセージID（UUID） |
| discussion_id | VARCHAR | NO | - | 議論ID |
| agent_role | VARCHAR | NO | - | エージェント役割 |
| agent_name | VARCHAR | YES | NULL | エージェント名 |
| message | TEXT | NO | - | メッセージ内容 |
| message_type | VARCHAR | NO | 'text' | メッセージタイプ |
| metadata | JSON | YES | '{}' | メタデータ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (discussion_id) REFERENCES agent_discussions(id) ON DELETE CASCADE
- INDEX idx_messages_discussion (discussion_id)
- INDEX idx_messages_created (created_at)

### 8. knowledge_links（知識リンク）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | リンクID（UUID） |
| source_id | VARCHAR | NO | - | ソース知識ID |
| target_id | VARCHAR | NO | - | ターゲット知識ID |
| link_type | VARCHAR | NO | 'related' | リンクタイプ（related/derived/referenced） |
| strength | FLOAT | NO | 0.5 | 関連性の強さ（0.0-1.0） |
| metadata | JSON | YES | '{}' | メタデータ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |

**インデックス:**
- PRIMARY KEY (id)
- FOREIGN KEY (source_id) REFERENCES knowledge(id) ON DELETE CASCADE
- FOREIGN KEY (target_id) REFERENCES knowledge(id) ON DELETE CASCADE
- UNIQUE KEY uk_knowledge_link (source_id, target_id)
- INDEX idx_links_target (target_id)

### 9. crawl_history（クロール履歴）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| id | VARCHAR | NO | - | 履歴ID（UUID） |
| url | VARCHAR | NO | - | URL |
| status | VARCHAR | NO | - | ステータス（success/failed/skipped） |
| depth | INTEGER | NO | 0 | クロール深度 |
| parent_url | VARCHAR | YES | NULL | 親URL |
| knowledge_ids | JSON | YES | '[]' | 生成された知識ID |
| error_message | TEXT | YES | NULL | エラーメッセージ |
| crawled_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | クロール日時 |

**インデックス:**
- PRIMARY KEY (id)
- UNIQUE KEY uk_crawl_url (url)
- INDEX idx_crawl_parent (parent_url)
- INDEX idx_crawl_status (status)

### 10. app_settings（アプリケーション設定）

| カラム名 | データ型 | NULL | デフォルト | 説明 |
|---------|---------|------|-----------|------|
| key | VARCHAR | NO | - | 設定キー |
| value | JSON | NO | - | 設定値 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

**インデックス:**
- PRIMARY KEY (key)

## ビューの定義

### active_projects_view
アクティブなプロジェクトの概要を表示
```sql
CREATE VIEW active_projects_view AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.status,
  COUNT(DISTINCT k.id) as knowledge_count,
  COUNT(DISTINCT c.id) as chapter_count,
  COUNT(DISTINCT ch.id) as character_count,
  MAX(k.created_at) as last_knowledge_created,
  p.created_at,
  p.updated_at
FROM projects p
LEFT JOIN knowledge k ON p.id = k.project_id
LEFT JOIN chapters c ON p.id = c.project_id
LEFT JOIN characters ch ON p.id = ch.project_id
WHERE p.status = 'active'
GROUP BY p.id;
```

### recent_activities_view
最近のアクティビティを統合表示
```sql
CREATE VIEW recent_activities_view AS
SELECT 
  'knowledge' as activity_type,
  id,
  title,
  content,
  project_id,
  created_at
FROM knowledge
UNION ALL
SELECT 
  'chapter' as activity_type,
  id,
  title,
  content,
  project_id,
  created_at
FROM chapters
UNION ALL
SELECT 
  'discussion' as activity_type,
  id,
  topic as title,
  '' as content,
  project_id,
  created_at
FROM agent_discussions
ORDER BY created_at DESC;
```

## トリガーの定義

### 1. 更新日時の自動更新
```sql
-- projects
CREATE TRIGGER update_projects_timestamp
AFTER UPDATE ON projects
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- knowledge
CREATE TRIGGER update_knowledge_timestamp
AFTER UPDATE ON knowledge
BEGIN
  UPDATE knowledge SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 他のテーブルも同様に定義
```

### 2. 文字数の自動計算
```sql
CREATE TRIGGER calculate_word_count
BEFORE INSERT OR UPDATE ON chapters
BEGIN
  NEW.word_count = LENGTH(NEW.content);
END;
```

## データベース初期化スクリプト

```sql
-- データベース初期化
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 拡張機能の読み込み
INSTALL vss;
LOAD vss;

-- 日本語トークナイザーの設定
-- (TinySegmenterを使用したカスタムトークナイザー)

-- テーブル作成（上記の定義に従って作成）

-- 初期データの投入
INSERT INTO app_settings (key, value) VALUES
  ('app_version', '"1.0.0"'),
  ('default_ai_model', '"gpt-4-turbo"'),
  ('serendipity_level', '0.3'),
  ('max_crawl_depth', '3');
```

## バックアップとリカバリ

### バックアップ戦略
1. 自動バックアップ：24時間ごと
2. 手動バックアップ：ユーザー操作時
3. バックアップ保存先：`~/NovelDrive/backups/`

### バックアップスクリプト
```sql
-- DuckDBのEXPORT DATABASE機能を使用
EXPORT DATABASE 'backup_path' (FORMAT PARQUET);
```

### リカバリ手順
```sql
-- DuckDBのIMPORT DATABASE機能を使用
IMPORT DATABASE 'backup_path';
```

## パフォーマンス最適化

### 1. インデックス戦略
- 頻繁に検索されるカラムにインデックスを作成
- 複合インデックスは選択性の高いカラムを先頭に
- ベクトル検索用にHNSWインデックスを使用

### 2. クエリ最適化
- 大量データの取得時はLIMITとOFFSETを使用
- JOINの最適化（小さいテーブルを先に）
- 不要なカラムの取得を避ける

### 3. データ管理
- 古いクロール履歴の定期削除
- 不要なエージェントメッセージのアーカイブ
- インデックスの定期的な再構築

## セキュリティ考慮事項

1. **データ暗号化**
   - センシティブな情報（APIキー等）は暗号化して保存
   - ローカルストレージ全体の暗号化を推奨

2. **アクセス制御**
   - ローカルアプリケーションのため、OSレベルのセキュリティに依存
   - エクスポート機能使用時の注意喚起

3. **データ検証**
   - 入力データのサニタイゼーション
   - SQLインジェクション対策（パラメータ化クエリの使用）

## 今後の拡張計画

1. **バージョン管理システム**
   - 章の詳細なバージョン管理
   - 差分管理とマージ機能

2. **コラボレーション機能**
   - 複数ユーザーでのプロジェクト共有（将来的に）
   - 同期機能の実装

3. **分析機能の強化**
   - より詳細な執筆統計
   - AIエージェントのパフォーマンス分析