import { BaseRepository } from './base-repository'
import { Chapter, Plot, Scene, ChapterVersion, WritingStatistics } from '../../../shared/types/chapter'
import { getLogger } from '../utils/logger'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const logger = getLogger('chapter-repository')

export class ChapterRepository extends BaseRepository {
  private chaptersPath: string

  constructor() {
    super()
    this.chaptersPath = join(app.getPath('userData'), 'chapters')
    this.createTables()
    this.ensureChaptersDirectory()
  }

  private createTables(): void {
    // Plots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plots (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Chapters table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        plot_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plot_id) REFERENCES plots(id) ON DELETE CASCADE
      )
    `)

    // Scenes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )
    `)

    // Chapter versions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chapter_versions (
        id TEXT PRIMARY KEY,
        chapter_id TEXT NOT NULL,
        content TEXT NOT NULL,
        word_count INTEGER DEFAULT 0,
        version_number INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )
    `)

    // Writing statistics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS writing_statistics (
        project_id INTEGER PRIMARY KEY,
        total_words INTEGER DEFAULT 0,
        today_words INTEGER DEFAULT 0,
        average_words_per_day REAL DEFAULT 0,
        writing_days INTEGER DEFAULT 0,
        last_writing_date DATE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plots_project ON plots(project_id);
      CREATE INDEX IF NOT EXISTS idx_chapters_plot ON chapters(plot_id);
      CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id);
      CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter ON chapter_versions(chapter_id);
    `)

    logger.info('Chapter tables created successfully')
  }

  private ensureChaptersDirectory(): void {
    if (!existsSync(this.chaptersPath)) {
      mkdirSync(this.chaptersPath, { recursive: true })
    }
  }

  // Plot methods
  createPlot(plot: Omit<Plot, 'id' | 'createdAt' | 'updatedAt'>): Plot {
    const id = this.generateId('plot')
    const now = new Date()
    const stmt = this.db.prepare(`
      INSERT INTO plots (id, project_id, title, summary, order_index)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, plot.projectId, plot.title, plot.summary || null, plot.order)

    logger.info(`Created plot: ${id}`)
    return { ...plot, id, createdAt: now, updatedAt: now }
  }

  getPlot(id: string): Plot | undefined {
    const stmt = this.db.prepare('SELECT * FROM plots WHERE id = ?')
    const row = stmt.get(id)

    if (!row) return undefined

    return this.mapRowToPlot(row)
  }

  getPlotsByProject(projectId: number): Plot[] {
    const stmt = this.db.prepare('SELECT * FROM plots WHERE project_id = ? ORDER BY order_index')
    const rows = stmt.all(projectId)

    return rows.map(row => this.mapRowToPlot(row))
  }

  updatePlot(id: string, updates: Partial<Plot>): Plot | undefined {
    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
        const dbField = key === 'order' ? 'order_index' : this.camelToSnake(key)
        fields.push(`${dbField} = ?`)
        values.push(value)
      }
    })

    if (fields.length === 0) return this.getPlot(id)

    values.push(id)
    const stmt = this.db.prepare(`
      UPDATE plots 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    stmt.run(...values)
    logger.info(`Updated plot: ${id}`)

    return this.getPlot(id)
  }

  deletePlot(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM plots WHERE id = ?')
    const result = stmt.run(id)

    logger.info(`Deleted plot: ${id}`)
    return result.changes > 0
  }

  // Chapter methods
  createChapter(chapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt' | 'content'>): Chapter {
    const id = this.generateId('chapter')
    const now = new Date()
    const stmt = this.db.prepare(`
      INSERT INTO chapters (id, plot_id, title, summary, order_index, word_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      chapter.plotId,
      chapter.title,
      chapter.summary || null,
      chapter.order,
      chapter.wordCount,
      chapter.status
    )

    // Create empty chapter file
    const chapterPath = this.getChapterPath(chapter.plotId, id)
    writeFileSync(chapterPath, '')

    logger.info(`Created chapter: ${id}`)
    return { ...chapter, id, createdAt: now, updatedAt: now }
  }

  getChapter(id: string, includeContent = false): Chapter | undefined {
    const stmt = this.db.prepare('SELECT * FROM chapters WHERE id = ?')
    const row = stmt.get(id)

    if (!row) return undefined

    const chapter = this.mapRowToChapter(row)

    if (includeContent) {
      const content = this.loadChapterContent((row as any).plot_id, id)
      chapter.content = content
    }

    return chapter
  }

  getChaptersByPlot(plotId: string, includeContent = false): Chapter[] {
    const stmt = this.db.prepare('SELECT * FROM chapters WHERE plot_id = ? ORDER BY order_index')
    const rows = stmt.all(plotId)

    return rows.map(row => {
      const chapter = this.mapRowToChapter(row)
      if (includeContent) {
        chapter.content = this.loadChapterContent(plotId, chapter.id)
      }
      return chapter
    })
  }

  updateChapter(id: string, updates: Partial<Chapter>): Chapter | undefined {
    const chapter = this.getChapter(id)
    if (!chapter) return undefined

    // Handle content separately
    if (updates.content !== undefined) {
      this.saveChapterContent(chapter.plotId, id, updates.content)
      // Update word count
      updates.wordCount = this.countWords(updates.content)
    }

    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'content') {
        const dbField = key === 'order' ? 'order_index' : this.camelToSnake(key)
        fields.push(`${dbField} = ?`)
        values.push(value)
      }
    })

    if (fields.length > 0) {
      values.push(id)
      const stmt = this.db.prepare(`
        UPDATE chapters 
        SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)

      stmt.run(...values)
    }

    logger.info(`Updated chapter: ${id}`)
    return this.getChapter(id, true)
  }

  deleteChapter(id: string): boolean {
    const chapter = this.getChapter(id)
    if (!chapter) return false

    const stmt = this.db.prepare('DELETE FROM chapters WHERE id = ?')
    const result = stmt.run(id)

    // Delete chapter file
    const chapterPath = this.getChapterPath(chapter.plotId, id)
    if (existsSync(chapterPath)) {
      // Archive instead of delete
      const archivePath = chapterPath + `.deleted_${Date.now()}`
      writeFileSync(archivePath, readFileSync(chapterPath))
    }

    logger.info(`Deleted chapter: ${id}`)
    return result.changes > 0
  }

  // Chapter content methods
  private getChapterPath(plotId: string, chapterId: string): string {
    const plotDir = join(this.chaptersPath, plotId)
    if (!existsSync(plotDir)) {
      mkdirSync(plotDir, { recursive: true })
    }
    return join(plotDir, `${chapterId}.txt`)
  }

  private loadChapterContent(plotId: string, chapterId: string): string {
    const chapterPath = this.getChapterPath(plotId, chapterId)
    if (existsSync(chapterPath)) {
      return readFileSync(chapterPath, 'utf-8')
    }
    return ''
  }

  private saveChapterContent(plotId: string, chapterId: string, content: string): void {
    const chapterPath = this.getChapterPath(plotId, chapterId)
    writeFileSync(chapterPath, content, 'utf-8')
  }

  private countWords(text: string): number {
    // Japanese word counting (characters) + English word counting
    const japaneseChars = text.match(/[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]/g) || []
    const englishWords = text.match(/\b[a-zA-Z]+\b/g) || []
    return japaneseChars.length + englishWords.length
  }

  // Scene methods
  createScene(scene: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>): Scene {
    const id = this.generateId('scene')
    const now = new Date()
    const stmt = this.db.prepare(`
      INSERT INTO scenes (id, chapter_id, title, summary, order_index)
      VALUES (?, ?, ?, ?, ?)
    `)

    stmt.run(id, scene.chapterId, scene.title, scene.summary || null, scene.order)

    logger.info(`Created scene: ${id}`)
    return { ...scene, id, createdAt: now, updatedAt: now }
  }

  getScenesByChapter(chapterId: string): Scene[] {
    const stmt = this.db.prepare('SELECT * FROM scenes WHERE chapter_id = ? ORDER BY order_index')
    const rows = stmt.all(chapterId)

    return rows.map(row => this.mapRowToScene(row))
  }

  // Version management
  createChapterVersion(chapterId: string, content: string): ChapterVersion {
    const id = this.generateId('ver')
    const wordCount = this.countWords(content)

    // Get current version number
    const stmt = this.db.prepare(
      'SELECT MAX(version_number) as max_version FROM chapter_versions WHERE chapter_id = ?'
    )
    const row = stmt.get(chapterId)
    const versionNumber = ((row as any)?.max_version || 0) + 1

    const insertStmt = this.db.prepare(`
      INSERT INTO chapter_versions (id, chapter_id, content, word_count, version_number)
      VALUES (?, ?, ?, ?, ?)
    `)

    insertStmt.run(id, chapterId, content, wordCount, versionNumber)

    // Keep only last 10 versions
    const deleteStmt = this.db.prepare(`
      DELETE FROM chapter_versions 
      WHERE chapter_id = ? AND id NOT IN (
        SELECT id FROM chapter_versions 
        WHERE chapter_id = ? 
        ORDER BY version_number DESC 
        LIMIT 10
      )
    `)
    deleteStmt.run(chapterId, chapterId)

    logger.info(`Created chapter version: ${id}`)
    return {
      id,
      chapterId,
      content,
      wordCount,
      versionNumber,
      createdAt: new Date()
    }
  }

  getChapterVersions(chapterId: string): ChapterVersion[] {
    const stmt = this.db.prepare(
      'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY version_number DESC'
    )
    const rows = stmt.all(chapterId)

    return rows.map(row => this.mapRowToChapterVersion(row))
  }

  // Statistics methods
  getWritingStatistics(projectId: number): WritingStatistics | undefined {
    const stmt = this.db.prepare('SELECT * FROM writing_statistics WHERE project_id = ?')
    const row = stmt.get(projectId)

    if (!row) {
      // Create initial statistics
      const initStmt = this.db.prepare(`
        INSERT INTO writing_statistics (project_id) VALUES (?)
      `)
      initStmt.run(projectId)
      return {
        projectId,
        totalWords: 0,
        todayWords: 0,
        averageWordsPerDay: 0,
        writingDays: 0
      }
    }

    return this.mapRowToStatistics(row)
  }

  updateWritingStatistics(projectId: number, wordsDelta: number): void {
    const stats = this.getWritingStatistics(projectId)
    if (!stats) return

    const today = new Date().toISOString().split('T')[0]
    const isNewDay = stats.lastWritingDate?.toISOString().split('T')[0] !== today

    const todayWords = isNewDay ? wordsDelta : stats.todayWords + wordsDelta
    const totalWords = stats.totalWords + wordsDelta
    const writingDays = isNewDay ? stats.writingDays + 1 : stats.writingDays
    const averageWordsPerDay = writingDays > 0 ? totalWords / writingDays : 0

    const stmt = this.db.prepare(`
      UPDATE writing_statistics 
      SET total_words = ?, today_words = ?, average_words_per_day = ?, 
          writing_days = ?, last_writing_date = ?
      WHERE project_id = ?
    `)

    stmt.run(totalWords, todayWords, averageWordsPerDay, writingDays, today, projectId)
  }

  // Helper methods
  private mapRowToPlot(row: any): Plot {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      summary: row.summary,
      order: row.order_index,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapRowToChapter(row: any): Chapter {
    return {
      id: row.id,
      plotId: row.plot_id,
      title: row.title,
      summary: row.summary,
      order: row.order_index,
      wordCount: row.word_count,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapRowToScene(row: any): Scene {
    return {
      id: row.id,
      chapterId: row.chapter_id,
      title: row.title,
      summary: row.summary,
      order: row.order_index,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapRowToChapterVersion(row: any): ChapterVersion {
    return {
      id: row.id,
      chapterId: row.chapter_id,
      content: row.content,
      wordCount: row.word_count,
      versionNumber: row.version_number,
      createdAt: new Date(row.created_at)
    }
  }

  private mapRowToStatistics(row: any): WritingStatistics {
    return {
      projectId: row.project_id,
      totalWords: row.total_words,
      todayWords: row.today_words,
      averageWordsPerDay: row.average_words_per_day,
      writingDays: row.writing_days,
      lastWritingDate: row.last_writing_date ? new Date(row.last_writing_date) : undefined
    }
  }
}