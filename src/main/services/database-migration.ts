import * as duckdb from 'duckdb';

/**
 * データベースマイグレーションサービス
 */
export class DatabaseMigration {
  private db: duckdb.Database;
  private conn: duckdb.Connection;

  constructor(db: duckdb.Database) {
    this.db = db;
    this.conn = db.connect();
  }

  /**
   * マイグレーションを実行
   */
  async migrate(): Promise<void> {
    console.log('Starting database migration...');
    
    // マイグレーション管理テーブルの作成
    await this.createMigrationTable();
    
    // 実行済みマイグレーションの取得
    const executedMigrations = await this.getExecutedMigrations();
    
    // マイグレーションスクリプトの実行
    const migrations = this.getMigrations();
    
    for (const migration of migrations) {
      if (!executedMigrations.includes(migration.version)) {
        console.log(`Executing migration: ${migration.version} - ${migration.name}`);
        
        try {
          await this.executeMigration(migration);
          await this.recordMigration(migration.version, migration.name);
          console.log(`Migration ${migration.version} completed successfully`);
        } catch (error) {
          console.error(`Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
    
    console.log('Database migration completed');
  }

  /**
   * マイグレーション管理テーブルの作成
   */
  private async createMigrationTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        version VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await this.executeSQL(sql);
  }
  
  /**
   * 実行済みマイグレーションの取得
   */
  private async getExecutedMigrations(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.conn.all('SELECT version FROM migrations', (err: Error | null, rows: any[]) => {
        if (err) {
          // Migration table might not exist yet
          resolve([]);
        } else {
          resolve(rows.map(row => row.version));
        }
      });
    });
  }
  
  /**
   * マイグレーション実行の記録
   */
  private async recordMigration(version: string, name: string): Promise<void> {
    const sql = 'INSERT INTO migrations (version, name) VALUES (?, ?)';
    await this.executeSQL(sql, [version, name]);
  }
  
  /**
   * SQLの実行
   */
  private executeSQL(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (params.length > 0) {
        this.conn.run(sql, params, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        this.conn.run(sql, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  /**
   * 個別のマイグレーションを実行
   */
  private async executeMigration(migration: Migration): Promise<void> {
    for (const sql of migration.sqls) {
      await this.executeSQL(sql);
    }
  }

  /**
   * マイグレーション定義の取得
   */
  private getMigrations(): Migration[] {
    return [
      {
        version: '001',
        name: 'initial_schema',
        sqls: [
          // プロジェクトテーブル
          `CREATE TABLE IF NOT EXISTS projects (
            id VARCHAR PRIMARY KEY,
            name VARCHAR NOT NULL,
            description TEXT,
            genre VARCHAR,
            status VARCHAR NOT NULL DEFAULT 'active',
            settings JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
          
          // プロジェクトのインデックス
          'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
          'CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC)',
          
          // 知識ベーステーブル
          `CREATE TABLE IF NOT EXISTS knowledge (
            id VARCHAR PRIMARY KEY,
            title VARCHAR NOT NULL,
            content TEXT NOT NULL,
            type VARCHAR NOT NULL,
            project_id VARCHAR,
            source_url VARCHAR,
            source_id VARCHAR,
            metadata JSON DEFAULT '{}',
            embedding FLOAT[],
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,
          
          // 知識ベースのインデックス
          'CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)',
          'CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at DESC)',
          
          // キャラクターテーブル
          `CREATE TABLE IF NOT EXISTS characters (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            name VARCHAR NOT NULL,
            profile TEXT,
            personality TEXT,
            speech_style TEXT,
            background TEXT,
            dialogue_samples TEXT,
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,
          
          // キャラクターのインデックス
          'CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name)',
          
          // プロットテーブル
          `CREATE TABLE IF NOT EXISTS plots (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            version VARCHAR NOT NULL,
            parent_version VARCHAR,
            title VARCHAR NOT NULL,
            synopsis TEXT NOT NULL,
            structure JSON NOT NULL DEFAULT '{}',
            status VARCHAR NOT NULL DEFAULT 'draft',
            created_by VARCHAR NOT NULL,
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,
          
          // プロットのインデックス
          'CREATE INDEX IF NOT EXISTS idx_plots_parent ON plots(parent_version)',
          'CREATE INDEX IF NOT EXISTS idx_plots_status ON plots(status)',
          'CREATE UNIQUE INDEX IF NOT EXISTS uk_plot_version ON plots(project_id, version)',
          
          // 章テーブル
          `CREATE TABLE IF NOT EXISTS chapters (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            plot_id VARCHAR NOT NULL,
            "order" INTEGER NOT NULL,
            title VARCHAR NOT NULL,
            content TEXT NOT NULL,
            word_count INTEGER DEFAULT 0,
            character_count INTEGER DEFAULT 0,
            status VARCHAR NOT NULL DEFAULT 'draft',
            version INTEGER DEFAULT 1,
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
          )`,
          
          // 章のインデックス
          'CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status)',
          'CREATE UNIQUE INDEX IF NOT EXISTS uk_chapter_order ON chapters(project_id, plot_id, "order")',
          
          // エージェント議論テーブル
          `CREATE TABLE IF NOT EXISTS agent_discussions (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR,
            plot_id VARCHAR,
            chapter_id VARCHAR,
            topic VARCHAR NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'active',
            thread_id VARCHAR NOT NULL,
            participants JSON NOT NULL DEFAULT '[]',
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
          )`,
          
          // エージェント議論のインデックス
          'CREATE INDEX IF NOT EXISTS idx_discussions_status ON agent_discussions(status)',
          'CREATE INDEX IF NOT EXISTS idx_discussions_created ON agent_discussions(created_at DESC)',
          
          // エージェントメッセージテーブル
          `CREATE TABLE IF NOT EXISTS agent_messages (
            id VARCHAR PRIMARY KEY,
            discussion_id VARCHAR NOT NULL,
            agent_role VARCHAR NOT NULL,
            agent_name VARCHAR,
            message TEXT NOT NULL,
            message_type VARCHAR NOT NULL DEFAULT 'text',
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (discussion_id) REFERENCES agent_discussions(id) ON DELETE CASCADE
          )`,
          
          // エージェントメッセージのインデックス
          'CREATE INDEX IF NOT EXISTS idx_messages_discussion ON agent_messages(discussion_id)',
          'CREATE INDEX IF NOT EXISTS idx_messages_created ON agent_messages(created_at)',
          
          // 知識リンクテーブル
          `CREATE TABLE IF NOT EXISTS knowledge_links (
            id VARCHAR PRIMARY KEY,
            source_id VARCHAR NOT NULL,
            target_id VARCHAR NOT NULL,
            link_type VARCHAR NOT NULL DEFAULT 'related',
            strength FLOAT DEFAULT 0.5,
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES knowledge(id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES knowledge(id) ON DELETE CASCADE
          )`,
          
          // 知識リンクのインデックス
          'CREATE INDEX IF NOT EXISTS idx_links_target ON knowledge_links(target_id)',
          'CREATE UNIQUE INDEX IF NOT EXISTS uk_knowledge_link ON knowledge_links(source_id, target_id)',
          
          // クロール履歴テーブル
          `CREATE TABLE IF NOT EXISTS crawl_history (
            id VARCHAR PRIMARY KEY,
            url VARCHAR NOT NULL,
            status VARCHAR NOT NULL,
            depth INTEGER DEFAULT 0,
            parent_url VARCHAR,
            knowledge_ids JSON DEFAULT '[]',
            error_message TEXT,
            crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
          
          // クロール履歴のインデックス
          'CREATE UNIQUE INDEX IF NOT EXISTS uk_crawl_url ON crawl_history(url)',
          'CREATE INDEX IF NOT EXISTS idx_crawl_parent ON crawl_history(parent_url)',
          'CREATE INDEX IF NOT EXISTS idx_crawl_status ON crawl_history(status)',
          
          // アプリケーション設定テーブル
          `CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR PRIMARY KEY,
            value JSON NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        ]
      },
      {
        version: '002',
        name: 'create_views',
        sqls: [
          // アクティブプロジェクトビュー
          `CREATE VIEW IF NOT EXISTS active_projects_view AS
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
          GROUP BY p.id, p.name, p.description, p.status, p.created_at, p.updated_at`,
          
          // 最近のアクティビティビュー
          `CREATE VIEW IF NOT EXISTS recent_activities_view AS
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
          FROM agent_discussions`
        ]
      },
      {
        version: '003',
        name: 'initial_settings',
        sqls: [
          // 初期設定の投入
          `INSERT OR IGNORE INTO app_settings (key, value) VALUES
            ('app_version', '"1.0.0"'),
            ('default_ai_model', '"gpt-4-turbo"'),
            ('serendipity_level', '0.3'),
            ('max_crawl_depth', '3'),
            ('vector_dimension', '1536'),
            ('auto_backup_enabled', 'true'),
            ('backup_interval_hours', '24')`
        ]
      },
      {
        version: '004',
        name: 'api_usage_logs',
        sqls: [
          // APIの使用ログテーブル
          `CREATE TABLE IF NOT EXISTS api_usage_logs (
            id VARCHAR PRIMARY KEY,
            apiType VARCHAR NOT NULL, -- 'embedding', 'chat', 'image', 'assistant' など
            provider VARCHAR NOT NULL, -- 'openai', 'local' など
            model VARCHAR,
            operation VARCHAR NOT NULL, -- 具体的な操作名
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            totalTokens INTEGER DEFAULT 0,
            estimatedCost FLOAT DEFAULT 0,
            duration_ms INTEGER,
            status VARCHAR NOT NULL DEFAULT 'success', -- 'success', 'error'
            error_message TEXT,
            request_data JSON,
            response_data JSON,
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
          
          // APIログのインデックス
          'CREATE INDEX IF NOT EXISTS idx_api_logs_type ON api_usage_logs(apiType)',
          'CREATE INDEX IF NOT EXISTS idx_api_logs_provider ON api_usage_logs(provider)',
          'CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_usage_logs(created_at DESC)',
          'CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_usage_logs(status)',
          
          // API使用状況の集計ビュー
          `CREATE VIEW IF NOT EXISTS api_usage_summary_view AS
          SELECT 
            apiType,
            provider,
            model,
            COUNT(*) as requestCount,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(totalTokens) as totalTokens,
            SUM(estimatedCost) as totalCost,
            AVG(duration_ms) as avgDurationMs,
            CAST(created_at AS DATE) as date
          FROM api_usage_logs
          GROUP BY apiType, provider, model, CAST(created_at AS DATE)`,
          
          // コスト追跡設定
          `INSERT OR IGNORE INTO app_settings (key, value) VALUES
            ('openai_pricing', '{
              "gpt-4-turbo-preview": {
                "input": 0.01,
                "output": 0.03
              },
              "gpt-4": {
                "input": 0.03,
                "output": 0.06
              },
              "gpt-3.5-turbo": {
                "input": 0.0005,
                "output": 0.0015
              },
              "text-embedding-3-small": {
                "input": 0.00002,
                "output": 0
              },
              "text-embedding-3-large": {
                "input": 0.00013,
                "output": 0
              },
              "dall-e-3": {
                "standard_1024x1024": 0.04,
                "standard_1792x1024": 0.08,
                "standard_1024x1792": 0.08,
                "hd_1024x1024": 0.08,
                "hd_1792x1024": 0.12,
                "hd_1024x1792": 0.12
              }
            }')`
        ]
      },
      {
        version: '005',
        name: 'autonomous_mode_tables',
        sqls: [
          // 自律モード設定
          `CREATE TABLE IF NOT EXISTS autonomous_config (
            id INTEGER PRIMARY KEY,
            config TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,

          // 自律操作履歴
          `CREATE TABLE IF NOT EXISTS autonomous_operations (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            status TEXT NOT NULL,
            project_id TEXT,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            result TEXT,
            error TEXT,
            metrics TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,

          // 自律生成コンテンツ
          `CREATE TABLE IF NOT EXISTS autonomous_content (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            quality_score REAL,
            saved BOOLEAN DEFAULT FALSE,
            project_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,

          // 自律モードログ
          `CREATE TABLE IF NOT EXISTS autonomous_logs (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            level TEXT NOT NULL,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            operation_id TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (operation_id) REFERENCES autonomous_operations(id) ON DELETE CASCADE
          )`,

          // 自律モードインデックス
          'CREATE INDEX IF NOT EXISTS idx_autonomous_ops_status ON autonomous_operations(status)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_ops_project ON autonomous_operations(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_logs_operation ON autonomous_logs(operation_id)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_logs_level ON autonomous_logs(level)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_content_project ON autonomous_content(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_content_saved ON autonomous_content(saved)'
        ]
      },
      {
        version: '006',
        name: 'fix_chapters_column_name',
        sqls: [
          // chaptersテーブルのchapter_numberカラムを"order"に変更するマイグレーション
          // 既存のテーブルがある場合のみ実行
          `DROP INDEX IF EXISTS uk_chapter_number`,
          
          // 新しいテーブル構造でchaptersテーブルを再作成
          `CREATE TABLE IF NOT EXISTS chapters_new (
            id VARCHAR PRIMARY KEY,
            project_id VARCHAR NOT NULL,
            plot_id VARCHAR NOT NULL,
            "order" INTEGER NOT NULL,
            title VARCHAR NOT NULL,
            content TEXT NOT NULL,
            word_count INTEGER DEFAULT 0,
            character_count INTEGER DEFAULT 0,
            status VARCHAR NOT NULL DEFAULT 'draft',
            version INTEGER DEFAULT 1,
            metadata JSON DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
          )`,
          
          // 既存データのコピー（もしchapter_numberカラムが存在すれば）
          `INSERT INTO chapters_new 
            SELECT id, project_id, plot_id, 
                   COALESCE("order", chapter_number, 1) as "order",
                   title, content, word_count, character_count, 
                   status, version, metadata, created_at, updated_at
            FROM chapters`,
          
          // 古いテーブルを削除
          `DROP TABLE chapters`,
          
          // 新しいテーブルをリネーム
          `ALTER TABLE chapters_new RENAME TO chapters`,
          
          // インデックスの再作成
          'CREATE INDEX IF NOT EXISTS idx_chapters_status ON chapters(status)',
          'CREATE UNIQUE INDEX IF NOT EXISTS uk_chapter_order ON chapters(project_id, plot_id, "order")'
        ]
      },
      {
        version: '007',
        name: 'add_search_tokens_columns',
        sqls: [
          // 日本語テキスト用の検索カラムを追加
          'ALTER TABLE knowledge ADD COLUMN IF NOT EXISTS search_tokens TEXT',
          'ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_tokens TEXT',
          'ALTER TABLE characters ADD COLUMN IF NOT EXISTS search_tokens TEXT',
          'ALTER TABLE plots ADD COLUMN IF NOT EXISTS search_tokens TEXT',
          'ALTER TABLE chapters ADD COLUMN IF NOT EXISTS search_tokens TEXT'
        ]
      },
      {
        version: '008',
        name: 'embedding_type_consistency',
        sqls: [
          // embedding列の型をTEXTに統一（JSON文字列として保存）
          `CREATE TABLE IF NOT EXISTS knowledge_new (
            id VARCHAR PRIMARY KEY,
            title VARCHAR NOT NULL,
            content TEXT NOT NULL,
            type VARCHAR NOT NULL,
            project_id VARCHAR,
            source_url VARCHAR,
            source_id VARCHAR,
            metadata JSON DEFAULT '{}',
            embedding TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,
          
          // 既存データのコピー
          `INSERT INTO knowledge_new 
            SELECT id, title, content, type, project_id, source_url, source_id,
                   metadata, 
                   CASE 
                     WHEN embedding IS NOT NULL THEN embedding::TEXT
                     ELSE NULL
                   END as embedding,
                   created_at, updated_at
            FROM knowledge`,
          
          // 古いテーブルを削除
          `DROP TABLE knowledge`,
          
          // 新しいテーブルをリネーム
          `ALTER TABLE knowledge_new RENAME TO knowledge`,
          
          // インデックスの再作成
          'CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge(type)',
          'CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge(project_id)',
          'CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at DESC)'
        ]
      },
      {
        version: '009',
        name: 'autonomous_mode_enhanced_tables',
        sqls: [
          // 自律モード設定テーブル（AutonomousModeService用）
          `CREATE TABLE IF NOT EXISTS autonomous_config (
            project_id TEXT PRIMARY KEY,
            config TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`,
          
          // 自律モード活動ログテーブル（AutonomousModeService用）
          `CREATE TABLE IF NOT EXISTS autonomous_activities (
            id TEXT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type TEXT NOT NULL, -- 'idea_generation' | 'plot_development' | 'chapter_writing' | 'discussion' | 'quality_check'
            project_id TEXT NOT NULL,
            status TEXT NOT NULL, -- 'success' | 'failed' | 'pending_approval'
            content TEXT, -- JSON形式の結果データ
            quality_score INTEGER, -- 品質スコア（0-100）
            tokens_used INTEGER, -- 使用トークン数
            error TEXT, -- エラーメッセージ（失敗時）
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`,
          
          // インデックス作成
          'CREATE INDEX IF NOT EXISTS idx_autonomous_activities_project_timestamp ON autonomous_activities(project_id, timestamp)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_activities_type ON autonomous_activities(type)',
          'CREATE INDEX IF NOT EXISTS idx_autonomous_activities_status ON autonomous_activities(status)',
          
          // テストデータ挿入（開発用）
          `INSERT OR IGNORE INTO autonomous_config (project_id, config) VALUES 
            ('test-project-1', '{"enabled":false,"projectId":"test-project-1","schedule":{"writingInterval":120,"ideaGenerationInterval":60,"discussionInterval":180},"quality":{"minQualityScore":65,"autoSaveThreshold":70,"requireHumanApproval":true},"limits":{"maxChaptersPerDay":3,"maxWordsPerSession":5000,"maxTokensPerDay":100000}}')`
        ]
      },
      {
        version: '010',
        name: 'backup_history_table',
        sqls: [
          // バックアップ履歴テーブル
          `CREATE TABLE IF NOT EXISTS backup_history (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            project_ids TEXT NOT NULL, -- JSON array
            size INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type TEXT NOT NULL, -- 'auto' | 'manual'
            version TEXT NOT NULL,
            checksum TEXT NOT NULL,
            file_path TEXT NOT NULL
          )`,
          
          // バックアップ履歴のインデックス
          'CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC)',
          'CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(type)',
          
          // バックアップ設定をapp_settingsに追加
          `INSERT OR IGNORE INTO app_settings (key, value) VALUES 
            ('backup_config', '{"enabled":true,"intervalHours":24,"maxBackups":10,"includeLogs":false,"compressBackups":true,"backupLocation":""}')`,
        ]
      },
      {
        version: '011',
        name: 'version_history_table',
        sqls: [
          // バージョン履歴テーブル
          `CREATE TABLE IF NOT EXISTS version_history (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            document_type TEXT NOT NULL, -- 'chapter' | 'plot' | 'character' | 'knowledge' | 'project'
            version INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}', -- JSON
            change_type TEXT NOT NULL, -- 'create' | 'update' | 'delete' | 'restore'
            change_description TEXT,
            author_id TEXT,
            author_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            previous_version_id TEXT,
            checksum TEXT NOT NULL,
            size INTEGER NOT NULL,
            FOREIGN KEY (previous_version_id) REFERENCES version_history(id)
          )`,
          
          // バージョン履歴のインデックス
          'CREATE INDEX IF NOT EXISTS idx_version_history_document ON version_history(document_id)',
          'CREATE INDEX IF NOT EXISTS idx_version_history_type ON version_history(document_type)',
          'CREATE INDEX IF NOT EXISTS idx_version_history_created ON version_history(created_at DESC)',
          'CREATE INDEX IF NOT EXISTS idx_version_history_version ON version_history(document_id, version)',
          
          // バージョン履歴設定をapp_settingsに追加
          `INSERT OR IGNORE INTO app_settings (key, value) VALUES 
            ('version_history_config', '{"maxVersionsPerDocument":50,"autoSaveVersions":true,"saveIntervalMinutes":5,"compressOldVersions":true,"retentionPolicyDays":365}')`,
        ]
      }
    ];
  }
}

/**
 * マイグレーション定義
 */
interface Migration {
  version: string;
  name: string;
  sqls: string[];
}