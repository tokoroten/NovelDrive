import * as duckdb from 'duckdb';
import path from 'path';
import os from 'os';
import { DatabaseMigration } from './database-migration';
import { insertSampleData } from './sample-data';

/**
 * データベーステストサービス
 */
export class DatabaseTestService {
  private db: duckdb.Database;
  private conn: duckdb.Connection;

  constructor() {
    // テスト用データベースを作成
    const dbPath = path.join(os.tmpdir(), 'noveldrive-test.db');
    console.log(`Using test database at: ${dbPath}`);
    this.db = new duckdb.Database(dbPath);
    this.conn = this.db.connect();
  }

  /**
   * すべてのテストを実行
   */
  async runAllTests(): Promise<void> {
    console.log('=== Database Test Suite ===\n');

    try {
      // 1. マイグレーションテスト
      await this.testMigration();
      
      // 2. 基本的なCRUD操作テスト
      await this.testBasicCRUD();
      
      // 3. リレーションテスト
      await this.testRelations();
      
      // 4. JSON操作テスト
      await this.testJSONOperations();
      
      // 5. サンプルデータ投入テスト
      await this.testSampleData();
      
      // 6. ビューのテスト
      await this.testViews();
      
      // 7. パフォーマンステスト
      await this.testPerformance();
      
      console.log('\n✅ All tests passed!');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * マイグレーションテスト
   */
  private async testMigration(): Promise<void> {
    console.log('1. Testing database migration...');
    
    const migration = new DatabaseMigration(this.db);
    await migration.migrate();
    
    // テーブルの存在確認
    const tables = await this.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
      ORDER BY table_name
    `);
    
    const expectedTables = [
      'agent_discussions',
      'agent_messages',
      'app_settings',
      'chapters',
      'characters',
      'crawl_history',
      'knowledge',
      'knowledge_links',
      'migrations',
      'plots',
      'projects'
    ];
    
    const actualTables = tables.map((row: Record<string, unknown>) => row.table_name);
    
    for (const table of expectedTables) {
      if (!actualTables.includes(table)) {
        throw new Error(`Table ${table} not found`);
      }
    }
    
    console.log('  ✓ All tables created successfully');
    console.log(`  ✓ Found ${actualTables.length} tables`);
  }

  /**
   * 基本的なCRUD操作テスト
   */
  private async testBasicCRUD(): Promise<void> {
    console.log('\n2. Testing basic CRUD operations...');
    
    // Create
    const projectId = 'test-project-' + Date.now();
    await this.execute(
      'INSERT INTO projects (id, name, description) VALUES (?, ?, ?)',
      [projectId, 'Test Project', 'Test Description']
    );
    console.log('  ✓ INSERT successful');
    
    // Read
    const projects = await this.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );
    if (projects.length !== 1) {
      throw new Error('Project not found');
    }
    console.log('  ✓ SELECT successful');
    
    // Update
    await this.execute(
      'UPDATE projects SET description = ? WHERE id = ?',
      ['Updated Description', projectId]
    );
    const updated = await this.query(
      'SELECT description FROM projects WHERE id = ?',
      [projectId]
    );
    if (updated[0].description !== 'Updated Description') {
      throw new Error('Update failed');
    }
    console.log('  ✓ UPDATE successful');
    
    // Delete
    await this.execute(
      'DELETE FROM projects WHERE id = ?',
      [projectId]
    );
    const deleted = await this.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );
    if (deleted.length !== 0) {
      throw new Error('Delete failed');
    }
    console.log('  ✓ DELETE successful');
  }

  /**
   * リレーションテスト
   */
  private async testRelations(): Promise<void> {
    console.log('\n3. Testing relations...');
    
    // プロジェクトとキャラクターの関係をテスト
    const projectId = 'rel-test-project';
    const characterId = 'rel-test-char';
    
    await this.execute(
      'INSERT INTO projects (id, name) VALUES (?, ?)',
      [projectId, 'Relation Test Project']
    );
    
    await this.execute(
      `INSERT INTO characters (id, project_id, name, profile) 
       VALUES (?, ?, ?, ?)`,
      [characterId, projectId, 'Test Character', 'Test Profile']
    );
    
    // 外部キー制約のテスト（プロジェクト削除時にキャラクターも削除される）
    await this.execute(
      'DELETE FROM projects WHERE id = ?',
      [projectId]
    );
    
    const orphanedChars = await this.query(
      'SELECT * FROM characters WHERE id = ?',
      [characterId]
    );
    
    if (orphanedChars.length !== 0) {
      throw new Error('Foreign key cascade delete failed');
    }
    
    console.log('  ✓ Foreign key constraints working');
    console.log('  ✓ Cascade delete working');
  }

  /**
   * JSON操作テスト
   */
  private async testJSONOperations(): Promise<void> {
    console.log('\n4. Testing JSON operations...');
    
    const projectId = 'json-test-project';
    const settings = {
      theme: 'dark',
      autoSave: true,
      language: 'ja'
    };
    
    // JSON挿入
    await this.execute(
      'INSERT INTO projects (id, name, settings) VALUES (?, ?, ?)',
      [projectId, 'JSON Test', JSON.stringify(settings)]
    );
    
    // JSON取得
    const result = await this.query(
      'SELECT settings FROM projects WHERE id = ?',
      [projectId]
    );
    
    const parsedSettings = JSON.parse(result[0].settings);
    if (parsedSettings.theme !== 'dark') {
      throw new Error('JSON parsing failed');
    }
    
    console.log('  ✓ JSON insert successful');
    console.log('  ✓ JSON retrieval successful');
    
    // クリーンアップ
    await this.execute('DELETE FROM projects WHERE id = ?', [projectId]);
  }

  /**
   * サンプルデータ投入テスト
   */
  private async testSampleData(): Promise<void> {
    console.log('\n5. Testing sample data insertion...');
    
    await insertSampleData(this.conn);
    
    // データ数の確認
    const counts = await this.query(`
      SELECT 
        (SELECT COUNT(*) FROM projects) as projects,
        (SELECT COUNT(*) FROM knowledge) as knowledge,
        (SELECT COUNT(*) FROM characters) as characters,
        (SELECT COUNT(*) FROM plots) as plots,
        (SELECT COUNT(*) FROM chapters) as chapters
    `);
    
    const count = counts[0];
    console.log(`  ✓ Projects: ${count.projects}`);
    console.log(`  ✓ Knowledge items: ${count.knowledge}`);
    console.log(`  ✓ Characters: ${count.characters}`);
    console.log(`  ✓ Plots: ${count.plots}`);
    console.log(`  ✓ Chapters: ${count.chapters}`);
    
    if (count.projects < 2 || count.knowledge < 5 || count.characters < 4) {
      throw new Error('Sample data count mismatch');
    }
  }

  /**
   * ビューのテスト
   */
  private async testViews(): Promise<void> {
    console.log('\n6. Testing views...');
    
    // active_projects_view のテスト
    const activeProjects = await this.query(
      'SELECT * FROM active_projects_view LIMIT 5'
    );
    
    if (activeProjects.length === 0) {
      throw new Error('active_projects_view returned no data');
    }
    
    console.log(`  ✓ active_projects_view: ${activeProjects.length} projects`);
    
    // recent_activities_view のテスト
    const recentActivities = await this.query(
      'SELECT * FROM recent_activities_view LIMIT 10'
    );
    
    console.log(`  ✓ recent_activities_view: ${recentActivities.length} activities`);
  }

  /**
   * パフォーマンステスト
   */
  private async testPerformance(): Promise<void> {
    console.log('\n7. Testing performance...');
    
    // 大量データ挿入のパフォーマンステスト
    const startTime = Date.now();
    const batchSize = 1000;
    
    // トランザクション開始
    await this.execute('BEGIN TRANSACTION');
    
    for (let i = 0; i < batchSize; i++) {
      await this.execute(
        `INSERT INTO knowledge (id, title, content, type) 
         VALUES (?, ?, ?, ?)`,
        [
          `perf-test-${i}`,
          `Performance Test ${i}`,
          `This is a performance test content ${i}`,
          'test'
        ]
      );
    }
    
    await this.execute('COMMIT');
    
    const insertTime = Date.now() - startTime;
    console.log(`  ✓ Inserted ${batchSize} rows in ${insertTime}ms`);
    console.log(`  ✓ Average: ${(insertTime / batchSize).toFixed(2)}ms per row`);
    
    // 検索パフォーマンステスト
    const searchStart = Date.now();
    const searchResults = await this.query(
      'SELECT COUNT(*) as count FROM knowledge WHERE type = ?',
      ['test']
    );
    const searchTime = Date.now() - searchStart;
    
    console.log(`  ✓ Search completed in ${searchTime}ms`);
    console.log(`  ✓ Found ${searchResults[0].count} rows`);
    
    // クリーンアップ
    await this.execute('DELETE FROM knowledge WHERE type = ?', ['test']);
  }

  /**
   * クエリ実行（結果を返す）
   */
  private query(sql: string, params: unknown[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * クエリ実行（結果を返さない）
   */
  private execute(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * クリーンアップ
   */
  private async cleanup(): Promise<void> {
    this.conn.close(() => {
      console.log('\nDatabase connection closed');
    });
  }
}

/**
 * テストを実行
 */
export async function runDatabaseTests(): Promise<void> {
  const testService = new DatabaseTestService();
  await testService.runAllTests();
}