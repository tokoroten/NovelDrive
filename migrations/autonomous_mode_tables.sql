-- 24時間自律モード用テーブル

-- 自律モード設定テーブル
CREATE TABLE IF NOT EXISTS autonomous_config (
  project_id TEXT PRIMARY KEY,
  config TEXT NOT NULL, -- JSON設定
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 自律モード活動ログテーブル
CREATE TABLE IF NOT EXISTS autonomous_activities (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL, -- 'idea_generation' | 'plot_development' | 'chapter_writing' | 'discussion' | 'quality_check'
  project_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success' | 'failed' | 'pending_approval'
  content TEXT, -- JSON形式の結果データ
  quality_score INTEGER, -- 品質スコア（0-100）
  tokens_used INTEGER, -- 使用トークン数
  error TEXT, -- エラーメッセージ（失敗時）
  
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_autonomous_activities_project_timestamp 
ON autonomous_activities(project_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_autonomous_activities_type 
ON autonomous_activities(type);

CREATE INDEX IF NOT EXISTS idx_autonomous_activities_status 
ON autonomous_activities(status);

-- テストデータ挿入（開発用）
INSERT OR IGNORE INTO autonomous_config (project_id, config) VALUES 
('test-project-1', '{"enabled":false,"projectId":"test-project-1","schedule":{"writingInterval":120,"ideaGenerationInterval":60,"discussionInterval":180},"quality":{"minQualityScore":65,"autoSaveThreshold":70,"requireHumanApproval":true},"limits":{"maxChaptersPerDay":3,"maxWordsPerSession":5000,"maxTokensPerDay":100000}}');