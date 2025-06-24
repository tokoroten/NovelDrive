/**
 * リポジトリ層の統合テスト
 */

import { ConnectionManager } from '../../../core/database/connection-manager';
import { ProjectRepository } from '../../project-repository';
import { KnowledgeRepository } from '../../knowledge-repository';
import { ChapterRepository } from '../../chapter-repository';
import { DatabaseMigration } from '../../../services/database-migration';
import { NotFoundError } from '../../../utils/error-handler';
import * as path from 'path';
import * as fs from 'fs';

describe('Repository Integration Tests', () => {
  let connectionManager: ConnectionManager;
  let projectRepo: ProjectRepository;
  let knowledgeRepo: KnowledgeRepository;
  let chapterRepo: ChapterRepository;
  const testDbPath = path.join(__dirname, 'test-integration.db');

  beforeAll(async () => {
    // テスト用データベースの準備
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // ConnectionManagerの初期化
    connectionManager = ConnectionManager.getInstance();
    await connectionManager.initialize({ path: testDbPath });

    // マイグレーションの実行
    const db = connectionManager.getDatabase();
    const migration = new DatabaseMigration(db);
    await migration.migrate();

    // リポジトリの初期化
    projectRepo = new ProjectRepository(connectionManager);
    knowledgeRepo = new KnowledgeRepository(connectionManager);
    chapterRepo = new ChapterRepository(connectionManager);
  });

  afterAll(async () => {
    // クリーンアップ
    await connectionManager.cleanup();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('ProjectRepository', () => {
    it('プロジェクトの作成・取得・更新・削除ができる', async () => {
      // 作成
      const project = await projectRepo.create({
        name: 'テストプロジェクト',
        description: 'これはテスト用のプロジェクトです',
        genre: 'ファンタジー',
        status: 'active'
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('テストプロジェクト');
      expect(project.created_at).toBeInstanceOf(Date);

      // 取得
      const retrieved = await projectRepo.findById(project.id!);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.name).toBe('テストプロジェクト');

      // 更新
      const updated = await projectRepo.update(project.id!, {
        description: '更新された説明'
      });
      expect(updated.description).toBe('更新された説明');

      // 削除
      await projectRepo.delete(project.id!);
      const deleted = await projectRepo.findById(project.id!);
      expect(deleted).toBeNull();
    });

    it('存在しないプロジェクトの更新でエラーが発生する', async () => {
      await expect(
        projectRepo.update('non-existent-id', { name: '新しい名前' })
      ).rejects.toThrow(NotFoundError);
    });

    it('プロジェクトの統計情報を取得できる', async () => {
      const project = await projectRepo.create({
        name: '統計テストプロジェクト',
        status: 'active'
      });

      const stats = await projectRepo.getProjectStats(project.id!);
      expect(stats).toHaveProperty('knowledge_count');
      expect(stats).toHaveProperty('character_count');
      expect(stats).toHaveProperty('plot_count');
      expect(stats).toHaveProperty('chapter_count');
      expect(stats).toHaveProperty('total_word_count');

      await projectRepo.delete(project.id!);
    });
  });

  describe('KnowledgeRepository', () => {
    let testProjectId: string;

    beforeEach(async () => {
      const project = await projectRepo.create({
        name: '知識テストプロジェクト',
        status: 'active'
      });
      testProjectId = project.id!;
    });

    afterEach(async () => {
      await projectRepo.delete(testProjectId);
    });

    it('知識の作成時に埋め込みと検索トークンが生成される', async () => {
      const knowledge = await knowledgeRepo.create({
        title: 'テスト知識',
        content: 'これはテスト用の知識内容です。日本語のトークン化も確認します。',
        type: 'note',
        project_id: testProjectId
      });

      expect(knowledge.id).toBeDefined();
      expect(knowledge.embedding).toBeDefined();
      expect(knowledge.search_tokens).toBeDefined();
      expect(knowledge.search_tokens).toContain('テスト');
      expect(knowledge.search_tokens).toContain('知識');

      await knowledgeRepo.delete(knowledge.id!);
    });

    it('プロジェクトごとの知識を取得できる', async () => {
      // 複数の知識を作成
      const knowledge1 = await knowledgeRepo.create({
        title: '知識1',
        content: '内容1',
        type: 'note',
        project_id: testProjectId
      });

      const knowledge2 = await knowledgeRepo.create({
        title: '知識2',
        content: '内容2',
        type: 'article',
        project_id: testProjectId
      });

      // プロジェクトの知識を取得
      const projectKnowledge = await knowledgeRepo.findByProject(testProjectId);
      expect(projectKnowledge).toHaveLength(2);
      expect(projectKnowledge.map(k => k.title)).toContain('知識1');
      expect(projectKnowledge.map(k => k.title)).toContain('知識2');

      // クリーンアップ
      await knowledgeRepo.delete(knowledge1.id!);
      await knowledgeRepo.delete(knowledge2.id!);
    });

    it('タイプ別の知識を取得できる', async () => {
      const knowledge1 = await knowledgeRepo.create({
        title: 'ノート',
        content: 'ノート内容',
        type: 'note',
        project_id: testProjectId
      });

      const knowledge2 = await knowledgeRepo.create({
        title: '記事',
        content: '記事内容',
        type: 'article',
        project_id: testProjectId
      });

      const notes = await knowledgeRepo.findByType('note', testProjectId);
      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('ノート');

      const articles = await knowledgeRepo.findByType('article', testProjectId);
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('記事');

      await knowledgeRepo.delete(knowledge1.id!);
      await knowledgeRepo.delete(knowledge2.id!);
    });
  });

  describe('ChapterRepository', () => {
    let testProjectId: string;
    let testPlotId: string;

    beforeEach(async () => {
      const project = await projectRepo.create({
        name: '章テストプロジェクト',
        status: 'active'
      });
      testProjectId = project.id!;
      testPlotId = 'test-plot-id';
    });

    afterEach(async () => {
      await projectRepo.delete(testProjectId);
    });

    it('章の作成時に文字数が自動計算される', async () => {
      const content = 'これは日本語のテキストです。スペース　も含まれています。';
      const chapter = await chapterRepo.create({
        project_id: testProjectId,
        plot_id: testPlotId,
        chapter_number: 1,
        title: '第1章',
        content: content,
        status: 'draft'
      });

      expect(chapter.word_count).toBe(content.replace(/\s/g, '').length);
      await chapterRepo.delete(chapter.id!);
    });

    it('章の更新時にバージョンが自動インクリメントされる', async () => {
      const chapter = await chapterRepo.create({
        project_id: testProjectId,
        plot_id: testPlotId,
        chapter_number: 1,
        title: '第1章',
        content: '初期内容',
        status: 'draft'
      });

      expect(chapter.version).toBe(1);

      // 内容を更新
      const updated = await chapterRepo.update(chapter.id!, {
        content: '更新された内容'
      });

      expect(updated.version).toBe(2);
      expect(updated.content).toBe('更新された内容');

      await chapterRepo.delete(chapter.id!);
    });

    it('プロットごとの次の章番号を取得できる', async () => {
      // 初期状態では1
      let nextNumber = await chapterRepo.getNextChapterNumber(testPlotId);
      expect(nextNumber).toBe(1);

      // 章を作成
      const chapter1 = await chapterRepo.create({
        project_id: testProjectId,
        plot_id: testPlotId,
        chapter_number: 1,
        title: '第1章',
        content: '内容',
        status: 'draft'
      });

      const chapter2 = await chapterRepo.create({
        project_id: testProjectId,
        plot_id: testPlotId,
        chapter_number: 2,
        title: '第2章',
        content: '内容',
        status: 'draft'
      });

      // 次は3になるはず
      nextNumber = await chapterRepo.getNextChapterNumber(testPlotId);
      expect(nextNumber).toBe(3);

      await chapterRepo.delete(chapter1.id!);
      await chapterRepo.delete(chapter2.id!);
    });

    it('プロジェクトの総文字数を計算できる', async () => {
      const chapter1 = await chapterRepo.create({
        project_id: testProjectId,
        plot_id: testPlotId,
        chapter_number: 1,
        title: '第1章',
        content: '10文字のテキスト',
        status: 'completed'
      });

      const chapter2 = await chapterRepo.create({
        project_id: testProjectId,
        plot_id: testPlotId,
        chapter_number: 2,
        title: '第2章',
        content: '20文字のテキストが入っています',
        status: 'completed'
      });

      const totalCount = await chapterRepo.getProjectWordCount(testProjectId);
      expect(totalCount).toBe(
        chapter1.word_count + chapter2.word_count
      );

      await chapterRepo.delete(chapter1.id!);
      await chapterRepo.delete(chapter2.id!);
    });
  });

  describe('Transaction Support', () => {
    it('トランザクション内でのロールバックが正しく動作する', async () => {
      const projectName = 'トランザクションテスト';
      
      try {
        await projectRepo.withTransaction(async () => {
          // プロジェクトを作成
          const project = await projectRepo.create({
            name: projectName,
            status: 'active'
          });

          // エラーを発生させてロールバックを引き起こす
          throw new Error('意図的なエラー');
        });
      } catch (error) {
        // エラーは期待される
      }

      // ロールバックされているため、プロジェクトは存在しないはず
      const projects = await projectRepo.findAll();
      const found = projects.find(p => p.name === projectName);
      expect(found).toBeUndefined();
    });
  });
});