/**
 * 知識グラフサービス
 */

import * as duckdb from 'duckdb';

export interface KnowledgeNode {
  id: string;
  title: string;
  type: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  weight: number;
  type: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export class KnowledgeGraphService {
  constructor(private conn: duckdb.Connection) {}

  /**
   * 知識グラフを取得
   */
  async getKnowledgeGraph(projectId?: string): Promise<KnowledgeGraph> {
    const nodes = await this.getNodes(projectId);
    const edges = await this.getEdges(nodes.map(n => n.id));
    
    return { nodes, edges };
  }

  /**
   * 関連する知識を取得
   */
  async getRelatedKnowledge(knowledgeId: string, depth: number = 2): Promise<KnowledgeGraph> {
    const visited = new Set<string>();
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    
    await this.traverseGraph(knowledgeId, depth, visited, nodes, edges);
    
    return { nodes, edges };
  }

  private async getNodes(projectId?: string): Promise<KnowledgeNode[]> {
    let sql = 'SELECT id, title, type, project_id, metadata FROM knowledge';
    const params: any[] = [];
    
    if (projectId) {
      sql += ' WHERE project_id = ?';
      params.push(projectId);
    }
    
    return new Promise((resolve, reject) => {
      this.conn.all(sql, params, (err, rows: any[]) => {
        if (err) reject(err);
        else {
          const nodes = (rows || []).map(row => ({
            id: row.id,
            title: row.title,
            type: row.type,
            projectId: row.project_id,
            metadata: JSON.parse(row.metadata || '{}')
          }));
          resolve(nodes);
        }
      });
    });
  }

  private async getEdges(nodeIds: string[]): Promise<KnowledgeEdge[]> {
    if (nodeIds.length === 0) return [];
    
    // 埋め込みベクトルの類似度に基づいてエッジを生成
    const edges: KnowledgeEdge[] = [];
    
    // TODO: 実際のベクトル類似度計算を実装
    // 現在は仮のエッジを生成
    for (let i = 0; i < Math.min(nodeIds.length, 10); i++) {
      for (let j = i + 1; j < Math.min(nodeIds.length, 10); j++) {
        if (Math.random() > 0.7) {
          edges.push({
            source: nodeIds[i],
            target: nodeIds[j],
            weight: Math.random(),
            type: 'similarity'
          });
        }
      }
    }
    
    return edges;
  }

  private async traverseGraph(
    nodeId: string,
    depth: number,
    visited: Set<string>,
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[]
  ): Promise<void> {
    if (depth <= 0 || visited.has(nodeId)) return;
    
    visited.add(nodeId);
    
    // ノードを取得
    const node = await this.getNodeById(nodeId);
    if (node) {
      nodes.push(node);
      
      // 関連ノードを取得
      const relatedNodes = await this.findRelatedNodes(nodeId);
      
      for (const related of relatedNodes) {
        edges.push({
          source: nodeId,
          target: related.id,
          weight: related.similarity,
          type: 'similarity'
        });
        
        await this.traverseGraph(related.id, depth - 1, visited, nodes, edges);
      }
    }
  }

  private async getNodeById(id: string): Promise<KnowledgeNode | null> {
    return new Promise((resolve, reject) => {
      this.conn.all(
        'SELECT id, title, type, project_id, metadata FROM knowledge WHERE id = ?',
        [id],
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            const row = rows?.[0];
            if (!row) resolve(null);
            else {
              resolve({
                id: row.id,
                title: row.title,
                type: row.type,
                projectId: row.project_id,
                metadata: JSON.parse(row.metadata || '{}')
              });
            }
          }
        }
      );
    });
  }

  private async findRelatedNodes(nodeId: string, limit: number = 5): Promise<Array<{ id: string; similarity: number }>> {
    // TODO: 実際のベクトル類似度検索を実装
    // 現在は仮の関連ノードを返す
    return new Promise((resolve) => {
      resolve([]);
    });
  }
}