-- NovelDrive Database Schema
-- SQLite3 compatible schema based on requirements.md

-- プロジェクト管理
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON
);

-- ナレッジ管理（なんでもボックスのデータ）
CREATE TABLE IF NOT EXISTS knowledge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    type TEXT NOT NULL, -- 'text', 'url', 'image', 'note', etc.
    title TEXT,
    content TEXT NOT NULL,
    embeddings TEXT, -- JSON array of floats
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ナレッジ間のリンク
CREATE TABLE IF NOT EXISTS knowledge_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    link_type TEXT NOT NULL, -- 'semantic', 'reference', 'temporal', etc.
    strength REAL DEFAULT 1.0,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES knowledge(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES knowledge(id) ON DELETE CASCADE
);

-- キャラクター管理
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    personality TEXT,
    appearance TEXT,
    background TEXT,
    relationships TEXT, -- JSON
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- プロット管理
CREATE TABLE IF NOT EXISTS plots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    parent_plot_id INTEGER,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    structure TEXT, -- JSON (three-act, kishōtenketsu, etc.)
    summary TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_plot_id) REFERENCES plots(id) ON DELETE SET NULL
);

-- 章管理
CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plot_id INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    summary TEXT,
    word_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft', -- 'draft', 'writing', 'review', 'complete'
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
);

-- エージェント議論
CREATE TABLE IF NOT EXISTS agent_discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plot_id INTEGER,
    chapter_id INTEGER,
    purpose TEXT NOT NULL, -- 'plot_development', 'character_review', etc.
    participants TEXT NOT NULL, -- JSON array of agent types
    status TEXT DEFAULT 'ongoing', -- 'ongoing', 'paused', 'completed'
    summary TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE SET NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
);

-- エージェントメッセージ
CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL,
    agent_type TEXT NOT NULL, -- 'writer', 'editor', 'proofreader', 'deputy_editor'
    message_content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'suggestion', 'critique'
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id) REFERENCES agent_discussions(id) ON DELETE CASCADE
);

-- API使用ログ
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_type TEXT NOT NULL, -- 'openai', 'dalle', etc.
    endpoint TEXT NOT NULL,
    model TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 自律モード設定
CREATE TABLE IF NOT EXISTS autonomous_config (
    project_id INTEGER PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    check_interval_minutes INTEGER DEFAULT 30,
    quality_threshold REAL DEFAULT 0.7,
    max_tokens_per_day INTEGER DEFAULT 50000,
    metadata TEXT, -- JSON
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 自律モード活動ログ
CREATE TABLE IF NOT EXISTS autonomous_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    activity_type TEXT NOT NULL, -- 'plot_generation', 'writing', 'review', etc.
    description TEXT,
    quality_score REAL,
    tokens_used INTEGER DEFAULT 0,
    result_data TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- バックアップ履歴
CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_type TEXT NOT NULL, -- 'manual', 'auto', 'pre_update'
    file_path TEXT NOT NULL,
    file_size INTEGER,
    compression TEXT DEFAULT 'gzip',
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- バージョン履歴
CREATE TABLE IF NOT EXISTS version_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'plot', 'chapter', 'character', etc.
    entity_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    checksum TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- アプリケーション設定
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at);

CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_plots_project ON plots(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_plot ON chapters(plot_id);

CREATE INDEX IF NOT EXISTS idx_agent_discussions_project ON agent_discussions(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_discussion ON agent_messages(discussion_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_autonomous_activities_project ON autonomous_activities(project_id);

-- ビュー作成
CREATE VIEW IF NOT EXISTS active_projects_view AS
SELECT 
    p.*,
    COUNT(DISTINCT k.id) as knowledge_count,
    COUNT(DISTINCT c.id) as character_count,
    COUNT(DISTINCT pl.id) as plot_count,
    COUNT(DISTINCT ch.id) as chapter_count
FROM projects p
LEFT JOIN knowledge k ON p.id = k.project_id
LEFT JOIN characters c ON p.id = c.project_id
LEFT JOIN plots pl ON p.id = pl.project_id
LEFT JOIN chapters ch ON p.id = ch.project_id
GROUP BY p.id;

CREATE VIEW IF NOT EXISTS api_usage_summary_view AS
SELECT 
    DATE(created_at) as usage_date,
    api_type,
    COUNT(*) as call_count,
    SUM(total_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost
FROM api_usage_logs
GROUP BY DATE(created_at), api_type;

CREATE VIEW IF NOT EXISTS recent_activities_view AS
SELECT 
    'knowledge' as type,
    id,
    project_id,
    title as name,
    created_at
FROM knowledge
UNION ALL
SELECT 
    'character' as type,
    id,
    project_id,
    name,
    created_at
FROM characters
UNION ALL
SELECT 
    'plot' as type,
    id,
    project_id,
    title as name,
    created_at
FROM plots
ORDER BY created_at DESC
LIMIT 100;