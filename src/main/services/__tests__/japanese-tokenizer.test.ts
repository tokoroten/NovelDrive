import {
  tokenize,
  getSearchTokens,
  extractKeywords,
  generateNgrams,
  calculateReadabilityScore,
  createDuckDBTokenizerFunction
} from '../japanese-tokenizer';

describe('JapaneseTokenizer', () => {
  describe('tokenize', () => {
    it('should tokenize Japanese text', () => {
      const text = '私は猫が好きです';
      const tokens = tokenize(text);

      expect(tokens).toBeDefined();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain('私');
      expect(tokens).toContain('猫');
      expect(tokens).toContain('好き');
    });

    it('should handle mixed Japanese and English text', () => {
      const text = '私はAIを学習しています';
      const tokens = tokenize(text);

      expect(tokens).toContain('私');
      expect(tokens).toContain('AI');
      expect(tokens).toContain('学習');
    });

    it('should handle empty text', () => {
      const tokens = tokenize('');

      expect(tokens).toBeDefined();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(0);
    });

    it('should handle punctuation', () => {
      const text = 'こんにちは、世界！';
      const tokens = tokenize(text);

      expect(tokens).toBeDefined();
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('getSearchTokens', () => {
    it('should generate search tokens with n-grams', () => {
      const text = '人工知能';
      const searchTokens = getSearchTokens(text);

      expect(searchTokens).toBeDefined();
      expect(Array.isArray(searchTokens)).toBe(true);
      expect(searchTokens.length).toBeGreaterThan(0);
      // Should include original tokens and n-grams
      expect(searchTokens).toContain('人工');
      expect(searchTokens).toContain('知能');
    });

    it('should remove duplicates', () => {
      const text = 'テストテスト';
      const searchTokens = getSearchTokens(text);

      const uniqueTokens = [...new Set(searchTokens)];
      expect(searchTokens.length).toBe(uniqueTokens.length);
    });

    it('should handle short text', () => {
      const text = 'AI';
      const searchTokens = getSearchTokens(text);

      expect(searchTokens).toBeDefined();
      expect(searchTokens.length).toBeGreaterThan(0);
    });
  });

  describe('extractKeywords', () => {
    it('should extract keywords from Japanese text', () => {
      const text = '人工知能は機械学習と深層学習を含む技術です。深層学習は特に重要です。';
      const keywords = extractKeywords(text, 5);

      expect(keywords).toBeDefined();
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBeLessThanOrEqual(5);
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords[0]).toHaveProperty('token');
      expect(keywords[0]).toHaveProperty('score');
      expect(keywords[0].score).toBeGreaterThan(0);
    });

    it('should rank keywords by frequency', () => {
      const text = 'テストテストテスト。別の単語。テスト。';
      const keywords = extractKeywords(text, 2);

      expect(keywords[0].token).toBe('テスト');
      expect(keywords[0].score).toBeGreaterThan(keywords[1].score);
    });

    it('should handle empty text', () => {
      const keywords = extractKeywords('', 5);

      expect(keywords).toBeDefined();
      expect(Array.isArray(keywords)).toBe(true);
      expect(keywords.length).toBe(0);
    });

    it('should respect topK parameter', () => {
      const text = '多くの異なる単語が含まれている長いテキストです。';
      const keywords = extractKeywords(text, 3);

      expect(keywords.length).toBeLessThanOrEqual(3);
    });
  });

  describe('generateNgrams', () => {
    it('should generate 2-grams', () => {
      const tokens = ['私', 'は', '猫', 'が', '好き'];
      const ngrams = generateNgrams(tokens, 2);

      expect(ngrams).toContain('私は');
      expect(ngrams).toContain('は猫');
      expect(ngrams).toContain('猫が');
      expect(ngrams).toContain('が好き');
      expect(ngrams.length).toBe(4);
    });

    it('should generate 3-grams', () => {
      const tokens = ['A', 'B', 'C', 'D'];
      const ngrams = generateNgrams(tokens, 3);

      expect(ngrams).toContain('ABC');
      expect(ngrams).toContain('BCD');
      expect(ngrams.length).toBe(2);
    });

    it('should handle n larger than token count', () => {
      const tokens = ['A', 'B'];
      const ngrams = generateNgrams(tokens, 3);

      expect(ngrams).toBeDefined();
      expect(ngrams.length).toBe(0);
    });

    it('should handle empty array', () => {
      const ngrams = generateNgrams([], 2);

      expect(ngrams).toBeDefined();
      expect(ngrams.length).toBe(0);
    });
  });

  describe('calculateReadabilityScore', () => {
    it('should calculate readability score', () => {
      const text = 'これは読みやすい文章です。短い文が続きます。理解しやすいです。';
      const score = calculateReadabilityScore(text);

      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should give higher scores to well-punctuated text', () => {
      const wellPunctuated = 'これは文章です。句読点があります。読みやすいです。';
      const poorlyPunctuated = 'これは文章です句読点がありません読みにくいです';

      const score1 = calculateReadabilityScore(wellPunctuated);
      const score2 = calculateReadabilityScore(poorlyPunctuated);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle empty text', () => {
      const score = calculateReadabilityScore('');

      expect(score).toBe(0);
    });

    it('should handle text with only punctuation', () => {
      const score = calculateReadabilityScore('。。。！！！');

      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
    });
  });

  describe('createDuckDBTokenizerFunction', () => {
    it('should create SQL statements', () => {
      const sql = createDuckDBTokenizerFunction();

      expect(sql).toBeDefined();
      expect(typeof sql).toBe('string');
      expect(sql).toContain('ALTER TABLE');
      expect(sql).toContain('search_tokens');
    });

    it('should include all necessary tables', () => {
      const sql = createDuckDBTokenizerFunction();

      expect(sql).toContain('knowledge');
      expect(sql).toContain('projects');
      expect(sql).toContain('characters');
      expect(sql).toContain('plots');
    });
  });
});