/**
 * 分析リポジトリ
 */

import * as duckdb from 'duckdb';
import { AnalyticsOverview, ActivityData } from './types';

export class AnalyticsRepository {
  constructor(private conn: duckdb.Connection) {}

  private executeQuery<R = any>(sql: string, params: any[] = []): Promise<R[]> {
    return new Promise((resolve, reject) => {
      this.conn.all(sql, ...params, (err: Error | null, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as R[]);
        }
      });
    });
  }

  async getOverview(): Promise<AnalyticsOverview> {
    const overviewSql = `
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE status = 'active') as total_projects,
        (SELECT COUNT(*) FROM knowledge) as total_knowledge,
        (SELECT COUNT(*) FROM characters) as total_characters,
        (SELECT COUNT(*) FROM plots) as total_plots,
        (SELECT COUNT(*) FROM chapters) as total_chapters,
        (SELECT COALESCE(SUM(word_count), 0) FROM chapters) as total_word_count
    `;
    
    const overviewResults = await this.executeQuery(overviewSql);
    const overview = overviewResults[0];
    
    // 最近のアクティビティ
    const activitySql = `
      WITH recent_activity AS (
        SELECT 'knowledge' as type, title, created_at FROM knowledge
        UNION ALL
        SELECT 'chapter' as type, title, created_at FROM chapters
        UNION ALL
        SELECT 'plot' as type, title, created_at FROM plots
        UNION ALL
        SELECT 'character' as type, name as title, created_at FROM characters
      )
      SELECT type, title, created_at as timestamp
      FROM recent_activity
      ORDER BY created_at DESC
      LIMIT 10
    `;
    
    const activityResults = await this.executeQuery(activitySql);
    
    return {
      totalProjects: overview.total_projects || 0,
      totalKnowledge: overview.total_knowledge || 0,
      totalCharacters: overview.total_characters || 0,
      totalPlots: overview.total_plots || 0,
      totalChapters: overview.total_chapters || 0,
      totalWordCount: overview.total_word_count || 0,
      recentActivity: activityResults.map(row => ({
        type: row.type,
        title: row.title,
        timestamp: new Date(row.timestamp)
      }))
    };
  }

  async getActivityData(startDate: Date, endDate: Date): Promise<ActivityData[]> {
    const sql = `
      WITH date_series AS (
        SELECT DATE(?) + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY as date
        FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
              UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 
              UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as a
        CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 
                    UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as b
        CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 
                    UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 
                    UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as c
        WHERE DATE(?) + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY <= DATE(?)
      ),
      daily_stats AS (
        SELECT 
          DATE(created_at) as date,
          0 as word_count,
          COUNT(*) as knowledge_count,
          0 as discussion_count
        FROM knowledge
        WHERE created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        
        UNION ALL
        
        SELECT 
          DATE(updated_at) as date,
          SUM(word_count) as word_count,
          0 as knowledge_count,
          0 as discussion_count
        FROM chapters
        WHERE updated_at BETWEEN ? AND ?
        GROUP BY DATE(updated_at)
        
        UNION ALL
        
        SELECT 
          DATE(created_at) as date,
          0 as word_count,
          0 as knowledge_count,
          COUNT(*) as discussion_count
        FROM agent_discussions
        WHERE created_at BETWEEN ? AND ?
        GROUP BY DATE(created_at)
      )
      SELECT 
        ds.date,
        COALESCE(SUM(stats.word_count), 0) as word_count,
        COALESCE(SUM(stats.knowledge_count), 0) as knowledge_count,
        COALESCE(SUM(stats.discussion_count), 0) as discussion_count
      FROM date_series ds
      LEFT JOIN daily_stats stats ON ds.date = stats.date
      GROUP BY ds.date
      ORDER BY ds.date
    `;
    
    const params = [
      startDate.toISOString(),
      startDate.toISOString(),
      endDate.toISOString(),
      startDate.toISOString(),
      endDate.toISOString(),
      startDate.toISOString(),
      endDate.toISOString(),
      startDate.toISOString(),
      endDate.toISOString()
    ];
    
    const results = await this.executeQuery(sql, params);
    
    return results.map(row => ({
      date: row.date,
      wordCount: row.word_count || 0,
      knowledgeCount: row.knowledge_count || 0,
      discussionCount: row.discussion_count || 0
    }));
  }

  async getProjectStats(projectId: string): Promise<any> {
    const sql = `
      SELECT 
        p.name as project_name,
        p.status as project_status,
        (SELECT COUNT(*) FROM knowledge WHERE project_id = p.id) as knowledge_count,
        (SELECT COUNT(*) FROM characters WHERE project_id = p.id) as character_count,
        (SELECT COUNT(*) FROM plots WHERE project_id = p.id) as plot_count,
        (SELECT COUNT(*) FROM chapters WHERE project_id = p.id) as chapter_count,
        (SELECT COALESCE(SUM(word_count), 0) FROM chapters WHERE project_id = p.id) as total_word_count,
        (SELECT COUNT(*) FROM agent_discussions WHERE project_id = p.id) as discussion_count,
        (SELECT COUNT(DISTINCT DATE(created_at)) FROM chapters WHERE project_id = p.id) as writing_days
      FROM projects p
      WHERE p.id = ?
    `;
    
    const results = await this.executeQuery(sql, [projectId]);
    return results[0] || null;
  }

  async getWritingStats(projectId?: string, days = 30): Promise<any> {
    let sql = `
      SELECT 
        COUNT(DISTINCT DATE(updated_at)) as active_days,
        COALESCE(SUM(word_count), 0) as total_words,
        COALESCE(AVG(word_count), 0) as avg_words_per_chapter,
        COALESCE(SUM(word_count) / NULLIF(COUNT(DISTINCT DATE(updated_at)), 0), 0) as avg_words_per_day
      FROM chapters
      WHERE updated_at >= DATE('now', '-${days} days')
    `;
    
    const params: any[] = [];
    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }
    
    const results = await this.executeQuery(sql, params);
    return results[0] || {
      active_days: 0,
      total_words: 0,
      avg_words_per_chapter: 0,
      avg_words_per_day: 0
    };
  }
}