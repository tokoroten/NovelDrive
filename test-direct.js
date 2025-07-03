// Direct test without Electron
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('=== Direct SQLite3 Test (No Electron) ===\n');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('');

// Test 1: Basic SQLite3 functionality
console.log('1. Testing basic SQLite3 functionality...');
try {
  const testDb = new Database(':memory:');
  testDb.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
  const stmt = testDb.prepare('INSERT INTO test (value) VALUES (?)');
  stmt.run('Hello SQLite3!');
  const result = testDb.prepare('SELECT * FROM test').get();
  console.log('✓ Basic test passed:', result);
  testDb.close();
} catch (error) {
  console.error('✗ Basic test failed:', error.message);
  process.exit(1);
}

// Test 2: File-based database
console.log('\n2. Testing file-based database...');
const dbPath = path.join(__dirname, 'test-direct.db');
try {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  const db = new Database(dbPath);
  
  // Create tables similar to NovelDrive
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS knowledge (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT,
      project_id TEXT,
      embedding TEXT,
      metadata TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `);
  
  console.log('✓ Tables created successfully');
  
  // Insert test data
  const projectStmt = db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)');
  projectStmt.run('test-project-1', 'テストプロジェクト', 'SQLite3移行のテスト');
  
  const knowledgeStmt = db.prepare('INSERT INTO knowledge (id, title, content, type, project_id) VALUES (?, ?, ?, ?, ?)');
  knowledgeStmt.run('test-knowledge-1', '星降る夜', '美しい星空の描写', 'inspiration', 'test-project-1');
  
  console.log('✓ Test data inserted');
  
  // Query data
  const projects = db.prepare('SELECT * FROM projects').all();
  const knowledge = db.prepare('SELECT * FROM knowledge').all();
  
  console.log(`✓ Found ${projects.length} projects and ${knowledge.length} knowledge items`);
  
  // Test ConnectionManager-like operations
  console.log('\n3. Testing ConnectionManager-like operations...');
  
  // Transaction test
  const transaction = db.transaction((items) => {
    const stmt = db.prepare('INSERT INTO knowledge (id, title, content, type) VALUES (?, ?, ?, ?)');
    for (const item of items) {
      stmt.run(...item);
    }
  });
  
  transaction([
    ['test-knowledge-2', 'トランザクションテスト1', 'テストコンテンツ1', 'test'],
    ['test-knowledge-3', 'トランザクションテスト2', 'テストコンテンツ2', 'test']
  ]);
  
  console.log('✓ Transaction completed');
  
  // Final count
  const count = db.prepare('SELECT COUNT(*) as count FROM knowledge').get();
  console.log(`✓ Total knowledge items: ${count.count}`);
  
  db.close();
  console.log('\n✅ All tests passed!');
  
  // Cleanup
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
} catch (error) {
  console.error('✗ Test failed:', error);
  process.exit(1);
}

console.log('\n4. Testing import of compiled modules...');
try {
  const { ConnectionManager } = require('./dist/main/main/core/database/connection-manager.js');
  console.log('✓ ConnectionManager imported successfully');
  
  const manager = ConnectionManager.getInstance();
  console.log('✓ ConnectionManager instance created');
  
} catch (error) {
  console.error('✗ Module import failed:', error.message);
  console.log('Make sure to run "npm run build:main" first');
}