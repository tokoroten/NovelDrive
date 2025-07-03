#!/usr/bin/env node

/**
 * 重み付きリランキングシステムのテストスクリプト
 */

import Database from "better-sqlite3";
import * as path from 'path';
import * as fs from 'fs';
import { WeightedReranking, RankingFactors } from '../services/weighted-reranking';

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

async function testWeightedReranking() {
  console.log('=== Weighted Reranking System Test ===\n');
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  try {
    // 1. リランキングシステムの初期化
    console.log('1. Initializing weighted reranking system...');
    
    const customWeights: RankingFactors = {
      vectorSimilarityWeight: 0.5,  // ベクトル類似度を重視
      textMatchWeight: 0.2,
      temporalDecayWeight: 0.1,
      diversityWeight: 0.1,
      projectRelevanceWeight: 0.05,
      typeMatchWeight: 0.05,
    };
    
    const reranker = new WeightedReranking(conn, customWeights);
    console.log('✓ Reranking system initialized with custom weights');
    console.log('  Weights:', reranker.getWeights());
    
    // 2. テスト用のモックembeddingを生成
    console.log('\n2. Generating mock embeddings for test data...');
    
    // 既存の知識アイテムにモックembeddingを設定
    const knowledgeItems = await new Promise<any[]>((resolve, reject) => {
      conn.all('SELECT id, title, content FROM knowledge LIMIT 10', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
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
    }
    
    console.log(`✓ Generated embeddings for ${knowledgeItems.length} items`);
    
    // 3. ハイブリッド検索テスト
    console.log('\n3. Testing hybrid search with reranking...');
    
    // テスト1: 「星」に関連する検索
    console.log('\n--- Test 1: Searching for "星の物語" ---');
    const query1 = "星の物語";
    const embedding1 = generateMockEmbedding(query1);
    
    const results1 = await reranker.hybridSearch(query1, embedding1, {
      limit: 5,
      minScore: 0,
    });
    
    console.log(`Found ${results1.length} results:`);
    results1.forEach((result, i) => {
      console.log(`\n[${i + 1}] ${result.title} (final score: ${result.finalScore.toFixed(3)})`);
      console.log(`    Vector: ${result.vectorScore.toFixed(3)}, Text: ${result.textScore.toFixed(3)}, Temporal: ${result.temporalScore.toFixed(3)}`);
      if (result.debugInfo) {
        console.log(`    Debug: Text matches: ${result.debugInfo.textMatches}, Days old: ${result.debugInfo.daysSinceCreation}`);
      }
    });
    
    // テスト2: 重みを変更した検索
    console.log('\n--- Test 2: Testing with different weight configurations ---');
    
    // テキストマッチ重視の設定
    const textFocusedWeights: RankingFactors = {
      vectorSimilarityWeight: 0.1,
      textMatchWeight: 0.7,    // テキストマッチを重視
      temporalDecayWeight: 0.1,
      diversityWeight: 0.05,
      projectRelevanceWeight: 0.025,
      typeMatchWeight: 0.025,
    };
    
    reranker.updateWeights(textFocusedWeights);
    console.log('\nUpdated weights (text-focused):', reranker.getWeights());
    
    const query2 = "AI";
    const embedding2 = generateMockEmbedding(query2);
    
    const results2 = await reranker.hybridSearch(query2, embedding2, { limit: 3 });
    
    console.log(`\nText-focused search for "${query2}":`);
    results2.forEach((result, i) => {
      console.log(`[${i + 1}] ${result.title} - Text score: ${result.textScore.toFixed(3)}`);
    });
    
    // 4. 多様性リランキングのテスト
    console.log('\n4. Testing diversity reranking...');
    
    // 多様性重視の設定
    const diversityWeights: RankingFactors = {
      vectorSimilarityWeight: 0.3,
      textMatchWeight: 0.3,
      temporalDecayWeight: 0.1,
      diversityWeight: 0.2,    // 多様性を重視
      projectRelevanceWeight: 0.05,
      typeMatchWeight: 0.05,
    };
    
    reranker.updateWeights(diversityWeights);
    
    const query3 = "創作";
    const embedding3 = generateMockEmbedding(query3);
    
    const results3 = await reranker.hybridSearch(query3, embedding3, { limit: 5 });
    
    console.log(`\nDiversity-focused search for "${query3}":`);
    results3.forEach((result, i) => {
      console.log(`[${i + 1}] ${result.title} (${result.type})`);
      if (result.debugInfo?.diversityPenalty) {
        console.log(`    Diversity penalty: ${result.debugInfo.diversityPenalty.toFixed(3)}`);
      }
    });
    
    // 5. プロジェクトスコープ検索のテスト
    console.log('\n5. Testing project-scoped search...');
    
    // プロジェクトIDを取得
    const projectResult = await new Promise<any>((resolve, reject) => {
      conn.all('SELECT id FROM projects LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (projectResult) {
      const results4 = await reranker.hybridSearch("物語", null, {
        limit: 3,
        projectId: projectResult.id,
      });
      
      console.log(`\nProject-scoped search results:`);
      results4.forEach((result, i) => {
        console.log(`[${i + 1}] ${result.title} - Project score: ${result.projectScore.toFixed(3)}`);
      });
    }
    
    // 6. パフォーマンステスト
    console.log('\n6. Performance test...');
    
    const perfQuery = "創作と物語のテクニック";
    const perfEmbedding = generateMockEmbedding(perfQuery);
    
    const startTime = Date.now();
    const perfResults = await reranker.hybridSearch(perfQuery, perfEmbedding, { limit: 20 });
    const searchTime = Date.now() - startTime;
    
    console.log(`Hybrid search with reranking completed in ${searchTime}ms`);
    console.log(`Processed ${perfResults.length} results`);
    
    console.log('\n✅ Weighted reranking test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Weighted reranking test failed:', error);
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
  testWeightedReranking().catch(console.error);
}