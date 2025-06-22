import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedKnowledgeNode from './graph/AnimatedKnowledgeNode';
import { 
  applyLayout, 
  LayoutType,
  ForceDirectedLayout,
  HierarchicalLayout,
  CircularLayout
} from '../utils/graphLayout';
import {
  calculateHybridRelations,
  clusterNodes,
} from '../utils/graphRelations';
import {
  filterNodesInViewport,
  throttleNodesByImportance,
  optimizeEdges,
  debounce,
  GraphPerformanceMonitor,
} from '../utils/graphPerformance';
import { KnowledgeItem } from '../../shared/types';

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

// シンプルなノード（パフォーマンスモード用）
const SimpleNode = ({ data }: { data: any }) => {
  const colors: Record<string, string> = {
    inspiration: '#8B5CF6',
    article: '#3B82F6',
    idea: '#10B981',
    url: '#F59E0B',
    image: '#EF4444',
    audio: '#EC4899',
    default: '#6B7280',
  };
  const color = colors[data.type] || colors.default;
  
  return (
    <div 
      className="w-3 h-3 rounded-full border-2 border-white shadow-md"
      style={{ backgroundColor: color }}
      title={data.label}
    />
  );
};

// ドットノード（極小表示用）
const DotNode = ({ data }: { data: any }) => {
  return <div className="w-2 h-2 bg-gray-400 rounded-full" title={data.label} />;
};

// クラスタノード
const ClusterNode = ({ data }: { data: any }) => {
  return (
    <div className="px-4 py-3 bg-gray-100 rounded-xl border-2 border-gray-300 shadow-lg">
      <div className="text-center">
        <div className="text-2xl mb-1">📁</div>
        <div className="text-sm font-medium">{data.label}</div>
        <div className="text-xs text-gray-500 mt-1">{data.memberCount}件</div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  knowledge: AnimatedKnowledgeNode,
  simple: SimpleNode,
  dot: DotNode,
  cluster: ClusterNode,
};

function KnowledgeGraphInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'project' | 'search'>('all');
  const [projectId] = useState('default-project'); // TODO: プロジェクト選択機能
  const [layoutType, setLayoutType] = useState<LayoutType>('force-directed');
  const [performanceMode, setPerformanceMode] = useState(false);
  const [showClusters, setShowClusters] = useState(false);
  const [realtimeUpdate, setRealtimeUpdate] = useState(false);
  
  const reactFlowInstance = useReactFlow();
  const performanceMonitor = useRef(new GraphPerformanceMonitor());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 初期データの読み込み
  useEffect(() => {
    loadKnowledgeGraph();
  }, [viewMode, projectId, layoutType]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // リアルタイム更新の設定
  useEffect(() => {
    if (realtimeUpdate) {
      updateIntervalRef.current = setInterval(() => {
        loadKnowledgeGraph();
      }, 5000); // 5秒ごとに更新
    } else {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    }
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [realtimeUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

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
          id: item.id as string,
          title: item.title as string,
          content: item.content as string,
          type: item.type as string,
          projectId: item.project_id as string | undefined,
          metadata: JSON.parse((item.metadata as string) || '{}'),
          createdAt: item.created_at as string,
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
    // ノードを作成
    let nodes: Node[] = items.map(item => ({
      id: item.id,
      type: performanceMode ? 'simple' : 'knowledge',
      position: { x: 0, y: 0 }, // 初期位置（後でレイアウトで更新）
      data: {
        label: item.title,
        type: item.type,
        content: item.content,
        metadata: item.metadata,
        similarity: item.similarity,
        connectionCount: 0,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    // エッジを計算（ハイブリッド方式）
    const edges = await calculateHybridRelations(items);
    
    // 接続数を計算
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (sourceNode) sourceNode.data.connectionCount++;
      if (targetNode) targetNode.data.connectionCount++;
    });

    // クラスタリング
    if (showClusters && nodes.length > 20) {
      const clusters = clusterNodes(items, edges);
      // TODO: クラスタノードの追加
    }

    // レイアウトを適用
    nodes = applyLayout(nodes, edges, layoutType, {
      iterations: 50,
      nodeRepulsion: 2000,
      edgeAttraction: 0.05,
    });

    // パフォーマンス最適化
    if (performanceMode && nodes.length > 100) {
      // 重要度でノードを間引く
      nodes = throttleNodesByImportance(nodes, edges, 100);
      // 表示ノードに関連するエッジのみを残す
      const visibleNodeIds = new Set(nodes.map(n => n.id));
      const optimizedEdges = optimizeEdges(edges, visibleNodeIds, 200);
      return { nodes, edges: optimizedEdges };
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
        id: item.id as string,
        title: item.title as string,
        content: item.content as string,
        type: item.type as string,
        projectId: item.project_id as string | undefined,
        metadata: item.metadata as Record<string, unknown> | undefined,
        createdAt: item.created_at as string,
        similarity: item.score as number | undefined,
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
    
    // 関連ノードをハイライト
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
    const connectedNodeIds = new Set(
      connectedEdges.flatMap(e => [e.source, e.target]).filter(id => id !== node.id)
    );
    
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        isHighlighted: connectedNodeIds.has(n.id),
        selected: n.id === node.id,
      },
    })));
  }, [edges, setNodes]);

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
            <div className="flex items-center gap-4">
              {/* レイアウト選択 */}
              <select
                value={layoutType}
                onChange={(e) => setLayoutType(e.target.value as LayoutType)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="force-directed">力学的レイアウト</option>
                <option value="hierarchical">階層レイアウト</option>
                <option value="circular">円形レイアウト</option>
              </select>
              
              {/* パフォーマンスモード */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={performanceMode}
                  onChange={(e) => setPerformanceMode(e.target.checked)}
                  className="rounded"
                />
                <span>高速モード</span>
              </label>
              
              {/* リアルタイム更新 */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={realtimeUpdate}
                  onChange={(e) => setRealtimeUpdate(e.target.checked)}
                  className="rounded"
                />
                <span>自動更新</span>
              </label>
              
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
              minZoom={0.1}
              maxZoom={2}
              fitViewOptions={{ padding: 0.2 }}
            >
              <Background variant="dots" />
              <Controls showInteractive={false} />
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

export function KnowledgeGraph() {
  return (
    <ReactFlowProvider>
      <div data-testid="knowledge-graph-page">
        <KnowledgeGraphInner />
      </div>
    </ReactFlowProvider>
  );
}