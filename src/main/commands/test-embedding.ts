#!/usr/bin/env node

/**
 * OpenAI Embedding APIのテストスクリプト
 */

import dotenv from 'dotenv';
import { generateEmbedding } from '../services/openai-service';

// 環境変数の読み込み
dotenv.config();

async function testEmbedding() {
  console.log('=== OpenAI Embedding Test ===\n');
  
  // APIキーの確認
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY is not set in environment variables');
    return;
  }
  
  console.log('✓ API key found');
  console.log(`  Key prefix: ${apiKey.substring(0, 10)}...`);
  
  // テストテキスト
  const testTexts = [
    '星降る夜の物語',
    '機械仕掛けの心臓',
    'AIと人間の共存',
    '創作のコツとテクニック',
    '月宮星羅は星の力を持つ少女です',
  ];
  
  console.log('\nGenerating embeddings for test texts...\n');
  
  for (const text of testTexts) {
    try {
      console.log(`Testing: "${text}"`);
      const startTime = Date.now();
      
      const embedding = await generateEmbedding(text);
      
      if (embedding) {
        const elapsed = Date.now() - startTime;
        console.log(`  ✓ Success! Dimension: ${embedding.length}, Time: ${elapsed}ms`);
        console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
      } else {
        console.log('  ❌ Failed to generate embedding');
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }
    
    console.log('');
  }
  
  // コサイン類似度のテスト
  console.log('Testing cosine similarity...');
  
  try {
    const embed1 = await generateEmbedding('星の力を持つ少女');
    const embed2 = await generateEmbedding('星降る夜の物語');
    const embed3 = await generateEmbedding('機械学習とディープラーニング');
    
    if (embed1 && embed2 && embed3) {
      const cosineSimilarity = (a: number[], b: number[]) => {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magA * magB);
      };
      
      const sim1_2 = cosineSimilarity(embed1, embed2);
      const sim1_3 = cosineSimilarity(embed1, embed3);
      
      console.log('\n  Similarity results:');
      console.log(`  "星の力を持つ少女" vs "星降る夜の物語": ${sim1_2.toFixed(4)}`);
      console.log(`  "星の力を持つ少女" vs "機械学習とディープラーニング": ${sim1_3.toFixed(4)}`);
      console.log(`\n  ${sim1_2 > sim1_3 ? '✓' : '❌'} Star-related texts are more similar than unrelated texts`);
    }
  } catch (error) {
    console.error('Similarity test failed:', error);
  }
  
  console.log('\n✅ Embedding test completed!');
}

// メイン実行
if (require.main === module) {
  testEmbedding().catch(console.error);
}