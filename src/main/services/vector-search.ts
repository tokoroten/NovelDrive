import { generateEmbedding } from './openai-service';

/**
 * コサイン類似度を計算
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * ベクトルをランダムに回転させる（セレンディピティ用）
 */
export function rotateVector(vector: number[], angle: number): number[] {
  // 高次元空間でのランダム回転を簡略化
  // 実際にはより洗練された方法を使うべきだが、ここでは簡易実装
  const rotated = [...vector];
  const dimensions = vector.length;

  // ランダムに選んだ次元ペアで回転
  for (let i = 0; i < 10; i++) {
    const dim1 = Math.floor(Math.random() * dimensions);
    const dim2 = Math.floor(Math.random() * dimensions);

    if (dim1 !== dim2) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const temp1 = rotated[dim1] * cos - rotated[dim2] * sin;
      const temp2 = rotated[dim1] * sin + rotated[dim2] * cos;

      rotated[dim1] = temp1;
      rotated[dim2] = temp2;
    }
  }

  return rotated;
}

/**
 * ノイズを追加する（セレンディピティ用）
 */
export function addNoise(vector: number[], noiseLevel: number): number[] {
  return vector.map((v) => {
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    return v + noise;
  });
}

/**
 * セレンディピティ検索用のベクトル変換
 */
export function applySerendipity(
  vector: number[],
  options: {
    rotationAngle?: number;
    noiseLevel?: number;
    dimensionalShift?: boolean;
  } = {}
): number[] {
  let result = [...vector];

  // 回転
  if (options.rotationAngle) {
    result = rotateVector(result, options.rotationAngle);
  }

  // ノイズ追加
  if (options.noiseLevel) {
    result = addNoise(result, options.noiseLevel);
  }

  // 次元シフト（一部の次元を強調/抑制）
  if (options.dimensionalShift) {
    result = result.map((v, i) => {
      const shift = Math.sin(i * 0.1) * 0.5 + 1;
      return v * shift;
    });
  }

  // 正規化
  const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    result = result.map((v) => v / norm);
  }

  return result;
}

/**
 * 複数のベクトルの重心を計算
 */
export function calculateCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) {
    throw new Error('Cannot calculate centroid of empty vector array');
  }

  const dimensions = vectors[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < dimensions; i++) {
      centroid[i] += vector[i];
    }
  }

  return centroid.map((v) => v / vectors.length);
}

/**
 * ナレッジ間の意味的距離を計算
 */
export async function calculateSemanticDistance(text1: string, text2: string): Promise<number> {
  const [embedding1, embedding2] = await Promise.all([
    generateEmbedding(text1),
    generateEmbedding(text2),
  ]);

  if (!embedding1 || !embedding2) {
    throw new Error('Failed to generate embeddings');
  }

  const similarity = cosineSimilarity(embedding1, embedding2);
  return 1 - similarity; // 距離に変換
}

/**
 * テキストのベクトル埋め込みを生成し、セレンディピティを適用
 */
export async function generateSerendipitousEmbedding(
  text: string,
  serendipityLevel: number = 0.3
): Promise<number[] | null> {
  const baseEmbedding = await generateEmbedding(text);

  if (!baseEmbedding) {
    return null;
  }

  // セレンディピティレベルに応じて変換を適用
  return applySerendipity(baseEmbedding, {
    rotationAngle: (serendipityLevel * Math.PI) / 4,
    noiseLevel: serendipityLevel * 0.1,
    dimensionalShift: serendipityLevel > 0.5,
  });
}

/**
 * ベクトル検索の結果をリランキング
 */
export function rerankResults<T extends { embedding?: number[] | string }>(
  results: T[],
  queryEmbedding: number[],
  options: {
    diversityWeight?: number;
    temporalDecay?: boolean;
    createdAt?: (item: T) => Date;
  } = {}
): Array<T & { score: number }> {
  const { diversityWeight = 0.2, temporalDecay = false, createdAt } = options;

  // 基本スコアを計算
  const scoredResults = results.map((item) => {
    let embedding: number[] | null = null;

    if (typeof item.embedding === 'string') {
      try {
        embedding = JSON.parse(item.embedding);
      } catch {
        embedding = null;
      }
    } else if (Array.isArray(item.embedding)) {
      embedding = item.embedding;
    }

    const similarity = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
    let score = similarity;

    // 時間減衰を適用
    if (temporalDecay && createdAt) {
      const age = Date.now() - createdAt(item).getTime();
      const daysSinceCreation = age / (1000 * 60 * 60 * 24);
      const decayFactor = Math.exp(-daysSinceCreation / 30); // 30日で約37%に減衰
      score *= decayFactor;
    }

    return { ...item, score };
  });

  // 多様性を考慮したリランキング
  if (diversityWeight > 0 && scoredResults.length > 1) {
    const reranked: typeof scoredResults = [];
    const remaining = [...scoredResults];

    // 最高スコアのアイテムを選択
    remaining.sort((a, b) => b.score - a.score);
    reranked.push(remaining.shift()!);

    // 残りのアイテムを多様性を考慮して選択
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        let adjustedScore = item.score;

        // 既に選択されたアイテムとの類似度をペナルティとして適用
        for (const selected of reranked) {
          if (item.embedding && selected.embedding) {
            const itemEmb =
              typeof item.embedding === 'string' ? JSON.parse(item.embedding) : item.embedding;
            const selectedEmb =
              typeof selected.embedding === 'string'
                ? JSON.parse(selected.embedding)
                : selected.embedding;

            const similarity = cosineSimilarity(itemEmb, selectedEmb);
            adjustedScore -= similarity * diversityWeight;
          }
        }

        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestIdx = i;
        }
      }

      reranked.push(remaining.splice(bestIdx, 1)[0]);
    }

    return reranked;
  }

  return scoredResults.sort((a, b) => b.score - a.score);
}
