import { LocalEmbeddingService } from '../services/local-embedding-service';
import { processAnythingBoxInput } from '../services/anything-box';
import { DatabaseMigration } from '../services/database-migration';
import * as duckdb from 'duckdb';

/**
 * AnythingBoxのローカル実装をテスト
 */
async function createTestDatabase() {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();
  
  // Create minimal required tables for testing
  await new Promise<void>((resolve, reject) => {
    conn.run(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR NOT NULL,
        project_id VARCHAR,
        embedding TEXT,
        metadata TEXT,
        search_tokens TEXT,
        source_url VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  return db;
}

async function main() {
  console.log('=== AnythingBox Test ===');
  
  try {
    // データベースの初期化
    console.log('Initializing database...');
    const db = await createTestDatabase();

    // ローカル埋め込みサービスの初期化
    console.log('Initializing local embedding service...');
    const embeddingService = LocalEmbeddingService.getInstance();
    await embeddingService.initialize();
    console.log('Embedding service initialized:', embeddingService.getModelInfo());

    // テスト入力
    const testInputs = [
      {
        content: '今日は天気が良くて、公園で桜を見ました。家族と一緒に過ごす春の日は最高です。',
        type: 'text' as const,
      },
      {
        content: '人工知能の研究が進み、創造的な作業も可能になってきた。小説を書くAIも登場している。',
        type: 'text' as const,
      },
      {
        content: 'https://example.com/interesting-article',
        type: 'url' as const,
      },
    ];

    for (const input of testInputs) {
      console.log(`\n=== Processing: ${input.content.substring(0, 50)}... ===`);
      
      const startTime = Date.now();
      const result = await processAnythingBoxInput(input);
      const processingTime = Date.now() - startTime;
      
      console.log(`Processing time: ${processingTime}ms`);
      console.log(`Original ID: ${result.original.id}`);
      console.log(`Type detected: ${result.original.type}`);
      console.log(`Inspirations found: ${result.inspirations.length}`);
      console.log(`Knowledge items created: ${result.knowledge.length}`);
      
      // インスピレーションの詳細
      if (result.inspirations.length > 0) {
        console.log('\nInspirations:');
        result.inspirations.forEach((insp, i) => {
          console.log(`  ${i + 1}. [${insp.type}] ${insp.content} (confidence: ${insp.confidence})`);
        });
      }
      
      // ナレッジの詳細
      if (result.knowledge.length > 0) {
        console.log('\nKnowledge items:');
        result.knowledge.forEach((item, i) => {
          console.log(`  ${i + 1}. [${item.type}] ${item.title}`);
          if (item.type !== 'original') {
            console.log(`     ${item.content.substring(0, 100)}...`);
          }
        });
      }
    }

    // 埋め込みベクトルのテスト
    console.log('\n=== Embedding Vector Test ===');
    const testText = '創造的な物語を書くことは楽しい';
    const embedding = await embeddingService.generateEmbedding(testText);
    console.log(`Text: "${testText}"`);
    console.log(`Embedding dimensions: ${embedding.length}`);
    console.log(`First 10 values: [${embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`);

    // 類似度計算のテスト
    console.log('\n=== Similarity Test ===');
    const text1 = '桜が美しく咲いている';
    const text2 = '桜の花が綺麗に咲いています';
    const text3 = 'プログラミングは楽しい';
    
    const embedding1 = await embeddingService.generateEmbedding(text1);
    const embedding2 = await embeddingService.generateEmbedding(text2);
    const embedding3 = await embeddingService.generateEmbedding(text3);
    
    const similarity12 = embeddingService.cosineSimilarity(embedding1, embedding2);
    const similarity13 = embeddingService.cosineSimilarity(embedding1, embedding3);
    
    console.log(`"${text1}" vs "${text2}": ${similarity12.toFixed(4)}`);
    console.log(`"${text1}" vs "${text3}": ${similarity13.toFixed(4)}`);
    console.log('(Higher values indicate more similarity)');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // クリーンアップ
    const embeddingService = LocalEmbeddingService.getInstance();
    await embeddingService.cleanup();
    process.exit(0);
  }
}

// 直接実行された場合のみ実行
if (require.main === module) {
  main();
}