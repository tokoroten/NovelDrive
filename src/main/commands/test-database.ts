#!/usr/bin/env node

/**
 * データベーステストを実行するコマンドラインツール
 * 
 * 使用方法:
 * npx ts-node src/main/commands/test-database.ts
 */

import { app } from 'electron';
import * as path from 'path';
import * as duckdb from 'duckdb';
import { DatabaseMigration } from '../services/database-migration';
import { insertSampleData } from '../services/sample-data';
import { setupDuckDBVSS } from '../services/duckdb-vss-setup';
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
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  try {
    // マイグレーション実行
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    
    // VSS設定
    const vss = await setupDuckDBVSS(conn);
    
    // サンプルデータ投入
    await insertSampleData(conn);
    
    // ベクトル生成テスト
    console.log('Generating embeddings for knowledge items...');
    const generated = await vss.generateMissingEmbeddings(5);
    console.log(`Generated ${generated} embeddings`);
    
    // ベクトル検索テスト
    await vss.testVectorSearch();
    
  } finally {
    // DuckDBの接続を適切にクローズ
    try {
      await new Promise<void>((resolve) => {
        conn.close(() => {
          console.log('Connection closed');
          resolve();
        });
      });
    } catch (error) {
      console.warn('Error closing connection:', error);
    }
  }
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}