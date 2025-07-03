#!/usr/bin/env node

/**
 * ハイブリッド検索システムの統合テスト
 */

import Database from "better-sqlite3";
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { WeightedReranking, RankingFactors } from '../services/weighted-reranking';
import { generateEmbedding } from '../services/openai-service';

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

async function testHybridSearch() {
  console.log('=== Hybrid Search System Integration Test ===\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY is not set');
    return;
  }
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  const db = new duckdb.Database(dbPath);
  const conn = db.connect();
  
  try {
    // 1. 既存の知識に実際のembeddingを生成
    console.log('1. Generating real embeddings for knowledge items...');
    
    const knowledgeItems = await new Promise<any[]>((resolve, reject) => {
      conn.all('SELECT id, title, content FROM knowledge WHERE embedding IS NULL LIMIT 5', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`Found ${knowledgeItems.length} items without embeddings`);
    
    for (const item of knowledgeItems) {
      try {
        const text = `${item.title} ${item.content}`;
        console.log(`  Generating embedding for: ${item.title}`);
        
        const embedding = await generateEmbedding(text);
        if (embedding) {
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
          
          console.log(`    ✓ Success`);
        }
      } catch (error) {
        console.log(`    ❌ Failed: ${error}`);
      }
    }
    
    // 2. ハイブリッド検索のテスト
    console.log('\n2. Testing hybrid search with real embeddings...');
    
    const reranker = new WeightedReranking(conn);
    
    // テスト1: 「星」に関連する検索
    console.log('\n--- Test 1: Searching for "星の物語" ---');
    const query1 = "星の物語";
    const embedding1 = await generateEmbedding(query1);
    
    if (embedding1) {
      const results1 = await reranker.hybridSearch(query1, embedding1, {
        limit: 5,
        minScore: 0,
      });
      
      console.log(`Found ${results1.length} results:`);
      results1.forEach((result, i) => {
        console.log(`\n[${i + 1}] ${result.title}`);
        console.log(`  Final Score: ${result.finalScore.toFixed(3)}`);
        console.log(`  Vector: ${result.vectorScore.toFixed(3)}, Text: ${result.textScore.toFixed(3)}, Temporal: ${result.temporalScore.toFixed(3)}`);
        console.log(`  Content preview: ${result.content.substring(0, 100)}...`);
      });
    }
    
    // テスト2: 創作支援に関する検索
    console.log('\n--- Test 2: Searching for "創作支援" ---');
    const query2 = "創作支援ツール";
    const embedding2 = await generateEmbedding(query2);
    
    if (embedding2) {
      const results2 = await reranker.hybridSearch(query2, embedding2, {
        limit: 3,
      });
      
      console.log(`Found ${results2.length} results:`);
      results2.forEach((result, i) => {
        console.log(`\n[${i + 1}] ${result.title} (${result.type})`);
        console.log(`  Scores - V: ${result.vectorScore.toFixed(3)}, T: ${result.textScore.toFixed(3)}, Final: ${result.finalScore.toFixed(3)}`);
      });
    }
    
    // 3. 重み設定を変えた検索
    console.log('\n3. Testing with different weight configurations...');
    
    // セレンディピティ重視の設定
    const serendipityWeights: RankingFactors = {
      vectorSimilarityWeight: 0.2,
      textMatchWeight: 0.1,
      temporalDecayWeight: 0.1,
      diversityWeight: 0.4,    // 多様性を重視
      projectRelevanceWeight: 0.1,
      typeMatchWeight: 0.1,
    };
    
    reranker.updateWeights(serendipityWeights);
    console.log('\nSerendipity-focused weights applied');
    
    const query3 = "物語";
    const embedding3 = await generateEmbedding(query3);
    
    if (embedding3) {
      const results3 = await reranker.hybridSearch(query3, embedding3, {
        limit: 5,
      });
      
      console.log(`\nSerendipity search for "${query3}":`);
      results3.forEach((result, i) => {
        console.log(`[${i + 1}] ${result.title} - Type: ${result.type}`);
        if (result.debugInfo?.diversityPenalty) {
          console.log(`    Diversity applied: ${result.debugInfo.diversityPenalty.toFixed(3)}`);
        }
      });
    }
    
    // 4. テキストなしでベクトル検索のみ
    console.log('\n4. Testing pure vector search (no text query)...');
    
    const conceptEmbedding = await generateEmbedding("innovative creative writing techniques");
    if (conceptEmbedding) {
      const vectorOnlyResults = await reranker.hybridSearch("", conceptEmbedding, {
        limit: 3,
      });
      
      console.log('\nPure vector search results:');
      vectorOnlyResults.forEach((result, i) => {
        console.log(`[${i + 1}] ${result.title} - Vector score: ${result.vectorScore.toFixed(3)}`);
      });
    }
    
    // 5. パフォーマンス測定
    console.log('\n5. Performance measurement...');
    
    const perfQuery = "AIエージェントによる創作支援";
    const perfEmbedding = await generateEmbedding(perfQuery);
    
    if (perfEmbedding) {
      const startTime = Date.now();
      const perfResults = await reranker.hybridSearch(perfQuery, perfEmbedding, {
        limit: 20,
      });
      const searchTime = Date.now() - startTime;
      
      console.log(`\nHybrid search completed in ${searchTime}ms`);
      console.log(`Processed ${perfResults.length} results`);
      
      // Top 3 results
      console.log('\nTop 3 results:');
      perfResults.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.title} (${result.finalScore.toFixed(3)})`);
      });
    }
    
    console.log('\n✅ Hybrid search integration test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Hybrid search test failed:', error);
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
  testHybridSearch().catch(console.error);
}