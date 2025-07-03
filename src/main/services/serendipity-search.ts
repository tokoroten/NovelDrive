import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import { generateSerendipitousEmbedding, cosineSimilarity, rerankResults } from './vector-search';
import { wrapIPCHandler, ValidationError } from '../utils/error-handler';
import { VectorSearchService } from './vector-search-service';

interface SearchOptions {
  limit?: number;
  projectId?: string;
  type?: string;
  serendipityLevel?: number;
  diversityWeight?: number;
  temporalDecay?: boolean;
  minScore?: number;
}

/**
 * セレンディピティ検索を実行
 */
interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export async function performSerendipitySearch(
  db: Database.Database,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 20,
    projectId,
    type,
    serendipityLevel = 0.3,
    diversityWeight = 0.3,
    temporalDecay = true,
    minScore = 0.3,
  } = options;

  // クエリのベクトル埋め込みを生成（セレンディピティ適用）
  const queryEmbedding = await generateSerendipitousEmbedding(query, serendipityLevel);

  if (!queryEmbedding) {
    throw new Error('Failed to generate query embedding');
  }

  // ベクトル検索サービスを使用
  const vectorSearch = new VectorSearchService(db);
  
  // ベクトル検索を実行
  const vectorResults = await vectorSearch.vectorSearch(queryEmbedding, {
    limit: limit * 3, // 再ランキング用に多めに取得
    threshold: minScore,
    projectId,
    type
  });

  // 結果を SearchResult 形式に変換
  const searchResults: SearchResult[] = vectorResults.map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type,
    score: row.similarity,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  }));

  // 多様性を考慮した再ランキング
  const rerankedResults = await rerankResults(
    searchResults,
    queryEmbedding,
    {
      diversityWeight,
      temporalDecay,
      limit
    }
  ) as SearchResult[];

  return rerankedResults;
}

/**
 * ハイブリッド検索（テキスト検索＋ベクトル検索）
 */
export async function performHybridSearch(
  db: Database.Database,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    limit = 20,
    projectId,
    type,
    serendipityLevel = 0.3,
    minScore = 0.3,
  } = options;

  // テキスト検索の実行
  const textResults = await performTextSearch(db, query, { projectId, type, limit: limit * 2 });

  // セレンディピティ検索の実行
  const vectorResults = await performSerendipitySearch(db, query, {
    ...options,
    limit: limit * 2,
  });

  // 結果のマージとスコアの正規化
  const mergedResults = mergeSearchResults(textResults, vectorResults, {
    textWeight: 0.4,
    vectorWeight: 0.6,
    minScore,
  });

  // 上位結果を返す
  return mergedResults.slice(0, limit);
}

/**
 * テキスト検索の実行
 */
async function performTextSearch(
  db: Database.Database,
  query: string,
  options: { projectId?: string; type?: string; limit: number }
): Promise<SearchResult[]> {
  // SQLite3のFTSまたはLIKE検索を使用
  const whereClauses = [];
  const params: any[] = [];

  // 検索条件
  whereClauses.push('(title LIKE ? OR content LIKE ?)');
  const searchPattern = `%${query}%`;
  params.push(searchPattern, searchPattern);

  if (options.projectId) {
    whereClauses.push('(project_id = ? OR project_id IS NULL)');
    params.push(options.projectId);
  }

  if (options.type) {
    whereClauses.push('type = ?');
    params.push(options.type);
  }

  const sql = `
    SELECT 
      id,
      title,
      content,
      type,
      metadata,
      LENGTH(content) as content_length
    FROM knowledge
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY 
      CASE 
        WHEN title LIKE ? THEN 1
        WHEN content LIKE ? THEN 2
        ELSE 3
      END,
      content_length
    LIMIT ?
  `;

  params.push(searchPattern, searchPattern, options.limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);

  // スコアリング
  return rows.map((row: any) => {
    let score = 0.5; // ベーススコア
    
    // タイトルに含まれる場合は高スコア
    if (row.title.toLowerCase().includes(query.toLowerCase())) {
      score += 0.3;
    }
    
    // コンテンツの先頭に含まれる場合は中スコア
    const contentPreview = row.content.substring(0, 200).toLowerCase();
    if (contentPreview.includes(query.toLowerCase())) {
      score += 0.2;
    }

    return {
      id: row.id,
      title: row.title,
      content: row.content,
      type: row.type,
      score,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  });
}

/**
 * 検索結果のマージ
 */
function mergeSearchResults(
  textResults: SearchResult[],
  vectorResults: SearchResult[],
  options: { textWeight: number; vectorWeight: number; minScore: number }
): SearchResult[] {
  const { textWeight, vectorWeight, minScore } = options;
  const resultMap = new Map<string, SearchResult>();

  // テキスト検索結果を追加
  textResults.forEach(result => {
    resultMap.set(result.id, {
      ...result,
      score: result.score * textWeight
    });
  });

  // ベクトル検索結果を追加またはマージ
  vectorResults.forEach(result => {
    const existing = resultMap.get(result.id);
    if (existing) {
      // 両方に存在する場合はスコアを合計
      existing.score += result.score * vectorWeight;
    } else {
      // ベクトル検索のみの結果
      resultMap.set(result.id, {
        ...result,
        score: result.score * vectorWeight
      });
    }
  });

  // スコアでソートし、閾値以上のものを返す
  return Array.from(resultMap.values())
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

export function setupSerendipitySearchHandlers(db: Database.Database): void {
  // セレンディピティ検索
  ipcMain.handle('search:serendipity', wrapIPCHandler(
    async (_, query: string, options?: SearchOptions) => {
      if (!query || query.trim().length === 0) {
        throw new ValidationError('検索クエリが指定されていません');
      }

      return await performSerendipitySearch(db, query, options);
    },
    'セレンディピティ検索の実行中にエラーが発生しました'
  ));

  // ハイブリッド検索
  ipcMain.handle('search:hybrid', wrapIPCHandler(
    async (_, query: string, options?: SearchOptions) => {
      if (!query || query.trim().length === 0) {
        throw new ValidationError('検索クエリが指定されていません');
      }

      return await performHybridSearch(db, query, options);
    },
    'ハイブリッド検索の実行中にエラーが発生しました'
  ));

  // ベクトル埋め込みの生成
  ipcMain.handle('embedding:generateMissing', wrapIPCHandler(
    async (_, batchSize: number = 10) => {
      const vectorSearch = new VectorSearchService(db);
      const generated = await vectorSearch.generateMissingEmbeddings(batchSize);
      return { generated };
    },
    '埋め込みの生成中にエラーが発生しました'
  ));
}