import { Edge } from 'reactflow';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  similarity?: number;
  embedding?: number[];
}

interface RelationEdge extends Edge {
  data?: {
    similarity: number;
    relationType: string;
  };
}

/**
 * コサイン類似度を計算
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * ベクトル類似度ベースの関連性計算
 */
export async function calculateVectorRelations(
  items: KnowledgeItem[],
  similarityThreshold = 0.5
): Promise<RelationEdge[]> {
  const edges: RelationEdge[] = [];

  // 埋め込みベクトルを取得
  const itemsWithEmbeddings = await getEmbeddings(items);

  // ペアワイズで類似度を計算
  for (let i = 0; i < itemsWithEmbeddings.length; i++) {
    for (let j = i + 1; j < itemsWithEmbeddings.length; j++) {
      const item1 = itemsWithEmbeddings[i];
      const item2 = itemsWithEmbeddings[j];

      if (!item1.embedding || !item2.embedding) continue;

      const similarity = cosineSimilarity(item1.embedding, item2.embedding);

      if (similarity >= similarityThreshold) {
        edges.push({
          id: `vector-${item1.id}-${item2.id}`,
          source: item1.id,
          target: item2.id,
          type: 'smoothstep',
          animated: similarity > 0.8,
          style: {
            stroke: `rgba(59, 130, 246, ${similarity})`,
            strokeWidth: 1 + similarity * 3,
          },
          data: {
            similarity,
            relationType: 'vector-similarity',
          },
        });
      }
    }
  }

  return edges;
}

/**
 * メタデータベースの関連性計算
 */
export function calculateMetadataRelations(items: KnowledgeItem[]): RelationEdge[] {
  const edges: RelationEdge[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const item1 = items[i];
      const item2 = items[j];
      const relations: Array<{ type: string; strength: number }> = [];

      // 同じプロジェクト
      if (item1.projectId && item1.projectId === item2.projectId) {
        relations.push({ type: 'same-project', strength: 0.6 });
      }

      // 同じソースURL
      if (item1.metadata?.url && item1.metadata.url === item2.metadata?.url) {
        relations.push({ type: 'same-source', strength: 0.8 });
      }

      // インスピレーション関係
      if (item1.metadata?.sourceId === item2.id || item2.metadata?.sourceId === item1.id) {
        relations.push({ type: 'inspiration', strength: 1.0 });
      }

      // タグの重複
      const tags1 = item1.metadata?.tags as string[] || [];
      const tags2 = item2.metadata?.tags as string[] || [];
      const commonTags = tags1.filter(tag => tags2.includes(tag));
      if (commonTags.length > 0) {
        const tagSimilarity = commonTags.length / Math.max(tags1.length, tags2.length);
        relations.push({ type: 'common-tags', strength: 0.4 + tagSimilarity * 0.4 });
      }

      // 時間的近接性
      const time1 = new Date(item1.createdAt).getTime();
      const time2 = new Date(item2.createdAt).getTime();
      const timeDiff = Math.abs(time1 - time2);
      const hourInMs = 60 * 60 * 1000;
      if (timeDiff < hourInMs) {
        relations.push({ type: 'temporal', strength: 0.5 * (1 - timeDiff / hourInMs) });
      }

      // 最も強い関係をエッジとして追加
      if (relations.length > 0) {
        const strongestRelation = relations.reduce((a, b) => a.strength > b.strength ? a : b);
        edges.push({
          id: `meta-${item1.id}-${item2.id}`,
          source: item1.id,
          target: item2.id,
          type: 'smoothstep',
          animated: strongestRelation.strength > 0.7,
          style: {
            stroke: getRelationColor(strongestRelation.type, strongestRelation.strength),
            strokeWidth: 1 + strongestRelation.strength * 2,
          },
          data: {
            similarity: strongestRelation.strength,
            relationType: strongestRelation.type,
          },
        });
      }
    }
  }

  return edges;
}

/**
 * ハイブリッド関連性計算（ベクトル + メタデータ）
 */
export async function calculateHybridRelations(
  items: KnowledgeItem[],
  vectorWeight = 0.7,
  metadataWeight = 0.3
): Promise<RelationEdge[]> {
  const vectorEdges = await calculateVectorRelations(items, 0.3);
  const metadataEdges = calculateMetadataRelations(items);

  // エッジをマージ
  const edgeMap = new Map<string, RelationEdge>();

  // ベクトルエッジを追加
  vectorEdges.forEach(edge => {
    const key = `${edge.source}-${edge.target}`;
    edgeMap.set(key, {
      ...edge,
      data: {
        ...edge.data,
        similarity: (edge.data?.similarity || 0) * vectorWeight,
      },
    });
  });

  // メタデータエッジを追加またはマージ
  metadataEdges.forEach(edge => {
    const key = `${edge.source}-${edge.target}`;
    const existing = edgeMap.get(key);

    if (existing) {
      // 既存のエッジとマージ
      const combinedSimilarity = (existing.data?.similarity || 0) + 
                                (edge.data?.similarity || 0) * metadataWeight;
      edgeMap.set(key, {
        ...existing,
        id: `hybrid-${edge.source}-${edge.target}`,
        data: {
          similarity: Math.min(combinedSimilarity, 1),
          relationType: 'hybrid',
        },
        style: {
          stroke: `rgba(139, 92, 246, ${Math.min(combinedSimilarity, 1)})`,
          strokeWidth: 1 + Math.min(combinedSimilarity, 1) * 3,
        },
        animated: combinedSimilarity > 0.7,
      });
    } else {
      // 新しいエッジとして追加
      edgeMap.set(key, {
        ...edge,
        data: {
          ...edge.data,
          similarity: (edge.data?.similarity || 0) * metadataWeight,
        },
      });
    }
  });

  return Array.from(edgeMap.values());
}

/**
 * 関係タイプに基づいた色を取得
 */
function getRelationColor(relationType: string, strength: number): string {
  const colors: Record<string, string> = {
    'same-project': '107, 114, 128', // gray
    'same-source': '251, 146, 60', // orange
    'inspiration': '168, 85, 247', // purple
    'common-tags': '34, 197, 94', // green
    'temporal': '59, 130, 246', // blue
    'vector-similarity': '59, 130, 246', // blue
    'hybrid': '139, 92, 246', // violet
  };

  const rgb = colors[relationType] || '107, 114, 128';
  return `rgba(${rgb}, ${strength})`;
}

/**
 * 埋め込みベクトルを取得（実際のAPIまたはローカルモデルを使用）
 */
async function getEmbeddings(items: KnowledgeItem[]): Promise<KnowledgeItem[]> {
  // ここでは仮の実装
  // 実際には LocalEmbeddingService を使用
  return items.map(item => ({
    ...item,
    embedding: item.embedding || generateMockEmbedding(item.content),
  }));
}

/**
 * モック埋め込みベクトルを生成（開発用）
 */
function generateMockEmbedding(text: string): number[] {
  const dim = 384; // 一般的な埋め込みの次元数
  const embedding = new Array(dim);
  
  // テキストベースのシード値
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = ((seed * 31) + text.charCodeAt(i)) % 1000000;
  }

  // 擬似ランダム値を生成
  for (let i = 0; i < dim; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    embedding[i] = (seed / 2147483648) * 2 - 1; // -1 to 1 の範囲
  }

  // 正規化
  const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
  return embedding.map(x => x / norm);
}

/**
 * クラスタリングによるグループ化
 */
export function clusterNodes(items: KnowledgeItem[], edges: RelationEdge[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const visited = new Set<string>();

  // 連結成分を見つける
  items.forEach(item => {
    if (!visited.has(item.id)) {
      const group: string[] = [];
      const queue = [item.id];
      visited.add(item.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        group.push(currentId);

        // 隣接ノードを探す
        edges.forEach(edge => {
          if (edge.data?.similarity && edge.data.similarity > 0.6) {
            let neighborId: string | null = null;
            if (edge.source === currentId && !visited.has(edge.target)) {
              neighborId = edge.target;
            } else if (edge.target === currentId && !visited.has(edge.source)) {
              neighborId = edge.source;
            }

            if (neighborId) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          }
        });
      }

      if (group.length > 1) {
        groups.set(`cluster-${groups.size}`, group);
      }
    }
  });

  return groups;
}