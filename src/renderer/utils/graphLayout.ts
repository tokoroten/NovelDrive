import { Node, Edge } from 'reactflow';

interface Vector2D {
  x: number;
  y: number;
}

interface ForceDirectedOptions {
  iterations?: number;
  nodeRepulsion?: number;
  edgeAttraction?: number;
  centerForce?: number;
  damping?: number;
  minDistance?: number;
  maxDistance?: number;
}

/**
 * Force-directed layoutアルゴリズムの実装
 * ノード間の引力・斥力を計算して自然な配置を実現
 */
export class ForceDirectedLayout {
  private nodes: Map<string, Vector2D>;
  private velocities: Map<string, Vector2D>;
  private edges: Edge[];
  private options: Required<ForceDirectedOptions>;

  constructor(nodes: Node[], edges: Edge[], options: ForceDirectedOptions = {}) {
    this.nodes = new Map(nodes.map(n => [n.id, { x: n.position.x, y: n.position.y }]));
    this.velocities = new Map(nodes.map(n => [n.id, { x: 0, y: 0 }]));
    this.edges = edges;
    this.options = {
      iterations: options.iterations ?? 100,
      nodeRepulsion: options.nodeRepulsion ?? 1000,
      edgeAttraction: options.edgeAttraction ?? 0.1,
      centerForce: options.centerForce ?? 0.01,
      damping: options.damping ?? 0.8,
      minDistance: options.minDistance ?? 50,
      maxDistance: options.maxDistance ?? 500,
    };
  }

  /**
   * レイアウトを計算
   */
  compute(): Map<string, Vector2D> {
    for (let i = 0; i < this.options.iterations; i++) {
      this.applyForces();
      this.updatePositions();
    }
    return this.nodes;
  }

  private applyForces() {
    const forces = new Map<string, Vector2D>();
    const nodeIds = Array.from(this.nodes.keys());

    // 初期化
    nodeIds.forEach(id => forces.set(id, { x: 0, y: 0 }));

    // ノード間の斥力
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const id1 = nodeIds[i];
        const id2 = nodeIds[j];
        const pos1 = this.nodes.get(id1)!;
        const pos2 = this.nodes.get(id2)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), this.options.minDistance);

        if (distance < this.options.maxDistance) {
          const force = this.options.nodeRepulsion / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          const f1 = forces.get(id1)!;
          const f2 = forces.get(id2)!;
          f1.x -= fx;
          f1.y -= fy;
          f2.x += fx;
          f2.y += fy;
        }
      }
    }

    // エッジによる引力
    this.edges.forEach(edge => {
      const pos1 = this.nodes.get(edge.source);
      const pos2 = this.nodes.get(edge.target);
      if (!pos1 || !pos2) return;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), this.options.minDistance);

      const force = distance * this.options.edgeAttraction;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      const f1 = forces.get(edge.source)!;
      const f2 = forces.get(edge.target)!;
      f1.x += fx;
      f1.y += fy;
      f2.x -= fx;
      f2.y -= fy;
    });

    // 中心への引力
    const centerX = 400;
    const centerY = 300;
    nodeIds.forEach(id => {
      const pos = this.nodes.get(id)!;
      const force = forces.get(id)!;
      force.x += (centerX - pos.x) * this.options.centerForce;
      force.y += (centerY - pos.y) * this.options.centerForce;
    });

    // 速度を更新
    nodeIds.forEach(id => {
      const velocity = this.velocities.get(id)!;
      const force = forces.get(id)!;
      velocity.x = (velocity.x + force.x) * this.options.damping;
      velocity.y = (velocity.y + force.y) * this.options.damping;
    });
  }

  private updatePositions() {
    this.nodes.forEach((pos, id) => {
      const velocity = this.velocities.get(id)!;
      pos.x += velocity.x;
      pos.y += velocity.y;
    });
  }
}

/**
 * 階層的レイアウトアルゴリズム
 * ノードを階層構造で配置
 */
export class HierarchicalLayout {
  private nodes: Node[];
  private edges: Edge[];
  private levels: Map<string, number>;

  constructor(nodes: Node[], edges: Edge[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.levels = new Map();
  }

  compute(): Map<string, Vector2D> {
    this.calculateLevels();
    return this.positionNodes();
  }

  private calculateLevels() {
    // 入次数を計算
    const inDegree = new Map<string, number>();
    this.nodes.forEach(node => inDegree.set(node.id, 0));
    this.edges.forEach(edge => {
      const current = inDegree.get(edge.target) || 0;
      inDegree.set(edge.target, current + 1);
    });

    // レベル0のノード（ルートノード）を見つける
    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
        this.levels.set(nodeId, 0);
      }
    });

    // BFSでレベルを割り当て
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLevel = this.levels.get(nodeId)!;

      this.edges.forEach(edge => {
        if (edge.source === nodeId && !this.levels.has(edge.target)) {
          this.levels.set(edge.target, currentLevel + 1);
          queue.push(edge.target);
        }
      });
    }

    // 未割り当てのノードにデフォルトレベルを設定
    this.nodes.forEach(node => {
      if (!this.levels.has(node.id)) {
        this.levels.set(node.id, 0);
      }
    });
  }

  private positionNodes(): Map<string, Vector2D> {
    const positions = new Map<string, Vector2D>();
    const levelNodes = new Map<number, string[]>();

    // レベルごとにノードをグループ化
    this.levels.forEach((level, nodeId) => {
      if (!levelNodes.has(level)) {
        levelNodes.set(level, []);
      }
      levelNodes.get(level)!.push(nodeId);
    });

    // 各レベルのノードを配置
    const levelSpacing = 150;
    const nodeSpacing = 100;
    const centerX = 400;
    const startY = 100;

    levelNodes.forEach((nodeIds, level) => {
      const y = startY + level * levelSpacing;
      const totalWidth = (nodeIds.length - 1) * nodeSpacing;
      const startX = centerX - totalWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        positions.set(nodeId, {
          x: startX + index * nodeSpacing,
          y: y,
        });
      });
    });

    return positions;
  }
}

/**
 * 円形レイアウト（改善版）
 * グループやクラスタを考慮した円形配置
 */
export class CircularLayout {
  private nodes: Node[];
  private groups: Map<string, string[]>;

  constructor(nodes: Node[], groups?: Map<string, string[]>) {
    this.nodes = nodes;
    this.groups = groups || new Map();
  }

  compute(centerX = 400, centerY = 300, radius = 250): Map<string, Vector2D> {
    const positions = new Map<string, Vector2D>();
    
    if (this.groups.size > 0) {
      // グループごとに配置
      const groupAngles = new Map<string, number>();
      const angleStep = (2 * Math.PI) / this.groups.size;
      let groupIndex = 0;

      this.groups.forEach((nodeIds, groupId) => {
        const groupAngle = groupIndex * angleStep;
        groupAngles.set(groupId, groupAngle);

        // グループ内のノードを小さな円に配置
        const groupRadius = radius * 0.3;
        const groupCenterX = centerX + radius * Math.cos(groupAngle);
        const groupCenterY = centerY + radius * Math.sin(groupAngle);

        nodeIds.forEach((nodeId, index) => {
          const nodeAngle = (index / nodeIds.length) * 2 * Math.PI;
          positions.set(nodeId, {
            x: groupCenterX + groupRadius * Math.cos(nodeAngle),
            y: groupCenterY + groupRadius * Math.sin(nodeAngle),
          });
        });

        groupIndex++;
      });

      // グループに属さないノードを中心に配置
      this.nodes.forEach(node => {
        if (!positions.has(node.id)) {
          const angle = Math.random() * 2 * Math.PI;
          const r = Math.random() * radius * 0.2;
          positions.set(node.id, {
            x: centerX + r * Math.cos(angle),
            y: centerY + r * Math.sin(angle),
          });
        }
      });
    } else {
      // 通常の円形配置
      this.nodes.forEach((node, index) => {
        const angle = (index / this.nodes.length) * 2 * Math.PI;
        positions.set(node.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });
    }

    return positions;
  }
}

/**
 * レイアウトアルゴリズムの種類
 */
export type LayoutType = 'force-directed' | 'hierarchical' | 'circular';

/**
 * レイアウトを適用
 */
export function applyLayout(
  nodes: Node[],
  edges: Edge[],
  layoutType: LayoutType,
  options?: any
): Node[] {
  let positions: Map<string, Vector2D>;

  switch (layoutType) {
    case 'force-directed':
      const fdLayout = new ForceDirectedLayout(nodes, edges, options);
      positions = fdLayout.compute();
      break;
    case 'hierarchical':
      const hLayout = new HierarchicalLayout(nodes, edges);
      positions = hLayout.compute();
      break;
    case 'circular':
      const cLayout = new CircularLayout(nodes, options?.groups);
      positions = cLayout.compute(options?.centerX, options?.centerY, options?.radius);
      break;
    default:
      return nodes;
  }

  // ノードの位置を更新
  return nodes.map(node => ({
    ...node,
    position: positions.get(node.id) || node.position,
  }));
}