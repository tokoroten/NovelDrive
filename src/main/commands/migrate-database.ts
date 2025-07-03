#!/usr/bin/env node

/**
 * データベースマイグレーションを実行するコマンドラインツール
 * 
 * 使用方法:
 * npm run db:migrate
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseMigration } from '../services/database-migration';

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
  console.log('=== NovelDrive Database Migration ===\n');
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  console.log(`Database path: ${dbPath}`);
  
  try {
    // データベース接続
    const db = new Database(dbPath);
    
    // マイグレーション実行
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    
    console.log('\n✅ Migration completed successfully!');
    
    // 接続を閉じる
    db.close();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}