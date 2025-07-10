const BaseRepository = require('./base-repository');

class ProjectRepository extends BaseRepository {
  constructor(db) {
    super(db, 'projects');
  }

  /**
   * Find project with statistics
   * @param {number} projectId
   * @returns {Object|null}
   */
  findWithStats(projectId) {
    try {
      const query = `
        SELECT 
          p.*,
          COUNT(DISTINCT k.id) as knowledge_count,
          COUNT(DISTINCT c.id) as character_count,
          COUNT(DISTINCT pl.id) as plot_count,
          COUNT(DISTINCT ch.id) as chapter_count
        FROM projects p
        LEFT JOIN knowledge k ON p.id = k.project_id
        LEFT JOIN characters c ON p.id = c.project_id
        LEFT JOIN plots pl ON p.id = pl.project_id
        LEFT JOIN chapters ch ON p.id = ch.project_id
        WHERE p.id = ?
        GROUP BY p.id
      `;

      if (this.db.prepare) {
        const stmt = this.db.prepare(query);
        return stmt.get(projectId);
      }
      return null;
    } catch (error) {
      console.error('Error finding project with stats:', error);
      throw error;
    }
  }

  /**
   * Get all active projects
   * @returns {Array}
   */
  getActiveProjects() {
    try {
      if (this.db.prepare) {
        const stmt = this.db.prepare('SELECT * FROM active_projects_view');
        return stmt.all();
      }
      return [];
    } catch (error) {
      console.error('Error getting active projects:', error);
      throw error;
    }
  }

  /**
   * Create a new project with default settings
   * @param {Object} projectData
   * @returns {Object}
   */
  createWithDefaults(projectData) {
    return this.transaction(() => {
      // Create the project
      const project = this.create(projectData);

      // Create default autonomous config
      if (this.db.prepare && project) {
        const stmt = this.db.prepare(`
          INSERT INTO autonomous_config (project_id)
          VALUES (?)
        `);
        stmt.run(project.id);
      }

      return project;
    });
  }

  /**
   * Get project activity summary
   * @param {number} projectId
   * @param {number} days - Number of days to look back
   * @returns {Object}
   */
  getActivitySummary(projectId, days = 7) {
    try {
      const query = `
        SELECT 
          type,
          COUNT(*) as count,
          DATE(created_at) as activity_date
        FROM recent_activities_view
        WHERE project_id = ?
          AND created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY type, DATE(created_at)
        ORDER BY activity_date DESC
      `;

      if (this.db.prepare) {
        const stmt = this.db.prepare(query);
        const activities = stmt.all(projectId, days);

        // Group by type
        const summary = {
          knowledge: 0,
          character: 0,
          plot: 0,
          total: 0
        };

        activities.forEach(activity => {
          summary[activity.type] += activity.count;
          summary.total += activity.count;
        });

        return summary;
      }
      return { knowledge: 0, character: 0, plot: 0, total: 0 };
    } catch (error) {
      console.error('Error getting activity summary:', error);
      throw error;
    }
  }

  /**
   * Export project data
   * @param {number} projectId
   * @returns {Object}
   */
  exportProject(projectId) {
    try {
      const project = this.findById(projectId);
      if (!project) return null;

      const exportData = {
        project,
        knowledge: [],
        characters: [],
        plots: [],
        chapters: []
      };

      if (this.db.prepare) {
        // Export knowledge
        exportData.knowledge = this.db.prepare(
          'SELECT * FROM knowledge WHERE project_id = ?'
        ).all(projectId);

        // Export characters
        exportData.characters = this.db.prepare(
          'SELECT * FROM characters WHERE project_id = ?'
        ).all(projectId);

        // Export plots
        exportData.plots = this.db.prepare(
          'SELECT * FROM plots WHERE project_id = ?'
        ).all(projectId);

        // Export chapters
        exportData.chapters = this.db.prepare(
          'SELECT * FROM chapters WHERE project_id = ?'
        ).all(projectId);
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting project:', error);
      throw error;
    }
  }

  /**
   * Get project statistics
   * @param {number} projectId
   * @returns {Object}
   */
  getProjectStats(projectId) {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT k.id) as knowledge_count,
          COUNT(DISTINCT c.id) as character_count,
          COUNT(DISTINCT pl.id) as plot_count,
          COUNT(DISTINCT ch.id) as chapter_count,
          COALESCE(SUM(ch.word_count), 0) as total_words
        FROM projects p
        LEFT JOIN knowledge k ON p.id = k.project_id
        LEFT JOIN characters c ON p.id = c.project_id
        LEFT JOIN plots pl ON p.id = pl.project_id
        LEFT JOIN chapters ch ON p.id = ch.project_id
        WHERE p.id = ?
        GROUP BY p.id
      `;

      if (this.db.prepare) {
        const stmt = this.db.prepare(query);
        return stmt.get(projectId) || {
          knowledge_count: 0,
          character_count: 0,
          plot_count: 0,
          chapter_count: 0,
          total_words: 0
        };
      }
      return {
        knowledge_count: 0,
        character_count: 0,
        plot_count: 0,
        chapter_count: 0,
        total_words: 0
      };
    } catch (error) {
      console.error('Error getting project stats:', error);
      throw error;
    }
  }

  /**
   * Get project timeline
   * @param {number} projectId
   * @param {number} limit
   * @returns {Array}
   */
  getTimeline(projectId, limit = 20) {
    try {
      const query = `
        SELECT 
          'knowledge' as type,
          title as name,
          created_at,
          updated_at
        FROM knowledge
        WHERE project_id = ?
        UNION ALL
        SELECT 
          'character' as type,
          name,
          created_at,
          updated_at
        FROM characters
        WHERE project_id = ?
        UNION ALL
        SELECT 
          'plot' as type,
          title as name,
          created_at,
          updated_at
        FROM plots
        WHERE project_id = ?
        UNION ALL
        SELECT 
          'chapter' as type,
          title as name,
          created_at,
          updated_at
        FROM chapters
        WHERE project_id = ?
        ORDER BY updated_at DESC
        LIMIT ?
      `;

      if (this.db.prepare) {
        const stmt = this.db.prepare(query);
        return stmt.all(projectId, projectId, projectId, projectId, limit);
      }
      return [];
    } catch (error) {
      console.error('Error getting project timeline:', error);
      throw error;
    }
  }
}

module.exports = ProjectRepository;