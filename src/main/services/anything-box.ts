import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { extractInspiration } from './openai-service';
import { generateEmbedding } from './openai-service';

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
export async function processAnythingBoxInput(
  input: AnythingBoxInput
): Promise<ProcessedItem> {
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
      knowledge: [{
        id: uuidv4(),
        title: 'URLクロール予約',
        content: `URL: ${input.content} のクロールを予約しました`,
        type: 'task',
        metadata: {
          url: input.content,
          taskType: 'crawl',
          scheduledAt: timestamp,
        },
      }],
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

      // knowledge:saveハンドラーを通じて保存
      const result = await ipcMain.handle('knowledge:save', null, knowledge);
      
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
 * IPCハンドラーの設定
 */
export function setupAnythingBoxHandlers(conn: any): void {
  // なんでもボックスへの投入
  ipcMain.handle('anythingBox:process', async (_, input: AnythingBoxInput) => {
    try {
      const processed = await processAnythingBoxInput(input);
      
      // データベースに保存
      const { saved, failed } = await saveProcessedItems(
        conn,
        processed,
        input.projectId
      );
      
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
  ipcMain.handle('anythingBox:history', async (_, options?: { projectId?: string; limit?: number }) => {
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
          const results = rows.map(row => ({
            ...row,
            metadata: JSON.parse(row.metadata || '{}'),
          }));
          resolve(results);
        }
      });
    });
  });
}