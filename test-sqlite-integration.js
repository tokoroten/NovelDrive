// SQLite3統合テスト
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('=== SQLite3 Integration Test ===\n');

try {
  // テスト用データベースを作成
  const dbPath = path.join(__dirname, 'test-integration.db');
  console.log(`1. Creating test database at: ${dbPath}`);
  
  // 既存のファイルを削除
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  const db = new Database(dbPath);
  console.log('✓ Database created successfully\n');
  
  // テーブルを作成
  console.log('2. Creating tables...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT,
      embedding TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ Tables created\n');
  
  // データを挿入
  console.log('3. Inserting test data...');
  const stmt = db.prepare('INSERT INTO knowledge (id, title, content, type) VALUES (?, ?, ?, ?)');
  
  const testData = [
    ['test-1', '星降る夜の物語', '美しい星空の下で繰り広げられる幻想的な物語', 'inspiration'],
    ['test-2', 'キャラクター設定：月影', '神秘的な力を持つ主人公', 'character'],
    ['test-3', '世界観：魔法の森', '古代の魔法が息づく神秘的な森', 'world']
  ];
  
  for (const data of testData) {
    stmt.run(...data);
  }
  console.log(`✓ Inserted ${testData.length} records\n`);
  
  // データを検索
  console.log('4. Querying data...');
  const rows = db.prepare('SELECT * FROM knowledge').all();
  console.log(`✓ Found ${rows.length} records:`);
  rows.forEach(row => {
    console.log(`  - ${row.title} (${row.type})`);
  });
  console.log('');
  
  // ベクトル埋め込みのシミュレーション
  console.log('5. Testing vector embedding storage...');
  const mockEmbedding = JSON.stringify(Array(384).fill(0).map(() => Math.random()));
  db.prepare('UPDATE knowledge SET embedding = ? WHERE id = ?').run(mockEmbedding, 'test-1');
  
  const withEmbedding = db.prepare('SELECT id, title, LENGTH(embedding) as embedding_size FROM knowledge WHERE embedding IS NOT NULL').get();
  console.log(`✓ Embedding stored: ${withEmbedding.title} (size: ${withEmbedding.embedding_size} bytes)\n`);
  
  // トランザクションテスト
  console.log('6. Testing transaction...');
  const transaction = db.transaction((items) => {
    for (const item of items) {
      stmt.run(...item);
    }
  });
  
  const newData = [
    ['test-4', 'トランザクションテスト1', 'テストデータ1', 'test'],
    ['test-5', 'トランザクションテスト2', 'テストデータ2', 'test']
  ];
  
  transaction(newData);
  console.log('✓ Transaction completed\n');
  
  // 最終的なレコード数
  const count = db.prepare('SELECT COUNT(*) as count FROM knowledge').get();
  console.log(`7. Final record count: ${count.count}`);
  
  // クリーンアップ
  db.close();
  console.log('\n✅ All tests passed!');
  
} catch (error) {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
}