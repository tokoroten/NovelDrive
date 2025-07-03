#!/usr/bin/env node

/**
 * API使用ログシステムのテスト
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';
import { ApiUsageLogger } from '../services/api-usage-logger';
import { DatabaseMigration } from '../services/database-migration';
import OpenAI from 'openai';

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

async function testAPILogging() {
  console.log('=== API Usage Logging Test ===\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY is not set');
    return;
  }
  
  const dbPath = path.join(getUserDataPath(), 'noveldrive.db');
  const db = new Database(dbPath);
  
  try {
    // データベースマイグレーション
    console.log('1. Running database migration...');
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    console.log('✓ Migration completed\n');
    
    // ApiUsageLoggerの初期化
    const logger = new ApiUsageLogger(db);
    
    // OpenAI APIクライアント
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // テスト1: チャット完了のログ
    console.log('2. Testing chat completion logging...');
    const chatStart = Date.now();
    
    try {
      const chatResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a creative writing assistant.' },
          { role: 'user', content: '星の物語のアイデアを3つ提案してください。' },
        ],
        max_tokens: 200,
      });
      
      const chatDuration = Date.now() - chatStart;
      
      // ログ記録
      await logger.logApiUsage({
        apiType: 'chat',
        provider: 'openai',
        model: chatResponse.model,
        operation: 'chat.completions.create',
        inputTokens: chatResponse.usage?.prompt_tokens || 0,
        outputTokens: chatResponse.usage?.completion_tokens || 0,
        totalTokens: chatResponse.usage?.total_tokens || 0,
        durationMs: chatDuration,
        status: 'success',
        requestData: {
          messages: 2,
          maxTokens: 200,
        },
        responseData: {
          choices: chatResponse.choices.length,
          finishReason: chatResponse.choices[0]?.finish_reason,
        },
      });
      
      console.log('✓ Chat completion logged successfully');
      console.log(`  Model: ${chatResponse.model}`);
      console.log(`  Tokens: ${chatResponse.usage?.total_tokens}`);
      console.log(`  Duration: ${chatDuration}ms`);
      
    } catch (error) {
      console.error('❌ Chat completion failed:', error);
      
      // エラーログの記録
      await logger.logApiUsage({
        apiType: 'chat',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        operation: 'chat.completions.create',
        durationMs: Date.now() - chatStart,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // テスト2: エンベディングのログ（実際には使わないが、ログシステムのテスト）
    console.log('\n3. Testing embedding logging (mock)...');
    
    // モックデータでログ記録
    await logger.log({
      apiType: 'embedding',
      provider: 'local',
      model: 'multilingual-e5-small',
      operation: 'generateEmbedding',
      inputTokens: 10,
      outputTokens: 0,
      totalTokens: 10,
      durationMs: 15,
      status: 'success',
      metadata: {
        dimensions: 384,
        text: '星降る夜の物語',
      },
    });
    
    console.log('✓ Embedding usage logged');
    
    // テスト3: 画像生成のログ（モック）
    console.log('\n4. Testing image generation logging (mock)...');
    
    await logger.log({
      apiType: 'image',
      provider: 'openai',
      model: 'dall-e-3',
      operation: 'images.generate',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0.04, // DALL-E 3の料金
      durationMs: 5000,
      status: 'success',
      requestData: {
        prompt: '星降る夜の幻想的な風景',
        size: '1024x1024',
        quality: 'standard',
      },
      responseData: {
        urls: 1,
      },
    });
    
    console.log('✓ Image generation logged');
    
    // 統計の確認
    console.log('\n5. Checking usage statistics...');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // 過去7日間
    const stats = await logger.getUsageStats(startDate);
    console.log('\nAPI Usage Summary:');
    
    for (const stat of stats) {
      console.log(`\n${stat.apiType || stat.apiType} (${stat.provider}):`);
      console.log(`  Model: ${stat.model || 'N/A'}`);
      console.log(`  Requests: ${stat.requestCount || stat.requestCount || 0} (Success: ${stat.successCount || stat.successCount || 0}, Error: ${stat.errorCount || stat.errorCount || 0})`);
      console.log(`  Tokens: ${stat.totalTokens || stat.totalTokens || 0}`);
      console.log(`  Total Cost: $${(stat.totalCost || stat.totalCost || 0).toFixed(4)}`);
      console.log(`  Avg Duration: ${Math.round(stat.avgDurationMs || stat.avgDurationMs || 0)}ms`);
    }
    
    // 最近のログ確認
    console.log('\n6. Recent API logs...');
    
    const recentLogs = await logger.getUsageByApi();
    console.log(`\nFound ${recentLogs.length} recent logs:`);
    
    recentLogs.forEach((log: any, i: number) => {
      console.log(`\n[${i + 1}] ${log.apiType || log.apiType}/${log.operation}`);
      console.log(`  Time: ${new Date().toLocaleString()}`); // ログには timestamp がないため現在時刻を表示
      console.log(`  Status: ${log.status}`);
      console.log(`  Tokens: ${log.totalTokens || log.totalTokens || 0}`);
      console.log(`  Cost: $${(log.estimatedCost || log.estimatedCost || 0).toFixed(4)}`);
    });
    
    console.log('\n✅ API logging test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    db.close();
    console.log('\nDatabase connection closed');
  }
}

// メイン実行
if (require.main === module) {
  testAPILogging().catch(console.error);
}