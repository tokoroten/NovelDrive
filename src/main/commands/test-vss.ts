#!/usr/bin/env node

/**
 * ベクトル検索（VSS）のテストスクリプト
 */

import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';
import { DuckDBVSSSetup } from '../services/duckdb-vss-setup';
import { generateEmbedding } from '../services/openai-service';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// ユーザーデータパスの取得
const getUserDataPath = () => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  const appDataDir = path.join(homeDir, '.noveldrive');
  
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  
  return appDataDir;
};

async function testVectorSearch() {
  console.log('=== VSS (Vector Similarity Search) Test ===\n');
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  try {
    // VSS設定
    console.log('1. Setting up DuckDB VSS...');
    const vss = new DuckDBVSSSetup(conn);
    await vss.setupVSS();
    
    // 既存の知識にベクトルを生成
    console.log('\n2. Generating embeddings for existing knowledge...');
    const generated = await vss.generateMissingEmbeddings(5);
    console.log(`Generated ${generated} embeddings`);
    
    // テスト用のクエリでベクトル検索
    console.log('\n3. Testing vector search...');
    
    // テスト1: "星の力"に関連する知識を検索
    console.log('\n--- Test 1: Searching for "星の力" ---');
    const query1 = "星の力を持つ少女の物語";
    const embedding1 = await generateEmbedding(query1);
    if (!embedding1) {
      console.log('Failed to generate embedding for query1');
      return;
    }
    const results1 = await vss.vectorSearch(embedding1, { limit: 3, threshold: 0.5 });
    
    console.log(`Found ${results1.length} results:`);
    results1.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title} (similarity: ${item.similarity.toFixed(3)})`);
      console.log(`    ${item.content.substring(0, 100)}...`);
    });
    
    // テスト2: "AI"に関連する知識を検索
    console.log('\n--- Test 2: Searching for "AI and emotions" ---');
    const query2 = "AIと感情、機械と人間の共存";
    const embedding2 = await generateEmbedding(query2);
    if (!embedding2) {
      console.log('Failed to generate embedding for query2');
      return;
    }
    const results2 = await vss.vectorSearch(embedding2, { limit: 3, threshold: 0.5 });
    
    console.log(`Found ${results2.length} results:`);
    results2.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title} (similarity: ${item.similarity.toFixed(3)})`);
      console.log(`    ${item.content.substring(0, 100)}...`);
    });
    
    // k-NN検索のテスト
    console.log('\n4. Testing k-NN search...');
    const query3 = "創作のコツとテクニック";
    const embedding3 = await generateEmbedding(query3);
    if (!embedding3) {
      console.log('Failed to generate embedding for query3');
      return;
    }
    const knnResults = await vss.knnSearch(embedding3, 5);
    
    console.log(`\nTop 5 nearest neighbors for "${query3}":`);
    knnResults.forEach((item, i) => {
      console.log(`\n[${i + 1}] ${item.title} (similarity: ${item.similarity.toFixed(3)})`);
    });
    
    // パフォーマンステスト
    console.log('\n5. Performance test...');
    const startTime = Date.now();
    const perfQuery = "物語の創作";
    const perfEmbedding = await generateEmbedding(perfQuery);
    if (!perfEmbedding) {
      console.log('Failed to generate embedding for performance test');
      return;
    }
    const perfResults = await vss.vectorSearch(perfEmbedding, { limit: 10 });
    const searchTime = Date.now() - startTime;
    
    console.log(`Vector search completed in ${searchTime}ms`);
    console.log(`Found ${perfResults.length} results`);
    
    console.log('\n✅ VSS test completed successfully!');
    
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
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is required');
    console.error('Please set it in your .env file or environment');
    process.exit(1);
  }
  
  testVectorSearch().catch(console.error);
}