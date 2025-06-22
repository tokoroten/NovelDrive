import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeTypes,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  similarity?: number;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

// カスタムノードコンポーネント
interface KnowledgeNodeData {
  label: string;
  type: string;
  content: string;
  selected?: boolean;
}

const KnowledgeNode = ({ data }: { data: KnowledgeNodeData }) => {
  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      inspiration: '#8B5CF6', // 紫
      article: '#3B82F6', // 青
      idea: '#10B981', // 緑
      url: '#F59E0B', // 黄
      image: '#EF4444', // 赤
      audio: '#EC4899', // ピンク
      default: '#6B7280', // グレー
    };
    return colors[type] || colors.default;
  };

  const nodeColor = getNodeColor(data.type);

  return (
    <div
      className="px-4 py-3 shadow-lg rounded-lg border-2 bg-white transition-all hover:shadow-xl"
      style={{ borderColor: nodeColor }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: nodeColor }} />
        <span className="text-xs text-gray-500">{data.type}</span>
      </div>
      <div className="font-medium text-sm text-gray-800 max-w-[200px]">{data.label}</div>
      {data.similarity && (
        <div className="text-xs text-gray-500 mt-1">
          類似度: {Math.round(data.similarity * 100)}%
        </div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  knowledge: KnowledgeNode,
};

export function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'project' | 'search'>('all');
  const [projectId] = useState('default-project'); // TODO: プロジェクト選択機能

  // 初期データの読み込み
  useEffect(() => {
    loadKnowledgeGraph();
  }, [viewMode, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadKnowledgeGraph = async () => {
    setIsLoading(true);
    try {
      let knowledgeItems: KnowledgeItem[] = [];

      if (viewMode === 'all' || viewMode === 'project') {
        // データベースから知識を取得
        const sql =
          viewMode === 'project'
            ? 'SELECT * FROM knowledge WHERE project_id = ? ORDER BY created_at DESC LIMIT 100'
            : 'SELECT * FROM knowledge ORDER BY created_at DESC LIMIT 100';
        const params = viewMode === 'project' ? [projectId] : [];

        const result = await window.electronAPI.database.query(sql, params);
        knowledgeItems = result.map((item: Record<string, unknown>) => ({
          ...item,
          metadata: JSON.parse(item.metadata || '{}'),
          createdAt: item.created_at,
        }));
      }

      // グラフデータを構築
      const graphData = await buildGraphData(knowledgeItems);
      setNodes(graphData.nodes);
      setEdges(graphData.edges);
    } catch (error) {
      console.error('Failed to load knowledge graph:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildGraphData = async (items: KnowledgeItem[]): Promise<GraphData> => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodePositions = new Map<string, { x: number; y: number }>();

    // 円形レイアウトでノードを配置
    const centerX = 400;
    const centerY = 300;
    const radius = 250;

    items.forEach((item, index) => {
      const angle = (index / items.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      nodePositions.set(item.id, { x, y });

      nodes.push({
        id: item.id,
        type: 'knowledge',
        position: { x, y },
        data: {
          label: item.title,
          type: item.type,
          content: item.content,
          metadata: item.metadata,
          similarity: item.similarity,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });
    });

    // 関連性に基づいてエッジを生成
    if (items.length > 1 && items.length < 50) {
      // アイテム数が適度な場合のみ関連性を計算
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const item1 = items[i];
          const item2 = items[j];

          // メタデータやタイプに基づく関連性チェック
          let isRelated = false;
          let relationStrength = 0.5;

          // 同じプロジェクトのアイテム
          if (item1.projectId && item1.projectId === item2.projectId) {
            isRelated = true;
            relationStrength = 0.7;
          }

          // 同じソースURL
          if (item1.metadata?.url && item1.metadata.url === item2.metadata?.url) {
            isRelated = true;
            relationStrength = 0.9;
          }

          // インスピレーションとその元
          if (item1.metadata?.sourceId === item2.id || item2.metadata?.sourceId === item1.id) {
            isRelated = true;
            relationStrength = 1.0;
          }

          if (isRelated) {
            edges.push({
              id: `${item1.id}-${item2.id}`,
              source: item1.id,
              target: item2.id,
              animated: relationStrength > 0.7,
              style: {
                stroke: `rgba(107, 114, 128, ${relationStrength})`,
                strokeWidth: relationStrength * 3,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#6B7280',
              },
            });
          }
        }
      }
    }

    return { nodes, edges };
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      loadKnowledgeGraph();
      return;
    }

    setIsLoading(true);
    try {
      // セレンディピティ検索を実行
      const results = await window.electronAPI.search.serendipity(searchQuery, {
        limit: 30,
        projectId: viewMode === 'project' ? projectId : undefined,
        serendipityLevel: 0.3,
      });

      // 検索結果からグラフを構築
      const knowledgeItems: KnowledgeItem[] = results.map((item: Record<string, unknown>) => ({
        ...item,
        similarity: item.score,
      }));

      const graphData = await buildGraphData(knowledgeItems);
      setNodes(graphData.nodes);
      setEdges(graphData.edges);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  // 選択されたノードの詳細を表示
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    const node = nodes.find((n) => n.id === selectedNode);
    return node?.data;
  }, [selectedNode, nodes]);

  return (
    <div className="flex h-full gap-4">
      {/* メインビュー */}
      <div className="flex-1 bg-white rounded-lg shadow-md">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">知識グラフ</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                すべて
              </button>
              <button
                onClick={() => setViewMode('project')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'project'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                プロジェクト
              </button>
              <button
                onClick={() => setViewMode('search')}
                className={`px-3 py-1 rounded text-sm ${
                  viewMode === 'search'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                検索
              </button>
            </div>
          </div>

          {viewMode === 'search' && (
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="知識を検索..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
              >
                検索
              </button>
            </form>
          )}
        </div>

        <div className="h-[calc(100%-120px)] relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">読み込み中...</div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const colors: Record<string, string> = {
                    inspiration: '#8B5CF6',
                    article: '#3B82F6',
                    idea: '#10B981',
                    url: '#F59E0B',
                    image: '#EF4444',
                    audio: '#EC4899',
                  };
                  return colors[node.data?.type] || '#6B7280';
                }}
                style={{
                  backgroundColor: '#f3f4f6',
                }}
              />
            </ReactFlow>
          )}
        </div>
      </div>

      {/* サイドパネル：ノード詳細 */}
      {selectedNodeData && (
        <div className="w-96 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">{selectedNodeData.label}</h3>

          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-600">タイプ</span>
              <p className="text-gray-800">{selectedNodeData.type}</p>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-600">内容</span>
              <p className="text-gray-800 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {selectedNodeData.content}
              </p>
            </div>

            {selectedNodeData.similarity !== undefined && (
              <div>
                <span className="text-sm font-medium text-gray-600">関連度スコア</span>
                <p className="text-gray-800">{Math.round(selectedNodeData.similarity * 100)}%</p>
              </div>
            )}

            {selectedNodeData.metadata && Object.keys(selectedNodeData.metadata).length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600">メタデータ</span>
                <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(selectedNodeData.metadata, null, 2)}
                </pre>
              </div>
            )}

            <button
              onClick={() => setSelectedNode(null)}
              className="w-full py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
