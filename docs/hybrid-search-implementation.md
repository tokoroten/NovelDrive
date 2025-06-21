# NovelDrive ハイブリッド検索実装

参考記事: https://voluntas.ghost.io/duckdb-hybrid-search/

## 概要

NovelDriveでは、以下の3つの検索手法を組み合わせたハイブリッド検索を実装します：

1. **全文検索（FTS）**: キーワードマッチング
2. **ベクトル検索（VSS）**: 意味的類似性
3. **セレンディピティ検索**: 創造的な発見

## TypeScript実装

```typescript
interface SearchOptions {
  mode: 'normal' | 'serendipity' | 'hybrid';
  weights?: {
    fts: number;
    vss: number;
    serendipity: number;
  };
  limit?: number;
}

class HybridSearchService {
  constructor(
    private db: DuckDB.Database,
    private embeddingService: MultilingualEmbeddingService
  ) {}

  async search(query: string, options: SearchOptions = { mode: 'hybrid' }) {
    const queryEmbedding = await this.embeddingService.embed(query);
    
    switch (options.mode) {
      case 'normal':
        return this.normalSearch(query, queryEmbedding);
      case 'serendipity':
        return this.serendipitySearch(query, queryEmbedding);
      case 'hybrid':
        return this.hybridSearch(query, queryEmbedding, options);
    }
  }

  private async hybridSearch(
    query: string, 
    queryEmbedding: number[],
    options: SearchOptions
  ) {
    const weights = options.weights || {
      fts: 0.3,
      vss: 0.5,
      serendipity: 0.2
    };

    const results = await this.db.all(`
      WITH 
      -- 全文検索
      fts_results AS (
        SELECT 
          n.id, 
          n.content,
          fts.rank as bm25_score,
          'fts' as source
        FROM nodes n
        JOIN nodes_fts fts ON n.id = fts.rowid
        WHERE nodes_fts MATCH ?
        ORDER BY rank DESC
        LIMIT 30
      ),
      
      -- ベクトル検索
      vss_results AS (
        SELECT 
          id, 
          content,
          1 - array_cosine_distance(embeddings, ?::FLOAT[1024]) as similarity_score,
          'vss' as source
        FROM nodes
        WHERE embeddings IS NOT NULL
        ORDER BY embeddings <=> ?::FLOAT[1024]
        LIMIT 30
      ),
      
      -- セレンディピティ検索（ノイズ付きベクトル検索）
      serendipity_results AS (
        SELECT 
          id,
          content,
          1 - array_cosine_distance(embeddings, ?::FLOAT[1024]) as serendipity_score,
          'serendipity' as source
        FROM nodes
        WHERE embeddings IS NOT NULL
          AND array_cosine_distance(embeddings, ?::FLOAT[1024]) BETWEEN 0.3 AND 0.7
        ORDER BY random()
        LIMIT 20
      ),
      
      -- すべての結果をマージ
      all_results AS (
        SELECT id, content, bm25_score, 0 as similarity_score, 0 as serendipity_score, source
        FROM fts_results
        UNION ALL
        SELECT id, content, 0, similarity_score, 0, source
        FROM vss_results
        UNION ALL
        SELECT id, content, 0, 0, serendipity_score, source
        FROM serendipity_results
      ),
      
      -- グループ化してスコアを統合
      merged_results AS (
        SELECT 
          id,
          MAX(content) as content,
          MAX(bm25_score) as fts_score,
          MAX(similarity_score) as vss_score,
          MAX(serendipity_score) as serendipity_score,
          -- 重み付けハイブリッドスコア
          (
            ? * MAX(bm25_score) +
            ? * MAX(similarity_score) +
            ? * MAX(serendipity_score)
          ) as final_score,
          -- どの検索手法でヒットしたか
          STRING_AGG(DISTINCT source, ',') as sources
        FROM all_results
        GROUP BY id
      )
      
      SELECT 
        id,
        content,
        final_score,
        sources,
        -- 各スコアの内訳も返す
        fts_score,
        vss_score,
        serendipity_score
      FROM merged_results
      WHERE final_score > 0
      ORDER BY final_score DESC
      LIMIT ?
    `, [
      query,                          // FTS用
      queryEmbedding,                 // VSS用
      queryEmbedding,                 // VSS用（ORDER BY用）
      this.addNoise(queryEmbedding),  // セレンディピティ用
      queryEmbedding,                 // セレンディピティ用（フィルタ用）
      weights.fts,                    // FTSの重み
      weights.vss,                    // VSSの重み
      weights.serendipity,            // セレンディピティの重み
      options.limit || 20             // 結果数
    ]);

    return this.rerank(results, query);
  }

  // ノイズを加えてセレンディピティを実現
  private addNoise(embedding: number[], noiseLevel: number = 0.1): number[] {
    return embedding.map(v => v + (Math.random() - 0.5) * noiseLevel);
  }

  // 再ランキング（オプション）
  private async rerank(results: any[], query: string) {
    // ここで必要に応じて追加の再ランキングロジックを実装
    // 例：時間的要素、アクセス頻度、ユーザーの好みなどを考慮
    
    return results.map(r => ({
      ...r,
      // 時間による減衰
      timeDecay: this.calculateTimeDecay(r.created_at),
      // 最終スコアの再計算
      adjustedScore: r.final_score * this.calculateTimeDecay(r.created_at)
    })).sort((a, b) => b.adjustedScore - a.adjustedScore);
  }

  private calculateTimeDecay(createdAt: Date): number {
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    // 30日で半減する指数関数的減衰
    return Math.exp(-ageInDays / 30);
  }
}
```

## セレンディピティ強化版リランキング

```typescript
class CreativeReranker {
  // 創作向けの特殊なリランキング
  async rerankForCreativity(
    results: SearchResult[],
    context: {
      currentMood?: string;
      recentlyUsedNodes?: string[];
      projectTheme?: string;
    }
  ): Promise<SearchResult[]> {
    return results.map(result => {
      let creativityBonus = 0;

      // 最近使用していないノードにボーナス
      if (!context.recentlyUsedNodes?.includes(result.id)) {
        creativityBonus += 0.2;
      }

      // 異なるカテゴリのノードにボーナス
      if (result.category !== context.projectTheme) {
        creativityBonus += 0.15;
      }

      // ランダム要素
      creativityBonus += Math.random() * 0.1;

      return {
        ...result,
        creativityScore: result.final_score + creativityBonus
      };
    }).sort((a, b) => b.creativityScore - a.creativityScore);
  }
}
```

## 使用例

```typescript
// 通常の検索
const normalResults = await searchService.search("雨の日の恋愛", {
  mode: 'normal'
});

// セレンディピティ重視の検索
const creativeResults = await searchService.search("雨の日の恋愛", {
  mode: 'hybrid',
  weights: {
    fts: 0.1,
    vss: 0.3,
    serendipity: 0.6  // セレンディピティを重視
  }
});

// プロット作成時の検索（バランス型）
const plotResults = await searchService.search("雨の日の恋愛", {
  mode: 'hybrid',
  weights: {
    fts: 0.3,
    vss: 0.5,
    serendipity: 0.2
  }
});
```

## パフォーマンス最適化

1. **インデックスの最適化**
   ```sql
   -- FTS用インデックス
   CREATE VIRTUAL TABLE nodes_fts USING fts5(
     content, 
     tokenize='unicode61 remove_diacritics 1'
   );
   
   -- VSS用HNSWインデックス
   CREATE INDEX nodes_embedding_idx ON nodes 
   USING HNSW (embeddings)
   WITH (metric = 'cosine', ef_construction = 128, M = 16);
   ```

2. **キャッシュ戦略**
   - 頻繁に使用されるクエリの結果をキャッシュ
   - エンベディングの事前計算とキャッシュ

3. **バッチ処理**
   - 複数のクエリをまとめて処理
   - 非同期処理でUIをブロックしない

## まとめ

このハイブリッド検索実装により：
- **精度**: 全文検索とベクトル検索の良いとこ取り
- **創造性**: セレンディピティ検索で予期せぬ発見
- **柔軟性**: 用途に応じて重みを調整可能
- **高速**: DuckDBの最適化されたクエリエンジン