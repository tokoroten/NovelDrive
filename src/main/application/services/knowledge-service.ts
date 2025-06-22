/**
 * 知識管理アプリケーションサービス
 */

import { v4 as uuidv4 } from 'uuid';
import { Knowledge } from '../../domain/entities';
import { IUnitOfWork } from '../../domain/repositories';
import { IEmbeddingService } from '../../services/interfaces';
import { SerendipityService } from '../../domain/services';

export class KnowledgeApplicationService {
  private serendipityService: SerendipityService;

  constructor(
    private uow: IUnitOfWork,
    private embeddingService: IEmbeddingService
  ) {
    this.serendipityService = new SerendipityService();
  }

  /**
   * 知識を作成
   */
  async createKnowledge(data: {
    title: string;
    content: string;
    type: string;
    projectId?: string;
    metadata?: Record<string, any>;
  }): Promise<Knowledge> {
    const knowledge = new Knowledge(
      uuidv4(),
      data.title,
      data.content,
      data.type as any,
      data.projectId || null,
      null,
      data.metadata || {},
      new Date(),
      new Date()
    );

    // 埋め込みを生成
    try {
      const embedding = await this.embeddingService.generateEmbedding(
        `${knowledge.title}\n\n${knowledge.content}`
      );
      knowledge.setEmbedding(embedding);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
    }

    await this.uow.knowledge.save(knowledge);
    return knowledge;
  }

  /**
   * 知識を更新
   */
  async updateKnowledge(id: string, updates: {
    title?: string;
    content?: string;
    type?: string;
    metadata?: Record<string, any>;
  }): Promise<Knowledge> {
    const knowledge = await this.uow.knowledge.findById(id);
    if (!knowledge) {
      throw new Error('Knowledge not found');
    }

    knowledge.update({
      title: updates.title,
      content: updates.content,
      type: updates.type as any,
      metadata: updates.metadata
    });

    // 内容が変更された場合は埋め込みを再生成
    if (updates.title || updates.content) {
      try {
        const embedding = await this.embeddingService.generateEmbedding(
          `${knowledge.title}\n\n${knowledge.content}`
        );
        knowledge.setEmbedding(embedding);
      } catch (error) {
        console.error('Failed to regenerate embedding:', error);
      }
    }

    await this.uow.knowledge.save(knowledge);
    return knowledge;
  }

  /**
   * 知識を検索
   */
  async searchKnowledge(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
    serendipityLevel?: number;
  }): Promise<Knowledge[]> {
    if (options?.serendipityLevel && options.serendipityLevel > 0) {
      return this.serendipitySearch(query, options);
    }

    return this.uow.knowledge.search(query, options);
  }

  /**
   * セレンディピティ検索
   */
  private async serendipitySearch(query: string, options: {
    projectId?: string;
    type?: string;
    limit?: number;
    serendipityLevel?: number;
  }): Promise<Knowledge[]> {
    // クエリの埋め込みを生成
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // セレンディピティを注入
    const serendipitousEmbedding = this.serendipityService.injectSerendipity(
      queryEmbedding,
      options.serendipityLevel || 0.3
    );

    // TODO: ベクトル検索の実装
    // 現在は通常の検索にフォールバック
    const results = await this.uow.knowledge.search(query, options);
    
    // ランダムに並び替えてセレンディピティを演出
    return results.sort(() => Math.random() - 0.5);
  }

  /**
   * 知識を削除
   */
  async deleteKnowledge(id: string): Promise<void> {
    const exists = await this.uow.knowledge.exists(id);
    if (!exists) {
      throw new Error('Knowledge not found');
    }

    await this.uow.knowledge.delete(id);
  }

  /**
   * 知識を取得
   */
  async getKnowledge(id: string): Promise<Knowledge> {
    const knowledge = await this.uow.knowledge.findById(id);
    if (!knowledge) {
      throw new Error('Knowledge not found');
    }
    return knowledge;
  }

  /**
   * プロジェクトの知識を取得
   */
  async getProjectKnowledge(projectId: string): Promise<Knowledge[]> {
    return this.uow.knowledge.findByProjectId(projectId);
  }

  /**
   * URLから知識を作成（重複チェック付き）
   */
  async createKnowledgeFromUrl(data: {
    url: string;
    title: string;
    content: string;
    type: string;
    projectId?: string;
    metadata?: Record<string, any>;
  }): Promise<Knowledge> {
    // URL重複チェック
    const exists = await this.uow.knowledge.existsByUrl(data.url);
    if (exists) {
      throw new Error('URL already exists in knowledge base');
    }

    const metadata = {
      ...data.metadata,
      url: data.url,
      sourceUrl: data.url
    };

    return this.createKnowledge({
      ...data,
      metadata
    });
  }
}