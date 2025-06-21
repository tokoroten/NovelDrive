import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { extractInspiration } from './openai-service';
import { generateEmbedding } from './openai-service';
import { getSearchTokens } from './japanese-tokenizer';

interface AnythingBoxInput {
  content: string;
  type?: 'text' | 'url' | 'image' | 'audio';
  projectId?: string;
  metadata?: Record<string, any>;
}

interface ProcessedItem {
  original: {
    id: string;
    content: string;
    type: string;
    metadata: Record<string, any>;
  };
  inspirations: Array<{
    id: string;
    type: string;
    content: string;
    confidence: number;
  }>;
  knowledge: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
    metadata: Record<string, any>;
  }>;
}

/**
 * なんでもボックスに投入されたコンテンツを処理
 */
export async function processAnythingBoxInput(input: AnythingBoxInput): Promise<ProcessedItem> {
  const originalId = uuidv4();
  const timestamp = new Date();

  // 元データの保存準備
  const original = {
    id: originalId,
    content: input.content,
    type: input.type || detectContentType(input.content),
    metadata: {
      ...input.metadata,
      processedAt: timestamp,
      projectId: input.projectId,
    },
  };

  // コンテンツタイプに応じた処理
  let extractedContent = input.content;

  if (original.type === 'url') {
    // URLの場合はクローラーを起動（別途実装済み）
    return {
      original,
      inspirations: [],
      knowledge: [
        {
          id: uuidv4(),
          title: 'URLクロール予約',
          content: `URL: ${input.content} のクロールを予約しました`,
          type: 'task',
          metadata: {
            url: input.content,
            taskType: 'crawl',
            scheduledAt: timestamp,
          },
        },
      ],
    };
  }

  // AIによるインスピレーション抽出
  const inspiration = await extractInspiration(extractedContent, original.type);

  // インスピレーションを個別のアイテムに変換
  const inspirations: ProcessedItem['inspirations'] = [];
  const knowledge: ProcessedItem['knowledge'] = [];

  // キーワードからインスピレーション生成
  inspiration.keywords.forEach((keyword) => {
    const id = uuidv4();
    inspirations.push({
      id,
      type: 'keyword',
      content: keyword,
      confidence: 0.8,
    });
  });

  // テーマからナレッジ生成
  inspiration.themes.forEach((theme) => {
    knowledge.push({
      id: uuidv4(),
      title: `テーマ: ${theme}`,
      content: `${extractedContent}\n\n【抽出されたテーマ】\n${theme}`,
      type: 'theme',
      metadata: {
        originalId,
        theme,
        extractedAt: timestamp,
      },
    });
  });

  // プロットシードからナレッジ生成
  inspiration.plotSeeds.forEach((seed) => {
    knowledge.push({
      id: uuidv4(),
      title: `プロットアイデア`,
      content: seed,
      type: 'plot_seed',
      metadata: {
        originalId,
        confidence: 0.7,
        extractedAt: timestamp,
      },
    });
  });

  // キャラクターからナレッジ生成
  inspiration.characters.forEach((character) => {
    knowledge.push({
      id: uuidv4(),
      title: `キャラクター: ${character.name}`,
      content: `${character.description}\n\n役割: ${character.role}`,
      type: 'character_seed',
      metadata: {
        originalId,
        characterName: character.name,
        role: character.role,
        extractedAt: timestamp,
      },
    });
  });

  // シーンアイデアからナレッジ生成
  inspiration.scenes.forEach((scene) => {
    knowledge.push({
      id: uuidv4(),
      title: `シーンアイデア`,
      content: scene,
      type: 'scene',
      metadata: {
        originalId,
        extractedAt: timestamp,
      },
    });
  });

  // 元のコンテンツもナレッジとして保存
  knowledge.push({
    id: originalId,
    title: generateTitle(extractedContent),
    content: extractedContent,
    type: 'original',
    metadata: original.metadata,
  });

  return {
    original,
    inspirations,
    knowledge,
  };
}

/**
 * コンテンツタイプを自動検出
 */
function detectContentType(content: string): string {
  // URL判定
  if (/^https?:\/\//.test(content)) {
    return 'url';
  }

  // 画像パス判定
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(content)) {
    return 'image';
  }

  // 音声ファイル判定
  if (/\.(mp3|wav|ogg|m4a)$/i.test(content)) {
    return 'audio';
  }

  return 'text';
}

/**
 * コンテンツからタイトルを生成
 */
function generateTitle(content: string): string {
  // 改行で分割して最初の行を取得
  const firstLine = content.split('\n')[0];

  // 長すぎる場合は切り詰め
  if (firstLine.length > 50) {
    return firstLine.substring(0, 47) + '...';
  }

  return firstLine || '無題';
}

/**
 * なんでもボックスの処理結果をデータベースに保存
 */
async function saveProcessedItems(
  conn: any,
  processed: ProcessedItem,
  projectId?: string
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;

  // ナレッジを保存
  for (const item of processed.knowledge) {
    try {
      // 埋め込みを生成
      const embedding = await generateEmbedding(item.title + ' ' + item.content);

      const knowledge = {
        ...item,
        projectId,
        embedding,
      };

      // データベースに直接保存
      const result = await saveKnowledgeItem(conn, knowledge);

      if (result.success) {
        saved++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error('Failed to save knowledge item:', error);
      failed++;
    }
  }

  return { saved, failed };
}

/**
 * ナレッジアイテムをデータベースに保存
 */
async function saveKnowledgeItem(conn: any, knowledge: any): Promise<any> {
  // URLから生成された場合、既に存在しないかチェック
  const sourceUrl = knowledge.metadata?.url || knowledge.sourceUrl;
  if (sourceUrl) {
    const existingCheck = await new Promise<boolean>((resolve) => {
      conn.all(
        'SELECT id FROM knowledge WHERE source_url = ? LIMIT 1',
        [sourceUrl],
        (err: any, rows: any[]) => {
          if (err) {
            console.error('URL check error:', err);
            resolve(false);
          } else {
            resolve(rows && rows.length > 0);
          }
        }
      );
    });

    if (existingCheck) {
      return {
        success: false,
        error: 'URL already exists in knowledge base',
        duplicate: true,
      };
    }
  }

  // 検索用トークンを生成
  const titleTokens = getSearchTokens(knowledge.title || '');
  const contentTokens = getSearchTokens(knowledge.content || '');
  const searchTokens = [...new Set([...titleTokens, ...contentTokens])].join(' ');

  // ベクトル埋め込みを生成（まだない場合）
  let embedding = knowledge.embedding;
  if (!embedding && knowledge.content) {
    try {
      embedding = await generateEmbedding(knowledge.title + ' ' + knowledge.content);
    } catch (error) {
      console.warn('Failed to generate embedding:', error);
    }
  }

  const sql = `
    INSERT INTO knowledge (id, title, content, type, project_id, embedding, metadata, search_tokens, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      type = excluded.type,
      project_id = excluded.project_id,
      embedding = excluded.embedding,
      metadata = excluded.metadata,
      search_tokens = excluded.search_tokens,
      source_url = excluded.source_url,
      updated_at = CURRENT_TIMESTAMP
  `;

  return new Promise((resolve) => {
    conn.run(
      sql,
      [
        knowledge.id,
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.projectId || null,
        JSON.stringify(embedding || null),
        JSON.stringify(knowledge.metadata || {}),
        searchTokens,
        sourceUrl || null,
      ],
      (err: any) => {
        if (err) {
          // UNIQUE制約違反の場合
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            resolve({
              success: false,
              error: 'URL already exists in knowledge base',
              duplicate: true,
            });
          } else {
            console.error('Knowledge save error:', err);
            resolve({ success: false, error: err.message });
          }
        } else {
          resolve({ success: true, searchTokens, embedding: !!embedding });
        }
      }
    );
  });
}

/**
 * IPCハンドラーの設定
 */
export function setupAnythingBoxHandlers(conn: any): void {
  // なんでもボックスへの投入
  ipcMain.handle('anythingBox:process', async (_, input: AnythingBoxInput) => {
    try {
      const processed = await processAnythingBoxInput(input);

      // データベースに保存
      const { saved, failed } = await saveProcessedItems(conn, processed, input.projectId);

      return {
        success: true,
        processed: {
          originalId: processed.original.id,
          inspirationCount: processed.inspirations.length,
          knowledgeCount: processed.knowledge.length,
        },
        saved,
        failed,
      };
    } catch (error) {
      console.error('AnythingBox processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // 処理履歴の取得
  ipcMain.handle(
    'anythingBox:history',
    async (_, options?: { projectId?: string; limit?: number }) => {
      const { projectId, limit = 50 } = options || {};

      let sql = `
      SELECT id, title, type, metadata, created_at
      FROM knowledge
      WHERE metadata LIKE '%"processedAt"%'
    `;

      const params: any[] = [];

      if (projectId) {
        sql += ` AND project_id = ?`;
        params.push(projectId);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      return new Promise((resolve, reject) => {
        conn.all(sql, params, (err: any, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const results = rows.map((row) => ({
              ...row,
              metadata: JSON.parse(row.metadata || '{}'),
            }));
            resolve(results);
          }
        });
      });
    }
  );
}
