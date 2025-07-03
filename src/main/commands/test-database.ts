#!/usr/bin/env node

/**
 * データベーステストを実行するコマンドラインツール
 * 
 * 使用方法:
 * npx ts-node src/main/commands/test-database.ts
 */

import { app } from 'electron';
import * as path from 'path';
import Database from 'better-sqlite3';
import { DatabaseMigration } from '../services/database-migration';
import { insertSampleData } from '../services/sample-data';
import { VectorSearchService } from '../services/vector-search-service';
import { runDatabaseTests } from '../services/database-test';

// Electronのapp.getPath()をモック
if (!app || !app.getPath) {
  const mockApp = {
    getPath: (name: string) => {
      if (name === 'userData') {
        return path.join(process.cwd(), '.test-data');
      }
      return process.cwd();
    }
  };
  (global as any).app = mockApp;
  // Direct export override for this module
  module.exports.app = mockApp;
}

async function main() {
  console.log('=== NovelDrive Database Test Suite ===\n');
  console.log('This will test all database functionalities including:');
  console.log('- Database migration');
  console.log('- Sample data insertion');
  console.log('- Vector search (DuckDB VSS)');
  console.log('- All CRUD operations\n');

  try {
    // 1. 基本的なデータベーステスト
    console.log('Running basic database tests...\n');
    await runDatabaseTests();
    
    // 2. ベクトル検索のテスト
    console.log('\n\nRunning vector search tests...\n');
    await testVectorSearch();
    
    console.log('\n\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n\n❌ Test failed:', error);
    process.exit(1);
  }
}

async function testVectorSearch() {
  const dbPath = path.join((global as any).app.getPath('userData'), 'vss-test.db');
  const db = new Database(dbPath);
  
  try {
    // マイグレーション実行
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    
    // VSS設定
    const vss = new VectorSearchService(db);
    
    // サンプルデータ投入
    await insertSampleData(db);
    
    // ベクトル生成テスト
    console.log('Generating embeddings for knowledge items...');
    const generated = await vss.generateMissingEmbeddings(5);
    console.log(`Generated ${generated} embeddings`);
    
    // ベクトル検索テスト
    await vss.testVectorSearch();
    
  } finally {
    // SQLite3の接続を閉じる
    try {
      db.close();
      console.log('Database closed');
    } catch (error) {
      console.warn('Error closing database:', error);
    }
  }
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}