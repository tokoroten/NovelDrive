#!/usr/bin/env electron

/**
 * Electron環境でデータベースマイグレーションを実行
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// TypeScriptファイルを直接requireするために必要
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs'
  }
});

const { DatabaseMigration } = require('../services/database-migration');
const Database = require('better-sqlite3');

app.whenReady().then(async () => {
  console.log('=== NovelDrive Database Migration (Electron) ===\n');
  
  const dbPath = path.join(app.getPath('userData'), 'noveldrive.db');
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
    
    app.quit();
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    app.exit(1);
  }
});