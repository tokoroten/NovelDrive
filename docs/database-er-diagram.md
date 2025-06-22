# NovelDrive データベース ER図

## ER図（Mermaid形式）

```mermaid
erDiagram
    projects ||--o{ knowledge : "has"
    projects ||--o{ characters : "has"
    projects ||--o{ plots : "has"
    projects ||--o{ chapters : "has"
    projects ||--o{ agent_discussions : "has"
    
    plots ||--o{ chapters : "contains"
    plots ||--o{ plots : "derived_from"
    
    chapters ||--o{ agent_discussions : "discussed_in"
    
    knowledge ||--o{ knowledge : "derived_from"
    knowledge ||--o{ knowledge_links : "source"
    knowledge ||--o{ knowledge_links : "target"
    
    agent_discussions ||--o{ agent_messages : "contains"
    
    crawl_history }o--o{ knowledge : "generates"

    %% テーブル定義
    projects {
        VARCHAR id PK
        VARCHAR name
        TEXT description
        VARCHAR genre
        VARCHAR status
        JSON settings
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    knowledge {
        VARCHAR id PK
        VARCHAR title
        TEXT content
        VARCHAR type
        VARCHAR project_id FK
        VARCHAR source_url
        VARCHAR source_id FK
        JSON metadata
        FLOAT_ARRAY embedding
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    characters {
        VARCHAR id PK
        VARCHAR project_id FK
        VARCHAR name
        TEXT profile
        TEXT personality
        TEXT speech_style
        TEXT background
        TEXT dialogue_samples
        JSON metadata
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    plots {
        VARCHAR id PK
        VARCHAR project_id FK
        VARCHAR version
        VARCHAR parent_version FK
        VARCHAR title
        TEXT synopsis
        JSON structure
        VARCHAR status
        VARCHAR created_by
        JSON metadata
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    chapters {
        VARCHAR id PK
        VARCHAR project_id FK
        VARCHAR plot_id FK
        INTEGER chapter_number
        VARCHAR title
        TEXT content
        INTEGER word_count
        VARCHAR status
        INTEGER version
        JSON metadata
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    agent_discussions {
        VARCHAR id PK
        VARCHAR project_id FK
        VARCHAR plot_id FK
        VARCHAR chapter_id FK
        VARCHAR topic
        VARCHAR status
        VARCHAR thread_id
        JSON participants
        JSON metadata
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
    
    agent_messages {
        VARCHAR id PK
        VARCHAR discussion_id FK
        VARCHAR agent_role
        VARCHAR agent_name
        TEXT message
        VARCHAR message_type
        JSON metadata
        TIMESTAMP created_at
    }
    
    knowledge_links {
        VARCHAR id PK
        VARCHAR source_id FK
        VARCHAR target_id FK
        VARCHAR link_type
        FLOAT strength
        JSON metadata
        TIMESTAMP created_at
    }
    
    crawl_history {
        VARCHAR id PK
        VARCHAR url
        VARCHAR status
        INTEGER depth
        VARCHAR parent_url
        JSON knowledge_ids
        TEXT error_message
        TIMESTAMP crawled_at
    }
    
    app_settings {
        VARCHAR key PK
        JSON value
        TIMESTAMP updated_at
    }
```

## リレーションシップの詳細

### 1. projects テーブル（中心的なエンティティ）
- **1対多**: knowledge（プロジェクト固有の知識）
- **1対多**: characters（プロジェクトのキャラクター）
- **1対多**: plots（プロジェクトのプロット）
- **1対多**: chapters（プロジェクトの章）
- **1対多**: agent_discussions（プロジェクトに関する議論）

### 2. knowledge テーブル（知識ベース）
- **多対1**: projects（所属プロジェクト、NULLの場合はグローバル）
- **自己参照**: source_id（派生元の知識）
- **1対多**: knowledge_links（ソースとして）
- **1対多**: knowledge_links（ターゲットとして）

### 3. plots テーブル（プロットバージョン管理）
- **多対1**: projects（所属プロジェクト）
- **自己参照**: parent_version（親バージョン）
- **1対多**: chapters（プロットに含まれる章）

### 4. chapters テーブル（章管理）
- **多対1**: projects（所属プロジェクト）
- **多対1**: plots（所属プロット）
- **1対多**: agent_discussions（章に関する議論）

### 5. agent_discussions テーブル（AI議論）
- **多対1**: projects（関連プロジェクト、NULL可）
- **多対1**: plots（関連プロット、NULL可）
- **多対1**: chapters（関連章、NULL可）
- **1対多**: agent_messages（議論のメッセージ）

### 6. knowledge_links テーブル（知識間の関連）
- **多対1**: knowledge（ソース知識）
- **多対1**: knowledge（ターゲット知識）

### 7. crawl_history テーブル（クロール履歴）
- **多対多**: knowledge（生成された知識、JSON配列で管理）

## 外部キー制約

### CASCADE DELETE（親削除時に子も削除）
- projects → knowledge
- projects → characters
- projects → plots
- projects → chapters
- projects → agent_discussions
- plots → chapters
- agent_discussions → agent_messages
- knowledge → knowledge_links（source/target両方）

### SET NULL（親削除時にNULLセット）
- knowledge → knowledge（source_id）

## インデックス戦略

### 主キー
- すべてのテーブルでVARCHAR型のUUID使用

### ユニークキー
- plots: (project_id, version)
- chapters: (project_id, plot_id, chapter_number)
- knowledge_links: (source_id, target_id)
- crawl_history: (url)

### 通常のインデックス
- 外部キーカラム
- ステータスカラム
- 日時カラム（降順）
- タイプ・カテゴリカラム

## データ整合性の保証

1. **プロジェクト削除時**
   - 関連するすべてのデータが自動削除（CASCADE DELETE）
   - 完全なクリーンアップを保証

2. **知識の派生関係**
   - source_idによる派生元の追跡
   - 派生元削除時もSET NULLで履歴保持

3. **プロットのバージョン管理**
   - parent_versionによるバージョンツリー
   - versionの一意性保証（プロジェクト内）

4. **章の順序管理**
   - chapter_numberの一意性（プロジェクト×プロット内）
   - 章番号の重複防止

5. **知識リンクの双方向性**
   - source_idとtarget_idの組み合わせの一意性
   - 重複リンクの防止