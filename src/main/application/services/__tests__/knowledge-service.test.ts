import { KnowledgeApplicationService } from '../knowledge-service';
import { Knowledge, KnowledgeType } from '../../../domain/entities';
import { IKnowledgeRepository, IUnitOfWork } from '../../../domain/repositories';
import { IEmbeddingService } from '../../../domain/services';
import { IEventBus } from '../../../core/events';

// モックの作成
const mockRepository: jest.Mocked<IKnowledgeRepository> = {
  save: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  findByProjectId: jest.fn(),
  findByType: jest.fn(),
  search: jest.fn(),
  searchSimilar: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  existsByUrl: jest.fn()
};

const mockEmbeddingService: jest.Mocked<IEmbeddingService> = {
  generateEmbedding: jest.fn(),
  generateEmbeddings: jest.fn(),
  cosineSimilarity: jest.fn(),
  findSimilar: jest.fn(),
  extractKeywords: jest.fn()
};

const mockEventBus: jest.Mocked<IEventBus> = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn()
};

// モックUnitOfWork
const mockUnitOfWork: jest.Mocked<IUnitOfWork> = {
  knowledgeRepository: mockRepository,
  projectRepository: jest.fn() as any,
  plotRepository: jest.fn() as any,
  characterRepository: jest.fn() as any,
  worldSettingRepository: jest.fn() as any,
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn()
};

describe('KnowledgeApplicationService', () => {
  let service: KnowledgeApplicationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeApplicationService(
      mockUnitOfWork,
      mockEmbeddingService
    );
  });

  describe('createKnowledge', () => {
    it('should create knowledge with embedding', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockRepository.save.mockResolvedValue(undefined);

      const dto = {
        title: 'テストタイトル',
        content: 'テストコンテンツ',
        type: 'note' as KnowledgeType,
        projectId: 'project-1',
        metadata: { tags: ['test'] }
      };

      const result = await service.createKnowledge(dto);

      expect(result).toBeDefined();
      expect(result.title).toBe(dto.title);
      expect(result.content).toBe(dto.content);
      expect(result.type).toBe(dto.type);
      expect(result.embedding).toEqual(mockEmbedding);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        `${dto.title}\n\n${dto.content}`
      );
      expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Knowledge));
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('Embedding service error')
      );

      const dto = {
        title: 'テストタイトル',
        content: 'テストコンテンツ',
        type: 'note' as KnowledgeType
      };

      await expect(service.createKnowledge(dto)).rejects.toThrow(
        'Embedding service error'
      );

      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockUnitOfWork.commit).not.toHaveBeenCalled();
    });
  });

  describe('updateKnowledge', () => {
    it('should update existing knowledge', async () => {
      const existingKnowledge = Knowledge.create({
        title: '既存タイトル',
        content: '既存コンテンツ',
        type: KnowledgeType.Note,
        embedding: new Array(1536).fill(0)
      });

      const newEmbedding = new Array(1536).fill(0.2);

      mockRepository.findById.mockResolvedValue(existingKnowledge);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(newEmbedding);
      mockRepository.save.mockResolvedValue(undefined);

      const updates = {
        title: '更新後タイトル',
        content: '更新後コンテンツ'
      };

      const result = await service.updateKnowledge(existingKnowledge.id, updates);

      expect(result).toBeDefined();
      expect(result.title).toBe(updates.title);
      expect(result.content).toBe(updates.content);
      expect(result.embedding).toEqual(newEmbedding);

      expect(mockRepository.findById).toHaveBeenCalledWith(existingKnowledge.id);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
    });

    it('should throw error if knowledge not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateKnowledge('non-existent-id', { title: 'New Title' })
      ).rejects.toThrow('Knowledge not found');

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('searchKnowledge', () => {
    it('should search knowledge by query', async () => {
      const mockKnowledge = [
        Knowledge.create({
          title: '結果1',
          content: 'コンテンツ1',
          type: KnowledgeType.Note,
          embedding: new Array(1536).fill(0)
        }),
        Knowledge.create({
          title: '結果2',
          content: 'コンテンツ2',
          type: KnowledgeType.Inspiration,
          embedding: new Array(1536).fill(0)
        })
      ];

      mockRepository.search.mockResolvedValue(mockKnowledge);

      const results = await service.searchKnowledge('検索クエリ', {
        type: KnowledgeType.Note,
        projectId: 'project-1',
        limit: 10
      });

      expect(results).toHaveLength(2);
      expect(mockRepository.search).toHaveBeenCalledWith('検索クエリ', {
        type: KnowledgeType.Note,
        projectId: 'project-1',
        limit: 10
      });
    });
  });

  describe('findSimilarKnowledge', () => {
    it('should find similar knowledge items', async () => {
      const targetKnowledge = Knowledge.create({
        title: 'ターゲット',
        content: 'ターゲットコンテンツ',
        type: KnowledgeType.Note,
        embedding: new Array(1536).fill(0.5)
      });

      const similarKnowledge = [
        Knowledge.create({
          title: '類似1',
          content: '類似コンテンツ1',
          type: KnowledgeType.Note,
          embedding: new Array(1536).fill(0.4)
        }),
        Knowledge.create({
          title: '類似2',
          content: '類似コンテンツ2',
          type: KnowledgeType.Note,
          embedding: new Array(1536).fill(0.3)
        })
      ];

      mockRepository.findById.mockResolvedValue(targetKnowledge);
      mockRepository.searchSimilar.mockResolvedValue(similarKnowledge);

      const results = await service.findSimilarKnowledge(targetKnowledge.id, {
        limit: 5,
        threshold: 0.8
      });

      expect(results).toHaveLength(2);
      expect(mockRepository.findById).toHaveBeenCalledWith(targetKnowledge.id);
      expect(mockRepository.searchSimilar).toHaveBeenCalledWith(
        targetKnowledge.embedding,
        { limit: 5, threshold: 0.8 }
      );
    });

    it('should throw error if target knowledge not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.findSimilarKnowledge('non-existent-id', { limit: 5 })
      ).rejects.toThrow('Knowledge not found');

      expect(mockRepository.searchSimilar).not.toHaveBeenCalled();
    });
  });

  describe('deleteKnowledge', () => {
    it('should delete knowledge', async () => {
      const knowledge = Knowledge.create({
        title: '削除対象',
        content: '削除対象コンテンツ',
        type: KnowledgeType.Note,
        embedding: new Array(1536).fill(0)
      });

      mockRepository.exists.mockResolvedValue(true);
      mockRepository.delete.mockResolvedValue(undefined);

      await service.deleteKnowledge(knowledge.id);

      expect(mockRepository.exists).toHaveBeenCalledWith(knowledge.id);
      expect(mockRepository.delete).toHaveBeenCalledWith(knowledge.id);
      expect(mockUnitOfWork.commit).toHaveBeenCalled();
    });

    it('should throw error if knowledge not found', async () => {
      mockRepository.exists.mockResolvedValue(false);

      await expect(
        service.deleteKnowledge('non-existent-id')
      ).rejects.toThrow('Knowledge not found');

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });
});