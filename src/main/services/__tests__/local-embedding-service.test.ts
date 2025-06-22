import { LocalEmbeddingService } from '../local-embedding-service';

describe('LocalEmbeddingService', () => {
  let service: LocalEmbeddingService;

  beforeEach(() => {
    service = LocalEmbeddingService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embeddings for text', async () => {
      const text = 'これはテストテキストです';
      const embedding = await service.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should generate different embeddings for different texts', async () => {
      const text1 = 'これは最初のテキストです';
      const text2 = '全く違う内容のテキスト';

      const embedding1 = await service.generateEmbedding(text1);
      const embedding2 = await service.generateEmbedding(text2);

      expect(embedding1).not.toEqual(embedding2);
    });

    it('should generate consistent embeddings for the same text', async () => {
      const text = '同じテキスト';

      const embedding1 = await service.generateEmbedding(text);
      const embedding2 = await service.generateEmbedding(text);

      expect(embedding1).toEqual(embedding2);
    });

    it('should handle empty text', async () => {
      const embedding = await service.generateEmbedding('');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should handle very long text', async () => {
      const longText = 'あ'.repeat(10000);
      const embedding = await service.generateEmbedding(longText);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['テキスト1', 'テキスト2', 'テキスト3'];
      const embeddings = await service.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(texts.length);
      embeddings.forEach(embedding => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty array', async () => {
      const embeddings = await service.generateEmbeddings([]);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity between embeddings', async () => {
      const text1 = '猫は可愛い動物です';
      const text2 = '犬も可愛い動物です';
      const text3 = 'プログラミングは楽しい';

      const embedding1 = await service.generateEmbedding(text1);
      const embedding2 = await service.generateEmbedding(text2);
      const embedding3 = await service.generateEmbedding(text3);

      const similarity12 = service.cosineSimilarity(embedding1, embedding2);
      const similarity13 = service.cosineSimilarity(embedding1, embedding3);

      expect(similarity12).toBeGreaterThan(0);
      expect(similarity13).toBeGreaterThan(0);
      expect(similarity12).toBeGreaterThan(similarity13); // 類似したテキストの方が高いスコア
    });

    it('should return 1 for identical embeddings', async () => {
      const text = 'テストテキスト';
      const embedding = await service.generateEmbedding(text);

      const similarity = service.cosineSimilarity(embedding, embedding);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle zero vectors', () => {
      const zeroVector = new Array(100).fill(0);
      const normalVector = new Array(100).fill(1);

      const similarity = service.cosineSimilarity(zeroVector, normalVector);

      expect(similarity).toBe(0);
    });
  });

  describe('findSimilar', () => {
    it('should find similar embeddings', async () => {
      const target = await service.generateEmbedding('猫についての文章');
      const embeddings = [
        await service.generateEmbedding('犬についての文章'),
        await service.generateEmbedding('猫の生態について'),
        await service.generateEmbedding('プログラミングの話'),
        await service.generateEmbedding('ネコ科の動物')
      ];

      const similar = service.findSimilar(target, embeddings, 2);

      expect(similar).toHaveLength(2);
      expect(similar[0].index).toBeDefined();
      expect(similar[0].score).toBeGreaterThan(similar[1].score);
    });

    it('should handle threshold parameter', async () => {
      const target = await service.generateEmbedding('特定のトピック');
      const embeddings = [
        await service.generateEmbedding('全く関係ない話題1'),
        await service.generateEmbedding('全く関係ない話題2'),
        await service.generateEmbedding('全く関係ない話題3')
      ];

      const similar = service.findSimilar(target, embeddings, 10, 0.9);

      expect(similar.length).toBeLessThanOrEqual(3);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from text', () => {
      const text = '人工知能は機械学習と深層学習を含む広い分野です。自然言語処理も重要な応用分野の一つです。';
      const keywords = service.extractKeywords(text, 5);

      expect(keywords).toBeDefined();
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeLessThanOrEqual(5);
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      const keywords = service.extractKeywords('', 5);

      expect(keywords).toBeDefined();
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBe(0);
    });

    it('should respect topK parameter', () => {
      const text = 'これは長いテキストで、多くの単語が含まれています。キーワード抽出のテストを行っています。';
      const keywords = service.extractKeywords(text, 3);

      expect(keywords.length).toBeLessThanOrEqual(3);
    });
  });
});