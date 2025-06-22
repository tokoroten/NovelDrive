import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import * as duckdb from 'duckdb';

interface Chapter {
  id?: string;
  title: string;
  content: string;
  plotId: string;
  order: number;
  status: 'draft' | 'writing' | 'review' | 'completed';
  wordCount: number;
  characterCount: number;
  metadata?: Record<string, unknown>;
}

interface WritingSuggestionContext {
  plotId: string;
  chapterTitle: string;
  previousContent: string;
  chapterOrder: number;
}

/**
 * チャプターハンドラーの設定
 */
export function setupChapterHandlers(conn: duckdb.Connection): void {
  // チャプター作成
  ipcMain.handle('chapters:create', async (_, chapter: Omit<Chapter, 'id'>) => {
    const id = uuidv4();
    const sql = `
      INSERT INTO chapters (
        id, plot_id, title, content, "order", status, 
        word_count, character_count, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      conn.run(
        sql,
        [
          id,
          chapter.plotId,
          chapter.title,
          chapter.content || '',
          chapter.order,
          chapter.status || 'draft',
          chapter.wordCount || 0,
          chapter.characterCount || 0,
          JSON.stringify(chapter.metadata || {}),
        ],
        (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve({ id, ...chapter });
          }
        }
      );
    });
  });

  // チャプター更新
  ipcMain.handle('chapters:update', async (_, id: string, updates: Partial<Chapter>) => {
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.order !== undefined) {
      updateFields.push('"order" = ?');
      values.push(updates.order);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.wordCount !== undefined) {
      updateFields.push('word_count = ?');
      values.push(updates.wordCount);
    }
    if (updates.characterCount !== undefined) {
      updateFields.push('character_count = ?');
      values.push(updates.characterCount);
    }
    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (updateFields.length === 0) {
      return { success: true };
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `
      UPDATE chapters
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
      conn.run(sql, values, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  // チャプター削除
  ipcMain.handle('chapters:delete', async (_, id: string) => {
    const sql = 'DELETE FROM chapters WHERE id = ?';

    return new Promise((resolve, reject) => {
      conn.run(sql, [id], (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  });

  // チャプター取得
  ipcMain.handle('chapters:get', async (_, id: string) => {
    const sql = 'SELECT * FROM chapters WHERE id = ?';

    return new Promise((resolve, reject) => {
      conn.all(sql, [id], (err: any, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            plotId: row.plot_id,
            wordCount: row.word_count,
            characterCount: row.character_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata: JSON.parse(row.metadata || '{}'),
          });
        } else {
          resolve(null);
        }
      });
    });
  });

  // プロットのチャプター一覧取得
  ipcMain.handle('chapters:listByPlot', async (_, plotId: string) => {
    const sql = `
      SELECT * FROM chapters
      WHERE plot_id = ?
      ORDER BY "order" ASC
    `;

    return new Promise((resolve, reject) => {
      conn.all(sql, [plotId], (err: any, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const chapters = rows.map((row) => ({
            ...row,
            plotId: row.plot_id,
            wordCount: row.word_count,
            characterCount: row.character_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            metadata: JSON.parse(row.metadata || '{}'),
          }));
          resolve(chapters);
        }
      });
    });
  });

  // 執筆提案の取得（マルチエージェントシステムと連携）
  ipcMain.handle(
    'agents:requestWritingSuggestions',
    async (_, context: WritingSuggestionContext) => {
      try {
        // プロット情報を取得
        const plotSql = 'SELECT * FROM plots WHERE id = ?';
        const plot = await new Promise<any>((resolve, reject) => {
          conn.all(plotSql, [context.plotId], (err: any, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows?.[0]);
          });
        });

        if (!plot) {
          throw new Error('Plot not found');
        }

        // エージェントによる提案生成（簡略版）
        // 実際にはマルチエージェントシステムと連携
        const suggestions = [
          {
            id: uuidv4(),
            agentId: 'writer-ai',
            agentName: 'ライターAI',
            suggestion: '次のシーンでは、主人公の内面的な葛藤を描写してみてはどうでしょうか。',
            accepted: false,
            timestamp: new Date().toISOString(),
          },
        ];

        return suggestions;
      } catch (error) {
        console.error('Failed to get writing suggestions:', error);
        return [];
      }
    }
  );
}