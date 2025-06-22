#!/usr/bin/env node

/**
 * OpenAI API直接テストスクリプト
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

async function testOpenAIDirectly() {
  console.log('=== Direct OpenAI API Test ===\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: OPENAI_API_KEY is not set');
    return;
  }
  
  console.log('✓ API key found');
  console.log(`  Key length: ${apiKey.length} characters`);
  
  // OpenAIクライアントの初期化
  const openai = new OpenAI({
    apiKey: apiKey,
  });
  
  try {
    // 1. Embedding APIのテスト
    console.log('\n1. Testing Embedding API...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: '星降る夜の物語',
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    console.log(`  ✓ Embedding generated successfully`);
    console.log(`  Dimensions: ${embedding.length}`);
    console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`  Usage: ${embeddingResponse.usage?.total_tokens} tokens`);
    
    // 2. Chat Completion APIのテスト（オプション）
    console.log('\n2. Testing Chat Completion API...');
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'Say "API test successful" in Japanese.',
        },
      ],
      max_tokens: 50,
    });
    
    console.log(`  ✓ Chat completion successful`);
    console.log(`  Response: ${chatResponse.choices[0].message.content}`);
    console.log(`  Model: ${chatResponse.model}`);
    console.log(`  Usage: ${chatResponse.usage?.total_tokens} tokens`);
    
    // 3. 日本語の埋め込みテスト
    console.log('\n3. Testing Japanese text embeddings...');
    const japaneseTexts = [
      '創作支援ツール',
      'セレンディピティ',
      'AIエージェント',
    ];
    
    console.log('  Generating embeddings for Japanese texts...');
    for (const text of japaneseTexts) {
      const resp = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });
      console.log(`  ✓ "${text}" - ${resp.usage?.total_tokens} tokens`);
    }
    
    console.log('\n✅ All OpenAI API tests passed!');
    
  } catch (error: any) {
    console.error('\n❌ OpenAI API Error:', error.message);
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Details:', error.response.data);
    }
  }
}

// メイン実行
if (require.main === module) {
  testOpenAIDirectly().catch(console.error);
}