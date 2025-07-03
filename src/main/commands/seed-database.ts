#!/usr/bin/env node

/**
 * サンプルデータを投入するコマンドラインツール
 * 
 * 使用方法:
 * npm run db:seed
 */

import Database from "better-sqlite3";
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseMigration } from '../services/database-migration';
import { insertSampleData } from '../services/sample-data';

// Electronのapp.getPath()をモック
const getUserDataPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  const appDataDir = path.join(homeDir, '.noveldrive');
  
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  
  return appDataDir;
};

(global as any).app = {
  getPath: (name: string) => {
    if (name === 'userData') {
      return getUserDataPath();
    }
    return process.cwd();
  }
};

async function main() {
  console.log('=== NovelDrive Database Seeding ===\n');
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  console.log(`Database path: ${dbPath}`);
  
  // 確認プロンプト
  console.log('\n⚠️  Warning: This will insert sample data into your database.');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // データベース接続
    const db = new Database(dbPath);
    const conn = db.connect();
    
    // マイグレーションの確認
    console.log('Checking database schema...');
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    
    // サンプルデータの投入
    console.log('\nInserting sample data...');
    await insertSampleData(conn);
    
    // データ数の確認
    const counts = await new Promise<any>((resolve, reject) => {
      conn.all(`
        SELECT 
          (SELECT COUNT(*) FROM projects) as projects,
          (SELECT COUNT(*) FROM knowledge) as knowledge,
          (SELECT COUNT(*) FROM characters) as characters,
          (SELECT COUNT(*) FROM plots) as plots,
          (SELECT COUNT(*) FROM chapters) as chapters
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0]);
      });
    });
    
    console.log('\n📊 Data summary:');
    console.log(`  - Projects: ${counts.projects}`);
    console.log(`  - Knowledge items: ${counts.knowledge}`);
    console.log(`  - Characters: ${counts.characters}`);
    console.log(`  - Plots: ${counts.plots}`);
    console.log(`  - Chapters: ${counts.chapters}`);
    
    console.log('\n✅ Sample data inserted successfully!');
    
    // 接続を閉じる
    conn.close(() => {
      db.close(() => {
        console.log('Database connection closed');
      });
    });
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}