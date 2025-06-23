import { Node, Edge } from 'reactflow';
import { KnowledgeItem } from '../../shared/types';

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PerformanceOptions {
  maxVisibleNodes?: number;
  maxVisibleEdges?: number;
  enableClustering?: boolean;
  enableLOD?: boolean; // Level of Detail
  viewportPadding?: number;
}

/**
 * ビューポート内のノードのみをフィルタリング
 */
export function filterNodesInViewport(
  nodes: Node[],
  viewport: ViewportBounds,
  padding = 100
): Node[] {
  const minX = viewport.x - padding;
  const maxX = viewport.x + viewport.width + padding;
  const minY = viewport.y - padding;
  const maxY = viewport.y + viewport.height + padding;

  return nodes.filter(node => {
    const { x, y } = node.position;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });
}

/**
 * 重要度に基づいてノードを間引く
 */
export function throttleNodesByImportance(
  nodes: Node[],
  edges: Edge[],
  maxNodes: number
): Node[] {
  if (nodes.length <= maxNodes) return nodes;

  // ノードの重要度を計算（接続数ベース）
  const nodeImportance = new Map<string, number>();
  nodes.forEach(node => nodeImportance.set(node.id, 0));

  edges.forEach(edge => {
    nodeImportance.set(edge.source, (nodeImportance.get(edge.source) || 0) + 1);
    nodeImportance.set(edge.target, (nodeImportance.get(edge.target) || 0) + 1);
  });

  // 重要度でソート
  const sortedNodes = [...nodes].sort((a, b) => {
    const importanceA = nodeImportance.get(a.id) || 0;
    const importanceB = nodeImportance.get(b.id) || 0;
    return importanceB - importanceA;
  });

  return sortedNodes.slice(0, maxNodes);
}

/**
 * Level of Detail (LOD) システム
 * ズームレベルに応じてノードの詳細度を調整
 */
export function applyLOD(nodes: Node[], zoomLevel: number): Node[] {
  return nodes.map(node => {
    let nodeType = 'knowledge';
    
    if (zoomLevel < 0.3) {
      // 非常にズームアウトしている場合：シンプルなドット
      nodeType = 'dot';
    } else if (zoomLevel < 0.6) {
      // ズームアウトしている場合：簡略化されたノード
      nodeType = 'simple';
    }
    
    return {
      ...node,
      type: nodeType,
      data: {
        ...node.data,
        zoomLevel,
      },
    };
  });
}

/**
 * エッジのバッチ処理とフィルタリング
 */
export function optimizeEdges(
  edges: Edge[],
  visibleNodeIds: Set<string>,
  maxEdges: number
): Edge[] {
  // 表示されているノード間のエッジのみを残す
  const filteredEdges = edges.filter(edge => 
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  // エッジ数が多すぎる場合は重要度でフィルタリング
  if (filteredEdges.length > maxEdges) {
    return filteredEdges
      .sort((a, b) => {
        const weightA = a.data?.similarity || 0;
        const weightB = b.data?.similarity || 0;
        return weightB - weightA;
      })
      .slice(0, maxEdges);
  }

  return filteredEdges;
}

/**
 * ノードのクラスタリング
 * 密集したノードを1つのクラスタノードにまとめる
 */
export function clusterDenseNodes(
  nodes: Node[],
  edges: Edge[],
  clusterThreshold = 50
): { nodes: Node[]; edges: Edge[] } {
  const clusters = new Map<string, Node[]>();
  const processedNodes = new Set<string>();

  // 近接ノードをクラスタリング
  nodes.forEach(node => {
    if (processedNodes.has(node.id)) return;

    const cluster: Node[] = [node];
    processedNodes.add(node.id);

    // 近くのノードを探す
    nodes.forEach(otherNode => {
      if (processedNodes.has(otherNode.id)) return;

      const distance = Math.sqrt(
        Math.pow(node.position.x - otherNode.position.x, 2) +
        Math.pow(node.position.y - otherNode.position.y, 2)
      );

      if (distance < clusterThreshold) {
        cluster.push(otherNode);
        processedNodes.add(otherNode.id);
      }
    });

    if (cluster.length > 3) {
      const clusterId = `cluster-${clusters.size}`;
      clusters.set(clusterId, cluster);
    }
  });

  // クラスタノードを作成
  const clusterNodes: Node[] = [];
  const nodeToCluster = new Map<string, string>();

  clusters.forEach((clusterMembers, clusterId) => {
    const centerX = clusterMembers.reduce((sum, n) => sum + n.position.x, 0) / clusterMembers.length;
    const centerY = clusterMembers.reduce((sum, n) => sum + n.position.y, 0) / clusterMembers.length;

    clusterNodes.push({
      id: clusterId,
      type: 'cluster',
      position: { x: centerX, y: centerY },
      data: {
        label: `クラスタ (${clusterMembers.length}件)`,
        memberCount: clusterMembers.length,
        members: clusterMembers.map(n => n.id),
      },
    });

    clusterMembers.forEach(member => {
      nodeToCluster.set(member.id, clusterId);
    });
  });

  // クラスタ化されていないノードを追加
  const finalNodes = [
    ...clusterNodes,
    ...nodes.filter(n => !nodeToCluster.has(n.id)),
  ];

  // エッジを更新
  const finalEdges = edges.map(edge => {
    const sourceCluster = nodeToCluster.get(edge.source);
    const targetCluster = nodeToCluster.get(edge.target);

    return {
      ...edge,
      source: sourceCluster || edge.source,
      target: targetCluster || edge.target,
    };
  });

  // 重複エッジを削除
  const uniqueEdges = Array.from(
    new Map(finalEdges.map(e => [`${e.source}-${e.target}`, e])).values()
  );

  return { nodes: finalNodes, edges: uniqueEdges };
}

/**
 * Web Worker を使用した非同期レイアウト計算
 */
export class AsyncLayoutCalculator {
  private worker: Worker | null = null;

  constructor() {
    // Web Worker の初期化（実装は別途必要）
    if (typeof Worker !== 'undefined') {
      // this.worker = new Worker('/workers/layoutWorker.js');
    }
  }

  async calculateLayout(
    nodes: Node[],
    edges: Edge[],
    layoutType: string
  ): Promise<Node[]> {
    if (!this.worker) {
      // フォールバック：メインスレッドで計算
      return nodes;
    }

    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'));
        return;
      }

      this.worker.onmessage = (e) => {
        if (e.data.type === 'layout-complete') {
          resolve(e.data.nodes);
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message));
        }
      };

      this.worker.postMessage({
        type: 'calculate-layout',
        nodes,
        edges,
        layoutType,
      });
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

/**
 * グラフのパフォーマンス統計
 */
export class GraphPerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 0;

  updateFPS() {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    return this.fps;
  }

  getStats() {
    return {
      fps: this.fps,
      memory: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : 0,
    };
  }
}

/**
 * デバウンスされた更新
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * スロットルされた更新
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}