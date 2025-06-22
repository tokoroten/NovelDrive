import { ipcMain } from 'electron';
import * as duckdb from 'duckdb';
import { v4 as uuidv4 } from 'uuid';
import { LocalEmbeddingService } from './local-embedding-service';
import { getSearchTokens } from './japanese-tokenizer';

// Types
interface BaseEntity {
  id?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface Project extends BaseEntity {
  name: string;
  description?: string;
  genre?: string;
  status: 'active' | 'archived' | 'completed';
  settings?: Record<string, unknown>;
}

interface Knowledge extends BaseEntity {
  title: string;
  content: string;
  type: string;
  project_id?: string;
  source_url?: string;
  source_id?: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  search_tokens?: string;
}

interface Character extends BaseEntity {
  project_id: string;
  name: string;
  profile?: string;
  personality?: string;
  speech_style?: string;
  background?: string;
  dialogue_samples?: string;
  metadata?: Record<string, unknown>;
}

interface Plot extends BaseEntity {
  project_id: string;
  version: string;
  parent_version?: string;
  title: string;
  synopsis: string;
  structure: Record<string, unknown>;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  created_by: string;
  metadata?: Record<string, unknown>;
}

interface Chapter extends BaseEntity {
  project_id: string;
  plot_id: string;
  chapter_number: number;
  title: string;
  content: string;
  word_count?: number;
  status: 'draft' | 'writing' | 'reviewing' | 'completed';
  version?: number;
  metadata?: Record<string, unknown>;
}

interface AgentDiscussion extends BaseEntity {
  project_id?: string;
  plot_id?: string;
  chapter_id?: string;
  topic: string;
  status: 'active' | 'completed' | 'archived';
  thread_id: string;
  participants: string[];
  metadata?: Record<string, unknown>;
}

interface AgentMessage extends BaseEntity {
  discussion_id: string;
  agent_role: string;
  agent_name?: string;
  message: string;
  message_type: 'text' | 'suggestion' | 'critique' | 'approval';
  metadata?: Record<string, unknown>;
}

interface KnowledgeLink extends BaseEntity {
  source_id: string;
  target_id: string;
  link_type: 'related' | 'derived' | 'contradicts' | 'supports';
  strength: number;
  metadata?: Record<string, unknown>;
}

interface SearchOptions {
  query: string;
  mode: 'normal' | 'serendipity' | 'hybrid';
  weights?: {
    fts: number;
    vss: number;
    serendipity: number;
  };
  limit?: number;
  project_id?: string;
  filters?: Record<string, unknown>;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  final_score: number;
  sources: string;
  fts_score?: number;
  vss_score?: number;
  serendipity_score?: number;
  time_decay?: number;
  adjusted_score?: number;
  metadata?: Record<string, unknown>;
}

// Helper functions
function runAsync(conn: duckdb.Connection, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    if (params.length > 0) {
      conn.run(sql, ...params, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      conn.run(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    }
  });
}

function queryAsync<T>(conn: duckdb.Connection, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (params.length > 0) {
      conn.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as T[] || []);
      });
    } else {
      conn.all(sql, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows as T[] || []);
      });
    }
  });
}

function getAsync<T>(conn: duckdb.Connection, sql: string, params: unknown[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (params.length > 0) {
      conn.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows?.[0] as T);
      });
    } else {
      conn.all(sql, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows?.[0] as T);
      });
    }
  });
}

// Database handlers setup
export function setupDatabaseHandlers(conn: duckdb.Connection): void {
  // Project Management Handlers
  ipcMain.handle('db:projects:list', async (_, filters?: { status?: string }) => {
    try {
      let sql = `
        SELECT 
          p.*,
          COUNT(DISTINCT k.id) as knowledge_count,
          COUNT(DISTINCT c.id) as chapter_count,
          COUNT(DISTINCT ch.id) as character_count
        FROM projects p
        LEFT JOIN knowledge k ON p.id = k.project_id
        LEFT JOIN chapters c ON p.id = c.project_id
        LEFT JOIN characters ch ON p.id = ch.project_id
      `;
      
      const params: unknown[] = [];
      if (filters?.status) {
        sql += ' WHERE p.status = ?';
        params.push(filters.status);
      }
      
      sql += ' GROUP BY p.id ORDER BY p.updated_at DESC';
      
      return await queryAsync<Project>(conn, sql, params);
    } catch (error) {
      console.error('Error listing projects:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:get', async (_, id: string) => {
    try {
      const sql = 'SELECT * FROM projects WHERE id = ?';
      return await getAsync<Project>(conn, sql, [id]);
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:create', async (_, project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO projects (id, name, description, genre, status, settings)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await runAsync(conn, sql, [
        id,
        project.name,
        project.description || null,
        project.genre || null,
        project.status || 'active',
        JSON.stringify(project.settings || {})
      ]);
      
      return { id, ...project };
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:update', async (_, id: string, updates: Partial<Project>) => {
    try {
      const fields = [];
      const values = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.genre !== undefined) {
        fields.push('genre = ?');
        values.push(updates.genre);
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.settings !== undefined) {
        fields.push('settings = ?');
        values.push(JSON.stringify(updates.settings));
      }
      
      if (fields.length === 0) return false;
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
      await runAsync(conn, sql, values);
      
      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  });

  ipcMain.handle('db:projects:delete', async (_, id: string) => {
    try {
      const sql = 'DELETE FROM projects WHERE id = ?';
      await runAsync(conn, sql, [id]);
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  });

  // Knowledge Management Handlers
  ipcMain.handle('db:knowledge:list', async (_, filters?: { project_id?: string; type?: string; limit?: number }) => {
    try {
      let sql = 'SELECT * FROM knowledge WHERE 1=1';
      const params: unknown[] = [];
      
      if (filters?.project_id) {
        sql += ' AND project_id = ?';
        params.push(filters.project_id);
      }
      if (filters?.type) {
        sql += ' AND type = ?';
        params.push(filters.type);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      if (filters?.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }
      
      return await queryAsync<Knowledge>(conn, sql, params);
    } catch (error) {
      console.error('Error listing knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:get', async (_, id: string) => {
    try {
      const sql = 'SELECT * FROM knowledge WHERE id = ?';
      const row = await getAsync<any>(conn, sql, [id]);
      if (row && row.embedding) {
        row.embedding = JSON.parse(row.embedding);
      }
      if (row && row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    } catch (error) {
      console.error('Error getting knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:create', async (_, knowledge: Omit<Knowledge, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = uuidv4();
      
      // Check for duplicate URL if provided
      if (knowledge.source_url) {
        const existing = await getAsync<{ id: string }>(
          conn,
          'SELECT id FROM knowledge WHERE source_url = ?',
          [knowledge.source_url]
        );
        if (existing) {
          return { success: false, error: 'URL already exists in knowledge base', duplicate: true };
        }
      }
      
      // Generate search tokens
      const titleTokens = getSearchTokens(knowledge.title || '');
      const contentTokens = getSearchTokens(knowledge.content || '');
      const searchTokens = [...new Set([...titleTokens, ...contentTokens])].join(' ');
      
      // Generate embedding if not provided
      let embedding = knowledge.embedding;
      if (!embedding && knowledge.content) {
        try {
          const localService = LocalEmbeddingService.getInstance();
          await localService.initialize();
          embedding = await localService.generateEmbedding(knowledge.title + ' ' + knowledge.content);
        } catch (error) {
          console.warn('Failed to generate embedding:', error);
        }
      }
      
      const sql = `
        INSERT INTO knowledge (
          id, title, content, type, project_id, source_url, source_id,
          metadata, embedding, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      
      await runAsync(conn, sql, [
        id,
        knowledge.title,
        knowledge.content,
        knowledge.type,
        knowledge.project_id || null,
        knowledge.source_url || null,
        knowledge.source_id || null,
        JSON.stringify(knowledge.metadata || {}),
        embedding ? JSON.stringify(embedding) : null
      ]);
      
      return { success: true, id, searchTokens, embedding: !!embedding };
    } catch (error) {
      console.error('Error creating knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:update', async (_, id: string, updates: Partial<Knowledge>) => {
    try {
      const fields = [];
      const values = [];
      
      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
      }
      if (updates.type !== undefined) {
        fields.push('type = ?');
        values.push(updates.type);
      }
      if (updates.project_id !== undefined) {
        fields.push('project_id = ?');
        values.push(updates.project_id);
      }
      if (updates.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updates.metadata));
      }
      if (updates.embedding !== undefined) {
        fields.push('embedding = ?');
        values.push(JSON.stringify(updates.embedding));
      }
      
      if (fields.length === 0) return false;
      
      // Update search tokens if title or content changed
      if (updates.title !== undefined || updates.content !== undefined) {
        const current = await getAsync<Knowledge>(conn, 'SELECT title, content FROM knowledge WHERE id = ?', [id]);
        const title = updates.title !== undefined ? updates.title : current?.title || '';
        const content = updates.content !== undefined ? updates.content : current?.content || '';
        
        const titleTokens = getSearchTokens(title);
        const contentTokens = getSearchTokens(content);
        const searchTokens = [...new Set([...titleTokens, ...contentTokens])].join(' ');
        
        fields.push('search_tokens = ?');
        values.push(searchTokens);
      }
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const sql = `UPDATE knowledge SET ${fields.join(', ')} WHERE id = ?`;
      await runAsync(conn, sql, values);
      
      return true;
    } catch (error) {
      console.error('Error updating knowledge:', error);
      throw error;
    }
  });

  ipcMain.handle('db:knowledge:delete', async (_, id: string) => {
    try {
      // Delete related links first
      await runAsync(conn, 'DELETE FROM knowledge_links WHERE source_id = ? OR target_id = ?', [id, id]);
      
      // Delete knowledge
      await runAsync(conn, 'DELETE FROM knowledge WHERE id = ?', [id]);
      
      return true;
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      throw error;
    }
  });

  // Character Management Handlers
  ipcMain.handle('db:characters:list', async (_, project_id?: string) => {
    try {
      let sql = 'SELECT * FROM characters';
      const params: unknown[] = [];
      
      if (project_id) {
        sql += ' WHERE project_id = ?';
        params.push(project_id);
      }
      
      sql += ' ORDER BY name';
      
      return await queryAsync<Character>(conn, sql, params);
    } catch (error) {
      console.error('Error listing characters:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:get', async (_, id: string) => {
    try {
      const sql = 'SELECT * FROM characters WHERE id = ?';
      const row = await getAsync<any>(conn, sql, [id]);
      if (row && row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    } catch (error) {
      console.error('Error getting character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:create', async (_, character: Omit<Character, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO characters (
          id, project_id, name, profile, personality, speech_style,
          background, dialogue_samples, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await runAsync(conn, sql, [
        id,
        character.project_id,
        character.name,
        character.profile || null,
        character.personality || null,
        character.speech_style || null,
        character.background || null,
        character.dialogue_samples || null,
        JSON.stringify(character.metadata || {})
      ]);
      
      return { id, ...character };
    } catch (error) {
      console.error('Error creating character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:update', async (_, id: string, updates: Partial<Character>) => {
    try {
      const fields = [];
      const values = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.profile !== undefined) {
        fields.push('profile = ?');
        values.push(updates.profile);
      }
      if (updates.personality !== undefined) {
        fields.push('personality = ?');
        values.push(updates.personality);
      }
      if (updates.speech_style !== undefined) {
        fields.push('speech_style = ?');
        values.push(updates.speech_style);
      }
      if (updates.background !== undefined) {
        fields.push('background = ?');
        values.push(updates.background);
      }
      if (updates.dialogue_samples !== undefined) {
        fields.push('dialogue_samples = ?');
        values.push(updates.dialogue_samples);
      }
      if (updates.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updates.metadata));
      }
      
      if (fields.length === 0) return false;
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const sql = `UPDATE characters SET ${fields.join(', ')} WHERE id = ?`;
      await runAsync(conn, sql, values);
      
      return true;
    } catch (error) {
      console.error('Error updating character:', error);
      throw error;
    }
  });

  ipcMain.handle('db:characters:delete', async (_, id: string) => {
    try {
      const sql = 'DELETE FROM characters WHERE id = ?';
      await runAsync(conn, sql, [id]);
      return true;
    } catch (error) {
      console.error('Error deleting character:', error);
      throw error;
    }
  });

  // Plot Management Handlers
  ipcMain.handle('db:plots:list', async (_, project_id?: string) => {
    try {
      let sql = `
        SELECT p.*, COUNT(c.id) as chapter_count
        FROM plots p
        LEFT JOIN chapters c ON p.id = c.plot_id
      `;
      
      const params: unknown[] = [];
      if (project_id) {
        sql += ' WHERE p.project_id = ?';
        params.push(project_id);
      }
      
      sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
      
      return await queryAsync<Plot>(conn, sql, params);
    } catch (error) {
      console.error('Error listing plots:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:get', async (_, id: string) => {
    try {
      const sql = 'SELECT * FROM plots WHERE id = ?';
      const row = await getAsync<any>(conn, sql, [id]);
      if (row && row.structure) {
        row.structure = JSON.parse(row.structure);
      }
      if (row && row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    } catch (error) {
      console.error('Error getting plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:create', async (_, plot: Omit<Plot, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO plots (
          id, project_id, version, parent_version, title, synopsis,
          structure, status, created_by, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await runAsync(conn, sql, [
        id,
        plot.project_id,
        plot.version,
        plot.parent_version || null,
        plot.title,
        plot.synopsis,
        JSON.stringify(plot.structure),
        plot.status || 'draft',
        plot.created_by,
        JSON.stringify(plot.metadata || {})
      ]);
      
      return { id, ...plot };
    } catch (error) {
      console.error('Error creating plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:update', async (_, id: string, updates: Partial<Plot>) => {
    try {
      const fields = [];
      const values = [];
      
      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.synopsis !== undefined) {
        fields.push('synopsis = ?');
        values.push(updates.synopsis);
      }
      if (updates.structure !== undefined) {
        fields.push('structure = ?');
        values.push(JSON.stringify(updates.structure));
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updates.metadata));
      }
      
      if (fields.length === 0) return false;
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const sql = `UPDATE plots SET ${fields.join(', ')} WHERE id = ?`;
      await runAsync(conn, sql, values);
      
      return true;
    } catch (error) {
      console.error('Error updating plot:', error);
      throw error;
    }
  });

  ipcMain.handle('db:plots:delete', async (_, id: string) => {
    try {
      // Delete related chapters first
      await runAsync(conn, 'DELETE FROM chapters WHERE plot_id = ?', [id]);
      
      // Delete plot
      await runAsync(conn, 'DELETE FROM plots WHERE id = ?', [id]);
      
      return true;
    } catch (error) {
      console.error('Error deleting plot:', error);
      throw error;
    }
  });

  // Chapter Management Handlers
  ipcMain.handle('db:chapters:list', async (_, filters?: { project_id?: string; plot_id?: string }) => {
    try {
      let sql = 'SELECT * FROM chapters WHERE 1=1';
      const params: unknown[] = [];
      
      if (filters?.project_id) {
        sql += ' AND project_id = ?';
        params.push(filters.project_id);
      }
      if (filters?.plot_id) {
        sql += ' AND plot_id = ?';
        params.push(filters.plot_id);
      }
      
      sql += ' ORDER BY chapter_number';
      
      return await queryAsync<Chapter>(conn, sql, params);
    } catch (error) {
      console.error('Error listing chapters:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:get', async (_, id: string) => {
    try {
      const sql = 'SELECT * FROM chapters WHERE id = ?';
      const row = await getAsync<any>(conn, sql, [id]);
      if (row && row.metadata) {
        row.metadata = JSON.parse(row.metadata);
      }
      return row;
    } catch (error) {
      console.error('Error getting chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:create', async (_, chapter: Omit<Chapter, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = uuidv4();
      
      // Calculate word count
      const wordCount = chapter.content.trim().split(/\s+/).length;
      
      const sql = `
        INSERT INTO chapters (
          id, project_id, plot_id, chapter_number, title, content,
          word_count, status, version, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await runAsync(conn, sql, [
        id,
        chapter.project_id,
        chapter.plot_id,
        chapter.chapter_number,
        chapter.title,
        chapter.content,
        wordCount,
        chapter.status || 'draft',
        chapter.version || 1,
        JSON.stringify(chapter.metadata || {})
      ]);
      
      return { id, ...chapter, word_count: wordCount };
    } catch (error) {
      console.error('Error creating chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:update', async (_, id: string, updates: Partial<Chapter>) => {
    try {
      const fields = [];
      const values = [];
      
      if (updates.title !== undefined) {
        fields.push('title = ?');
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        fields.push('content = ?');
        values.push(updates.content);
        
        // Update word count
        const wordCount = updates.content.trim().split(/\s+/).length;
        fields.push('word_count = ?');
        values.push(wordCount);
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.version !== undefined) {
        fields.push('version = ?');
        values.push(updates.version);
      }
      if (updates.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updates.metadata));
      }
      
      if (fields.length === 0) return false;
      
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      const sql = `UPDATE chapters SET ${fields.join(', ')} WHERE id = ?`;
      await runAsync(conn, sql, values);
      
      return true;
    } catch (error) {
      console.error('Error updating chapter:', error);
      throw error;
    }
  });

  ipcMain.handle('db:chapters:delete', async (_, id: string) => {
    try {
      const sql = 'DELETE FROM chapters WHERE id = ?';
      await runAsync(conn, sql, [id]);
      return true;
    } catch (error) {
      console.error('Error deleting chapter:', error);
      throw error;
    }
  });

  // Hybrid Search Handler
  ipcMain.handle('db:search:hybrid', async (_, options: SearchOptions) => {
    try {
      const weights = options.weights || {
        fts: 0.3,
        vss: 0.5,
        serendipity: 0.2
      };
      
      // Generate query embedding
      let queryEmbedding: number[] | null = null;
      try {
        const localService = LocalEmbeddingService.getInstance();
        await localService.initialize();
        queryEmbedding = await localService.generateEmbedding(options.query);
      } catch (error) {
        console.warn('Failed to generate query embedding:', error);
      }
      
      // If no embedding, fall back to FTS only
      if (!queryEmbedding) {
        const sql = `
          SELECT 
            id, title, content, type, metadata,
            1.0 as final_score,
            'fts' as sources
          FROM knowledge
          WHERE title LIKE ? OR content LIKE ?
          ${options.project_id ? 'AND (project_id = ? OR project_id IS NULL)' : ''}
          ORDER BY created_at DESC
          LIMIT ?
        `;
        
        const params = [
          `%${options.query}%`,
          `%${options.query}%`,
          ...(options.project_id ? [options.project_id] : []),
          options.limit || 20
        ];
        
        const results = await queryAsync<any>(conn, sql, params);
        return results.map(r => ({
          ...r,
          metadata: r.metadata ? JSON.parse(r.metadata) : {}
        }));
      }
      
      // Full hybrid search with embeddings
      const searchResults = await performHybridSearch(
        conn,
        options.query,
        queryEmbedding,
        weights,
        options.limit || 20,
        options.project_id
      );
      
      // Apply reranking
      return await rerankResults(searchResults, options);
    } catch (error) {
      console.error('Error in hybrid search:', error);
      throw error;
    }
  });

  // Agent Discussion Handlers
  ipcMain.handle('db:discussions:list', async (_, filters?: { project_id?: string; status?: string }) => {
    try {
      let sql = `
        SELECT d.*, COUNT(m.id) as message_count
        FROM agent_discussions d
        LEFT JOIN agent_messages m ON d.id = m.discussion_id
        WHERE 1=1
      `;
      
      const params: unknown[] = [];
      if (filters?.project_id) {
        sql += ' AND d.project_id = ?';
        params.push(filters.project_id);
      }
      if (filters?.status) {
        sql += ' AND d.status = ?';
        params.push(filters.status);
      }
      
      sql += ' GROUP BY d.id ORDER BY d.updated_at DESC';
      
      const results = await queryAsync<any>(conn, sql, params);
      return results.map(r => ({
        ...r,
        participants: JSON.parse(r.participants),
        metadata: r.metadata ? JSON.parse(r.metadata) : {}
      }));
    } catch (error) {
      console.error('Error listing discussions:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:get', async (_, id: string) => {
    try {
      const sql = 'SELECT * FROM agent_discussions WHERE id = ?';
      const row = await getAsync<any>(conn, sql, [id]);
      if (row) {
        row.participants = JSON.parse(row.participants);
        row.metadata = row.metadata ? JSON.parse(row.metadata) : {};
      }
      return row;
    } catch (error) {
      console.error('Error getting discussion:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:create', async (_, discussion: Omit<AgentDiscussion, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO agent_discussions (
          id, project_id, plot_id, chapter_id, topic, status,
          thread_id, participants, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await runAsync(conn, sql, [
        id,
        discussion.project_id || null,
        discussion.plot_id || null,
        discussion.chapter_id || null,
        discussion.topic,
        discussion.status || 'active',
        discussion.thread_id,
        JSON.stringify(discussion.participants),
        JSON.stringify(discussion.metadata || {})
      ]);
      
      return { id, ...discussion };
    } catch (error) {
      console.error('Error creating discussion:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:addMessage', async (_, message: Omit<AgentMessage, 'id' | 'created_at'>) => {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO agent_messages (
          id, discussion_id, agent_role, agent_name, message,
          message_type, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await runAsync(conn, sql, [
        id,
        message.discussion_id,
        message.agent_role,
        message.agent_name || null,
        message.message,
        message.message_type || 'text',
        JSON.stringify(message.metadata || {})
      ]);
      
      // Update discussion timestamp
      await runAsync(
        conn,
        'UPDATE agent_discussions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [message.discussion_id]
      );
      
      return { id, ...message };
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  });

  ipcMain.handle('db:discussions:getMessages', async (_, discussion_id: string) => {
    try {
      const sql = `
        SELECT * FROM agent_messages
        WHERE discussion_id = ?
        ORDER BY created_at
      `;
      
      const results = await queryAsync<any>(conn, sql, [discussion_id]);
      return results.map(r => ({
        ...r,
        metadata: r.metadata ? JSON.parse(r.metadata) : {}
      }));
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  });

  // Knowledge Links Handlers
  ipcMain.handle('db:links:create', async (_, link: Omit<KnowledgeLink, 'id' | 'created_at'>) => {
    try {
      const id = uuidv4();
      const sql = `
        INSERT INTO knowledge_links (
          id, source_id, target_id, link_type, strength, metadata
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (source_id, target_id) DO UPDATE
        SET link_type = excluded.link_type,
            strength = excluded.strength,
            metadata = excluded.metadata
      `;
      
      await runAsync(conn, sql, [
        id,
        link.source_id,
        link.target_id,
        link.link_type || 'related',
        link.strength || 0.5,
        JSON.stringify(link.metadata || {})
      ]);
      
      return { id, ...link };
    } catch (error) {
      console.error('Error creating link:', error);
      throw error;
    }
  });

  ipcMain.handle('db:links:getForNode', async (_, node_id: string) => {
    try {
      const sql = `
        SELECT l.*, 
               k1.title as source_title,
               k2.title as target_title
        FROM knowledge_links l
        JOIN knowledge k1 ON l.source_id = k1.id
        JOIN knowledge k2 ON l.target_id = k2.id
        WHERE l.source_id = ? OR l.target_id = ?
        ORDER BY l.strength DESC
      `;
      
      const results = await queryAsync<any>(conn, sql, [node_id, node_id]);
      return results.map(r => ({
        ...r,
        metadata: r.metadata ? JSON.parse(r.metadata) : {}
      }));
    } catch (error) {
      console.error('Error getting links:', error);
      throw error;
    }
  });

  // Analytics Handlers
  ipcMain.handle('db:analytics:overview', async (_) => {
    try {
      const [projects, knowledge, chapters, characters, discussions] = await Promise.all([
        queryAsync<{ count: number }>(conn, 'SELECT COUNT(*) as count FROM projects WHERE status = "active"'),
        queryAsync<{ count: number }>(conn, 'SELECT COUNT(*) as count FROM knowledge'),
        queryAsync<{ count: number; total_words: number }>(
          conn,
          'SELECT COUNT(*) as count, COALESCE(SUM(word_count), 0) as total_words FROM chapters'
        ),
        queryAsync<{ count: number }>(conn, 'SELECT COUNT(*) as count FROM characters'),
        queryAsync<{ count: number }>(conn, 'SELECT COUNT(*) as count FROM agent_discussions WHERE status = "active"')
      ]);
      
      return {
        projects: projects[0]?.count || 0,
        knowledge: knowledge[0]?.count || 0,
        chapters: chapters[0]?.count || 0,
        totalWords: chapters[0]?.total_words || 0,
        characters: characters[0]?.count || 0,
        activeDiscussions: discussions[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting analytics overview:', error);
      throw error;
    }
  });

  ipcMain.handle('db:analytics:activity', async (_, days: number = 30) => {
    try {
      const sql = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          'knowledge' as type
        FROM knowledge
        WHERE created_at >= DATE('now', '-${days} days')
        GROUP BY DATE(created_at)
        
        UNION ALL
        
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          'chapter' as type
        FROM chapters
        WHERE created_at >= DATE('now', '-${days} days')
        GROUP BY DATE(created_at)
        
        UNION ALL
        
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          'discussion' as type
        FROM agent_discussions
        WHERE created_at >= DATE('now', '-${days} days')
        GROUP BY DATE(created_at)
        
        ORDER BY date DESC
      `;
      
      return await queryAsync<any>(conn, sql);
    } catch (error) {
      console.error('Error getting activity analytics:', error);
      throw error;
    }
  });

  // App Settings Handlers
  ipcMain.handle('db:settings:get', async (_, key: string) => {
    try {
      const sql = 'SELECT value FROM app_settings WHERE key = ?';
      const row = await getAsync<{ value: any }>(conn, sql, [key]);
      return row ? JSON.parse(row.value) : null;
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  });

  ipcMain.handle('db:settings:set', async (_, key: string, value: any) => {
    try {
      const sql = `
        INSERT INTO app_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE
        SET value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
      `;
      
      await runAsync(conn, sql, [key, JSON.stringify(value)]);
      return true;
    } catch (error) {
      console.error('Error setting value:', error);
      throw error;
    }
  });

  ipcMain.handle('db:settings:getAll', async (_) => {
    try {
      const sql = 'SELECT key, value FROM app_settings';
      const rows = await queryAsync<{ key: string; value: string }>(conn, sql);
      
      const settings: Record<string, any> = {};
      for (const row of rows) {
        settings[row.key] = JSON.parse(row.value);
      }
      
      return settings;
    } catch (error) {
      console.error('Error getting all settings:', error);
      throw error;
    }
  });
}

// Helper function for hybrid search
async function performHybridSearch(
  conn: duckdb.Connection,
  query: string,
  queryEmbedding: number[],
  weights: { fts: number; vss: number; serendipity: number },
  limit: number,
  projectId?: string
): Promise<SearchResult[]> {
  // For now, implement a simplified version
  // In production, this would use DuckDB VSS extension for vector search
  
  const searchTokens = getSearchTokens(query);
  // const searchPattern = searchTokens.join(' '); // TODO: Use for advanced search
  
  let sql = `
    SELECT 
      id, title, content, type, metadata,
      CASE 
        WHEN title LIKE ? THEN 1.0
        WHEN content LIKE ? THEN 0.8
        ELSE 0.0
      END as fts_score,
      0.0 as vss_score,
      0.0 as serendipity_score,
      'fts' as sources
    FROM knowledge
    WHERE (title LIKE ? OR content LIKE ?)
  `;
  
  const params = [
    `%${query}%`,
    `%${query}%`,
    `%${query}%`,
    `%${query}%`
  ];
  
  if (projectId) {
    sql += ' AND (project_id = ? OR project_id IS NULL)';
    params.push(projectId);
  }
  
  sql += ' ORDER BY fts_score DESC LIMIT ?';
  params.push(String(limit));
  
  const results = await queryAsync<any>(conn, sql, params);
  
  return results.map(r => ({
    id: r.id,
    title: r.title,
    content: r.content,
    type: r.type,
    final_score: r.fts_score * weights.fts,
    sources: r.sources,
    fts_score: r.fts_score,
    vss_score: r.vss_score,
    serendipity_score: r.serendipity_score,
    metadata: r.metadata ? JSON.parse(r.metadata) : {}
  }));
}

// Helper function for reranking
async function rerankResults(
  results: SearchResult[],
  options: SearchOptions
): Promise<SearchResult[]> {
  // Apply time decay
  const now = new Date();
  
  return results.map(result => {
    let adjustedScore = result.final_score;
    
    // Time decay calculation (if created_at is available in metadata)
    if (result.metadata?.created_at) {
      const createdAt = new Date(result.metadata.created_at as string | number | Date);
      const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-ageInDays / 30); // 30-day half-life
      adjustedScore *= timeDecay;
    }
    
    // Serendipity mode adjustments
    if (options.mode === 'serendipity') {
      // Add randomness for serendipity
      adjustedScore += Math.random() * 0.2;
    }
    
    return {
      ...result,
      time_decay: result.metadata?.created_at ? 
        Math.exp(-(now.getTime() - new Date(result.metadata.created_at as string | number | Date).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 
        1.0,
      adjusted_score: adjustedScore
    };
  }).sort((a, b) => (b.adjusted_score || 0) - (a.adjusted_score || 0));
}