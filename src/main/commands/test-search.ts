#!/usr/bin/env node

/**
 * 全文検索（日本語トークナイザー）のテストスクリプト
 */

import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';
import { getSearchTokens } from '../services/japanese-tokenizer';

// ユーザーデータパスの取得
const getUserDataPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  const appDataDir = path.join(homeDir, '.noveldrive');
  
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  
  return appDataDir;
};

async function testFullTextSearch() {
  console.log('=== Full Text Search (Japanese Tokenizer) Test ===\n');
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  try {
    // 1. 日本語トークナイザーのテスト
    console.log('1. Testing Japanese tokenizer...');
    
    const testTexts = [
      '星降る夜の物語',
      '機械仕掛けの心臓',
      'AIと人間の共存',
      '創作のコツとテクニック',
      '月宮星羅は星の力を持つ少女です',
    ];
    
    console.log('\nTokenization results:');
    testTexts.forEach(text => {
      const tokens = getSearchTokens(text);
      console.log(`"${text}" => [${tokens.join(', ')}]`);
    });
    
    // 2. 全文検索インデックスの作成
    console.log('\n2. Creating full text search index...');
    
    // 検索用のテキストカラムを作成（タイトルと内容を結合）
    await new Promise<void>((resolve, reject) => {
      conn.run(`
        CREATE OR REPLACE VIEW knowledge_search_view AS
        SELECT 
          id,
          title,
          content,
          type,
          project_id,
          title || ' ' || content as search_text
        FROM knowledge
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✓ Search view created');
    
    // 3. 全文検索のテスト
    console.log('\n3. Testing full text search...');
    
    // テスト1: "星"を検索
    console.log('\n--- Test 1: Searching for "星" ---');
    const query1 = '星';
    const tokens1 = getSearchTokens(query1);
    console.log(`Search tokens: [${tokens1.join(', ')}]`);
    
    const results1 = await searchKnowledge(conn, tokens1);
    console.log(`Found ${results1.length} results:`);
    results1.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title}`);
      console.log(`    ${item.content.substring(0, 100)}...`);
    });
    
    // テスト2: "AI 感情"を検索
    console.log('\n--- Test 2: Searching for "AI 感情" ---');
    const query2 = 'AI 感情';
    const tokens2 = getSearchTokens(query2);
    console.log(`Search tokens: [${tokens2.join(', ')}]`);
    
    const results2 = await searchKnowledge(conn, tokens2);
    console.log(`Found ${results2.length} results:`);
    results2.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title}`);
      console.log(`    ${item.content.substring(0, 100)}...`);
    });
    
    // テスト3: フレーズ検索
    console.log('\n--- Test 3: Phrase search for "星の力" ---');
    const query3 = '星の力';
    const results3 = await searchKnowledgePhrase(conn, query3);
    console.log(`Found ${results3.length} results with exact phrase:`);
    results3.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title}`);
      const index = item.content.indexOf(query3);
      if (index >= 0) {
        const start = Math.max(0, index - 30);
        const end = Math.min(item.content.length, index + query3.length + 30);
        console.log(`    ...${item.content.substring(start, end)}...`);
      }
    });
    
    // 4. パフォーマンステスト
    console.log('\n4. Performance test...');
    const startTime = Date.now();
    
    const perfQuery = '物語 創作';
    const perfTokens = getSearchTokens(perfQuery);
    const perfResults = await searchKnowledge(conn, perfTokens);
    
    const searchTime = Date.now() - startTime;
    console.log(`Full text search completed in ${searchTime}ms`);
    console.log(`Found ${perfResults.length} results for "${perfQuery}"`);
    
    // 5. 検索結果のランキングテスト
    console.log('\n5. Testing search ranking...');
    const rankQuery = '星';
    const rankResults = await searchKnowledgeWithRanking(conn, rankQuery);
    
    console.log(`\nTop 5 results for "${rankQuery}" with relevance scores:`);
    rankResults.slice(0, 5).forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title} (score: ${item.score})`);
      console.log(`    Title matches: ${item.title_matches}, Content matches: ${item.content_matches}`);
    });
    
    console.log('\n✅ Full text search test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Full text search test failed:', error);
  } finally {
    conn.close(() => {
      db.close(() => {
        console.log('\nDatabase connection closed');
      });
    });
  }
}

// トークンベースの検索
async function searchKnowledge(conn: duckdb.Connection, tokens: string[]): Promise<any[]> {
  if (tokens.length === 0) return [];
  
  // LIKE句を使った簡易的な全文検索
  const likeConditions = tokens.map(() => '(title LIKE ? OR content LIKE ?)').join(' AND ');
  const params: string[] = [];
  tokens.forEach(token => {
    params.push(`%${token}%`, `%${token}%`);
  });
  
  const sql = `
    SELECT id, title, content, type
    FROM knowledge
    WHERE ${likeConditions}
    LIMIT 10
  `;
  
  return new Promise((resolve, reject) => {
    conn.all(sql, params, (err: any, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// フレーズ検索
async function searchKnowledgePhrase(conn: duckdb.Connection, phrase: string): Promise<any[]> {
  const sql = `
    SELECT id, title, content, type
    FROM knowledge
    WHERE title LIKE ? OR content LIKE ?
    LIMIT 10
  `;
  
  return new Promise((resolve, reject) => {
    conn.all(sql, [`%${phrase}%`, `%${phrase}%`], (err: any, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ランキング付き検索
async function searchKnowledgeWithRanking(conn: duckdb.Connection, query: string): Promise<any[]> {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return [];
  
  // スコアリング付きの検索
  const scoreExpressions: string[] = [];
  const params: string[] = [];
  
  tokens.forEach((token, i) => {
    scoreExpressions.push(`
      CASE WHEN title LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN content LIKE ? THEN 1 ELSE 0 END
    `);
    params.push(`%${token}%`, `%${token}%`);
  });
  
  // タイトルと内容での出現回数もカウント
  const countExpressions = tokens.map((token, i) => {
    params.push(`%${token}%`, `%${token}%`);
    return `
      (LENGTH(title) - LENGTH(REPLACE(LOWER(title), LOWER(?), ''))) / LENGTH(?) as title_matches_${i},
      (LENGTH(content) - LENGTH(REPLACE(LOWER(content), LOWER(?), ''))) / LENGTH(?) as content_matches_${i}
    `;
  });
  
  // パラメータを追加
  tokens.forEach(token => {
    params.push(token, token, token, token);
  });
  
  const sql = `
    SELECT 
      id,
      title,
      content,
      type,
      (${scoreExpressions.join(' + ')}) as score,
      ${tokens.map((_, i) => `title_matches_${i}`).join(' + ')} as title_matches,
      ${tokens.map((_, i) => `content_matches_${i}`).join(' + ')} as content_matches
    FROM (
      SELECT 
        id,
        title,
        content,
        type,
        ${countExpressions.join(',')}
      FROM knowledge
    )
    WHERE score > 0
    ORDER BY score DESC, title_matches DESC
    LIMIT 20
  `;
  
  return new Promise((resolve, reject) => {
    conn.all(sql, params, (err: any, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// メイン実行
if (require.main === module) {
  testFullTextSearch().catch(console.error);
}