import { LocalEmbeddingService } from '../services/local-embedding-service';
import Database from 'better-sqlite3';
import * as path from 'path';
import { DatabaseMigration } from '../services/database-migration';
import { ApiUsageLogger } from '../services/api-usage-logger';

/**
 * ローカル埋め込みサービスのテスト
 */
async function testLocalEmbedding() {
  console.log('=== Local Embedding Service Test ===\n');
  
  // データベースの初期化
  const dbPath = path.join(process.cwd(), 'test-local-embedding.db');
  const db = new Database(dbPath);
  
  try {
    // マイグレーションの実行
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    
    // API使用ログサービスの初期化
    const logger = new ApiUsageLogger(db);
    
    // ローカル埋め込みサービスの初期化
    const embeddingService = LocalEmbeddingService.getInstance();
    
    console.log('1. Initializing local embedding service...');
    await embeddingService.initialize();
    
    const modelInfo = embeddingService.getModelInfo();
    console.log('Model info:', modelInfo);
    console.log();
    
    // テストテキスト（日本語と英語）
    const testTexts = [
      '人工知能は私たちの生活を大きく変えています。',
      'Artificial intelligence is transforming our lives.',
      '東京は日本の首都で、世界でも有数の大都市です。',
      'こんにちは、世界！',
      'The quick brown fox jumps over the lazy dog.',
    ];
    
    console.log('2. Generating embeddings for test texts...');
    
    for (const text of testTexts) {
      const startTime = Date.now();
      
      try {
        const embedding = await embeddingService.generateEmbedding(text);
        const duration = Date.now() - startTime;
        
        console.log(`\nText: "${text}"`);
        console.log(`Embedding dimensions: ${embedding.length}`);
        console.log(`First 10 values: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log(`Duration: ${duration}ms`);
        
        // API使用をログに記録
        await logger.logApiUsage({
          apiType: 'embedding',
          provider: 'local',
          model: modelInfo.modelName,
          operation: 'generateEmbedding',
          inputTokens: Math.ceil(text.length / 4), // 概算
          totalTokens: Math.ceil(text.length / 4),
          durationMs: duration,
          status: 'success',
          requestData: { text: text.substring(0, 50) },
          responseData: { dimensions: embedding.length }
        });
      } catch (error) {
        console.error(`Error generating embedding: ${error}`);
        
        // エラーをログに記録
        await logger.logApiUsage({
          apiType: 'embedding',
          provider: 'local',
          model: modelInfo.modelName,
          operation: 'generateEmbedding',
          durationMs: Date.now() - startTime,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
          requestData: { text: text.substring(0, 50) }
        });
      }
    }
    
    console.log('\n3. Testing batch embedding generation...');
    const batchStartTime = Date.now();
    
    try {
      const embeddings = await embeddingService.generateEmbeddings(testTexts);
      const batchDuration = Date.now() - batchStartTime;
      
      console.log(`Generated ${embeddings.length} embeddings in ${batchDuration}ms`);
      console.log(`Average time per embedding: ${(batchDuration / embeddings.length).toFixed(2)}ms`);
      
      // バッチ処理をログに記録
      await logger.log({
        apiType: 'embedding',
        provider: 'local',
        model: modelInfo.modelName,
        operation: 'generateEmbeddingsBatch',
        inputTokens: testTexts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
        totalTokens: testTexts.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0),
        durationMs: batchDuration,
        status: 'success',
        requestData: { textCount: testTexts.length },
        responseData: { embeddingCount: embeddings.length, dimensions: embeddings[0]?.length }
      });
    } catch (error) {
      console.error(`Error in batch embedding: ${error}`);
    }
    
    console.log('\n4. Testing similarity calculation...');
    const embedding1 = await embeddingService.generateEmbedding('人工知能は素晴らしい技術です。');
    const embedding2 = await embeddingService.generateEmbedding('AIは素晴らしいテクノロジーです。');
    const embedding3 = await embeddingService.generateEmbedding('今日はいい天気ですね。');
    
    const similarity1_2 = embeddingService.cosineSimilarity(embedding1, embedding2);
    const similarity1_3 = embeddingService.cosineSimilarity(embedding1, embedding3);
    
    console.log(`Similarity between "人工知能は素晴らしい技術です" and "AIは素晴らしいテクノロジーです": ${similarity1_2.toFixed(4)}`);
    console.log(`Similarity between "人工知能は素晴らしい技術です" and "今日はいい天気ですね": ${similarity1_3.toFixed(4)}`);
    
    console.log('\n5. API usage summary...');
    const stats = await logger.getUsageStats();
    
    console.log('\nLocal embedding usage:');
    const localStats = stats.filter(s => s.provider === 'local');
    for (const stat of localStats) {
      console.log(`- ${stat.apiType}: ${stat.requestCount} requests, ${stat.totalTokens} tokens, avg ${stat.avgDurationMs.toFixed(0)}ms`);
    }
    
    console.log('\n6. Cleanup...');
    await embeddingService.cleanup();
    
    console.log('\n=== Test completed successfully! ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // データベースのクローズ
    db.close();
  }
}

// テストの実行
if (require.main === module) {
  testLocalEmbedding().catch(console.error);
}