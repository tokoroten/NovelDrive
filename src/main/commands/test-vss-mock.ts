#!/usr/bin/env node

/**
 * ベクトル検索（VSS）のテストスクリプト（モック版）
 * OpenAI APIを使わずにローカルでテスト
 */

import Database from "better-sqlite3";
import * as path from 'path';
import * as fs from 'fs';

// ユーザーデータパスの取得
const getUserDataPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  const appDataDir = path.join(homeDir, '.noveldrive');
  
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  
  return appDataDir;
};

// モック埋め込みベクトルの生成（1536次元）
function generateMockEmbedding(text: string): number[] {
  const embedding = new Array(1536).fill(0);
  
  // テキストの特徴を簡単にベクトル化（実際のembeddingの代わり）
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  for (let i = 0; i < 1536; i++) {
    // ハッシュ値と位置に基づいて決定的な値を生成
    const seed = (hash + i) * 2654435761; // 黄金比の逆数の整数部分
    embedding[i] = (Math.sin(seed) + 1) / 2; // 0-1の範囲に正規化
  }
  
  // 特定のキーワードに反応させる
  if (text.includes('星')) {
    for (let i = 0; i < 100; i++) {
      embedding[i] += 0.3;
    }
  }
  if (text.includes('AI') || text.includes('機械')) {
    for (let i = 100; i < 200; i++) {
      embedding[i] += 0.3;
    }
  }
  if (text.includes('創作') || text.includes('物語')) {
    for (let i = 200; i < 300; i++) {
      embedding[i] += 0.3;
    }
  }
  
  // 正規化
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function testVectorSearchWithMock() {
  console.log('=== VSS (Vector Similarity Search) Test with Mock ===\n');
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  try {
    // 既存の知識にモックベクトルを生成
    console.log('1. Generating mock embeddings for knowledge items...');
    
    // 知識を取得
    const knowledgeItems = await new Promise<any[]>((resolve, reject) => {
      conn.all('SELECT id, title, content FROM knowledge WHERE embedding IS NULL LIMIT 10', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${knowledgeItems.length} items without embeddings`);
    
    // モックembeddingを生成して更新
    for (const item of knowledgeItems) {
      const text = `${item.title} ${item.content}`;
      const embedding = generateMockEmbedding(text);
      const embeddingStr = `[${embedding.join(',')}]`;
      
      await new Promise<void>((resolve, reject) => {
        conn.run(
          'UPDATE knowledge SET embedding = ?::FLOAT[] WHERE id = ?',
          [embeddingStr, item.id],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      console.log(`✓ Generated embedding for: ${item.title}`);
    }
    
    // コサイン類似度関数をSQL UDFとして作成
    console.log('\n2. Creating cosine similarity function...');
    await new Promise<void>((resolve, reject) => {
      conn.run(`
        CREATE OR REPLACE MACRO cosine_similarity(vec1, vec2) AS (
          list_reduce(
            list_zip(vec1, vec2),
            (acc, x) -> acc + (x[1] * x[2]),
            0.0
          ) / (
            sqrt(list_reduce(vec1, (acc, x) -> acc + (x * x), 0.0)) *
            sqrt(list_reduce(vec2, (acc, x) -> acc + (x * x), 0.0))
          )
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // ベクトル検索のテスト
    console.log('\n3. Testing vector search...');
    
    // テスト1: "星"に関連する検索
    console.log('\n--- Test 1: Searching for "星" related content ---');
    const query1 = "星の力を持つ少女の物語";
    const embedding1 = generateMockEmbedding(query1);
    const embeddingStr1 = `[${embedding1.join(',')}]`;
    
    const results1 = await new Promise<any[]>((resolve, reject) => {
      conn.all(`
        SELECT 
          id,
          title,
          content,
          type,
          cosine_similarity(embedding::FLOAT[], ${embeddingStr1}::FLOAT[]) as similarity
        FROM knowledge
        WHERE embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 5
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${results1.length} results:`);
    results1.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title} (similarity: ${item.similarity.toFixed(3)})`);
      console.log(`    ${item.content.substring(0, 100)}...`);
    });
    
    // テスト2: "AI"に関連する検索
    console.log('\n--- Test 2: Searching for "AI" related content ---');
    const query2 = "AIと感情、機械と人間の共存";
    const embedding2 = generateMockEmbedding(query2);
    const embeddingStr2 = `[${embedding2.join(',')}]`;
    
    const results2 = await new Promise<any[]>((resolve, reject) => {
      conn.all(`
        SELECT 
          id,
          title,
          content,
          type,
          cosine_similarity(embedding::FLOAT[], ${embeddingStr2}::FLOAT[]) as similarity
        FROM knowledge
        WHERE embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 5
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${results2.length} results:`);
    results2.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title} (similarity: ${item.similarity.toFixed(3)})`);
      console.log(`    ${item.content.substring(0, 100)}...`);
    });
    
    // パフォーマンステスト
    console.log('\n4. Performance test...');
    const startTime = Date.now();
    
    const perfQuery = "創作と物語のテクニック";
    const perfEmbedding = generateMockEmbedding(perfQuery);
    const perfEmbeddingStr = `[${perfEmbedding.join(',')}]`;
    
    const perfResults = await new Promise<any[]>((resolve, reject) => {
      conn.all(`
        SELECT 
          id,
          title,
          cosine_similarity(embedding::FLOAT[], ${perfEmbeddingStr}::FLOAT[]) as similarity
        FROM knowledge
        WHERE embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 10
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const searchTime = Date.now() - startTime;
    console.log(`Vector search completed in ${searchTime}ms`);
    console.log(`Found ${perfResults.length} results`);
    
    console.log('\n✅ VSS test with mock completed successfully!');
    
  } catch (error) {
    console.error('\n❌ VSS test failed:', error);
  } finally {
    conn.close(() => {
      db.close(() => {
        console.log('\nDatabase connection closed');
      });
    });
  }
}

// メイン実行
if (require.main === module) {
  testVectorSearchWithMock().catch(console.error);
}