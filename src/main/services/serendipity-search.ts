import { ipcMain } from 'electron';
import { 
  generateEmbedding, 
  generateSerendipitousEmbedding,
  cosineSimilarity,
  rerankResults
} from './vector-search';

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
export async function performSerendipitySearch(
  conn: any,
  query: string,
  options: SearchOptions = {}
): Promise<any[]> {
  const {
    limit = 20,
    projectId,
    type,
    serendipityLevel = 0.3,
    diversityWeight = 0.3,
    temporalDecay = true,
    minScore = 0.3
  } = options;
  
  // クエリのベクトル埋め込みを生成（セレンディピティ適用）
  const queryEmbedding = await generateSerendipitousEmbedding(query, serendipityLevel);
  
  if (!queryEmbedding) {
    throw new Error('Failed to generate query embedding');
  }
  
  // データベースから候補を取得
  let sql = `
    SELECT 
      id, title, content, type, project_id, embedding, metadata,
      created_at, updated_at
    FROM knowledge
    WHERE embedding IS NOT NULL
  `;
  
  const params: any[] = [];
  
  if (projectId) {
    sql += ` AND (project_id = ? OR project_id IS NULL)`;
    params.push(projectId);
  }
  
  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  
  // 最大1000件まで取得して後でフィルタリング
  sql += ` LIMIT 1000`;
  
  return new Promise((resolve, reject) => {
    conn.all(sql, params, async (err: any, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      // ベクトル類似度でフィルタリング
      const candidates = rows.filter(row => {
        try {
          const embedding = JSON.parse(row.embedding);
          const similarity = cosineSimilarity(queryEmbedding, embedding);
          return similarity >= minScore;
        } catch {
          return false;
        }
      });
      
      // リランキング
      const reranked = rerankResults(candidates, queryEmbedding, {
        diversityWeight,
        temporalDecay,
        createdAt: (item) => new Date(item.created_at)
      });
      
      // 上位N件を返す
      const results = reranked.slice(0, limit).map(item => ({
        ...item,
        metadata: JSON.parse(item.metadata || '{}')
      }));
      
      resolve(results);
    });
  });
}

/**
 * ハイブリッド検索（FTS + VSS + セレンディピティ）
 */
export async function performHybridSearch(
  conn: any,
  query: string,
  options: SearchOptions & { ftsWeight?: number; vssWeight?: number } = {}
): Promise<any[]> {
  const {
    limit = 20,
    projectId,
    type,
    ftsWeight = 0.3,
    vssWeight = 0.7,
    ...serendipityOptions
  } = options;
  
  // 並行して3種類の検索を実行
  const [ftsResults, vssResults] = await Promise.all([
    // FTS検索
    performFTSSearch(conn, query, { limit: limit * 2, projectId, type }),
    // ベクトル検索（セレンディピティ付き）
    performSerendipitySearch(conn, query, { ...serendipityOptions, limit: limit * 2, projectId, type })
  ]);
  
  // 結果をマージしてスコアを統合
  const resultMap = new Map<string, any>();
  
  // FTS結果を追加
  ftsResults.forEach((item, index) => {
    const ftsScore = 1 - (index / ftsResults.length); // 順位に基づくスコア
    resultMap.set(item.id, {
      ...item,
      ftsScore: ftsScore * ftsWeight,
      vssScore: 0,
      combinedScore: ftsScore * ftsWeight
    });
  });
  
  // VSS結果を追加/更新
  vssResults.forEach(item => {
    const existing = resultMap.get(item.id);
    if (existing) {
      existing.vssScore = item.score * vssWeight;
      existing.combinedScore = existing.ftsScore + existing.vssScore;
    } else {
      resultMap.set(item.id, {
        ...item,
        ftsScore: 0,
        vssScore: item.score * vssWeight,
        combinedScore: item.score * vssWeight
      });
    }
  });
  
  // スコアでソートして上位N件を返す
  const results = Array.from(resultMap.values())
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);
  
  return results;
}

/**
 * 全文検索を実行
 */
async function performFTSSearch(
  conn: any,
  query: string,
  options: { limit?: number; projectId?: string; type?: string } = {}
): Promise<any[]> {
  const { limit = 20, projectId, type } = options;
  
  // 検索トークンを空白区切りで結合
  const searchQuery = query.split(/\s+/).join(' ');
  
  let sql = `
    SELECT 
      id, title, content, type, project_id, embedding, metadata,
      created_at, updated_at
    FROM knowledge
    WHERE search_tokens LIKE ?
  `;
  
  const params: any[] = [`%${searchQuery}%`];
  
  if (projectId) {
    sql += ` AND (project_id = ? OR project_id IS NULL)`;
    params.push(projectId);
  }
  
  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);
  
  return new Promise((resolve, reject) => {
    conn.all(sql, params, (err: any, rows: any[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      const results = rows.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
      }));
      
      resolve(results);
    });
  });
}

/**
 * 関連アイテムを発見（アイテムベース）
 */
export async function findRelatedItems(
  conn: any,
  itemId: string,
  options: SearchOptions = {}
): Promise<any[]> {
  // 元のアイテムを取得
  const sql = `SELECT * FROM knowledge WHERE id = ?`;
  
  return new Promise((resolve, reject) => {
    conn.get(sql, [itemId], async (err: any, row: any) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row || !row.embedding) {
        resolve([]);
        return;
      }
      
      // アイテムの内容でセレンディピティ検索
      const results = await performSerendipitySearch(
        conn,
        row.title + ' ' + row.content,
        {
          ...options,
          minScore: 0.5 // 関連アイテムは類似度を高めに設定
        }
      );
      
      // 元のアイテムを除外
      resolve(results.filter(item => item.id !== itemId));
    });
  });
}

/**
 * IPCハンドラーの設定
 */
export function setupSerendipitySearchHandlers(conn: any): void {
  // セレンディピティ検索
  ipcMain.handle('search:serendipity', async (_, query: string, options?: SearchOptions) => {
    return performSerendipitySearch(conn, query, options);
  });
  
  // ハイブリッド検索
  ipcMain.handle('search:hybrid', async (_, query: string, options?: any) => {
    return performHybridSearch(conn, query, options);
  });
  
  // 関連アイテム検索
  ipcMain.handle('search:related', async (_, itemId: string, options?: SearchOptions) => {
    return findRelatedItems(conn, itemId, options);
  });
}