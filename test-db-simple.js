const duckdb = require('duckdb');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'test.db');

// 既存のDBを削除
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new duckdb.Database(dbPath);
const conn = db.connect();

console.log('Testing DuckDB...');

// シンプルなテーブル作成
conn.run(`
  CREATE TABLE test_table (
    id INTEGER PRIMARY KEY,
    name VARCHAR
  )
`, (err) => {
  if (err) {
    console.error('Create table error:', err);
    return;
  }
  
  console.log('✓ Table created');
  
  // データ挿入
  conn.run('INSERT INTO test_table VALUES (1, ?)', ['Test Name'], (err) => {
    if (err) {
      console.error('Insert error:', err);
      return;
    }
    
    console.log('✓ Data inserted');
    
    // データ取得
    conn.all('SELECT * FROM test_table', (err, rows) => {
      if (err) {
        console.error('Select error:', err);
        return;
      }
      
      console.log('✓ Data retrieved:', rows);
      
      conn.close(() => {
        console.log('✓ Connection closed');
      });
    });
  });
});