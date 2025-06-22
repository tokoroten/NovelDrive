import { LocalEmbeddingService } from './src/main/services/local-embedding-service';

/**
 * シンプルなローカル埋め込みサービスのテスト（APIログなし）
 */
async function testLocalEmbeddingSimple() {
  console.log('=== Simple Local Embedding Service Test ===\n');
  
  try {
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
    ];
    
    console.log('2. Generating embeddings for test texts...');
    
    for (const text of testTexts) {
      const startTime = Date.now();
      
      try {
        console.log(`\nText: "${text}"`);
        
        const embedding = await embeddingService.generateEmbedding(text);
        const duration = Date.now() - startTime;
        
        console.log(`Embedding dimensions: ${embedding.length}`);
        console.log(`First 10 values: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`);
        console.log(`Duration: ${duration}ms`);
        
      } catch (error) {
        console.error('Error generating embedding:', error);
        throw error;
      }
    }
    
    console.log('\n✅ All embedding tests passed!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  testLocalEmbeddingSimple().catch(console.error);
}