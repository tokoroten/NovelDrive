/**
 * キャラクター関係図（リファクタリング版）
 */

import React, { useCallback } from 'react';
import ReactFlow, {
  Node,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  ReactFlowProvider,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AnimatePresence } from 'framer-motion';
import { useCharacterRelationship } from './hooks/useCharacterRelationship';
import { CharacterNode } from './CharacterNode';
import { GroupNode } from './GroupNode';
import { GraphControls } from './GraphControls';
import { CharacterDetailPanel } from './CharacterDetailPanel';
import { StatisticsPanel } from './StatisticsPanel';
import { AddRelationshipDialog } from './AddRelationshipDialog';

const nodeTypes: NodeTypes = {
  character: CharacterNode,
  group: GroupNode,
};

function CharacterRelationshipDiagramInner() {
  const {
    characters,
    relationships,
    projects,
    selectedProjectId,
    selectedCharacter,
    layoutType,
    filterType,
    isLoading,
    showAddRelationshipDialog,
    newRelationship,
    statistics,
    setSelectedProjectId,
    setSelectedCharacter,
    setLayoutType,
    setFilterType,
    setShowAddRelationshipDialog,
    setNewRelationship,
    handleAddRelationship,
    buildGraph,
  } = useCharacterRelationship();

  // ReactFlowの状態管理
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // グラフを再構築
  React.useEffect(() => {
    const { nodes, edges } = buildGraph(characters, relationships);
    setNodes(nodes);
    setEdges(edges);
  }, [characters, relationships, buildGraph, setNodes, setEdges]);

  // ノードクリック時の処理
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedCharacter(node.data.character);
    
    // ノードの選択状態を更新
    setNodes(nds => nds.map(n => ({
      ...n,
      data: {
        ...n.data,
        selected: n.id === node.id,
      },
    })));

    // 関連するエッジをハイライト
    setEdges(eds => eds.map(e => ({
      ...e,
      animated: e.source === node.id || e.target === node.id,
      style: {
        ...e.style,
        opacity: (e.source === node.id || e.target === node.id) ? 1 : 0.3,
      },
    })));
  }, [setNodes, setEdges, setSelectedCharacter]);

  // フィルター変更時の処理
  const handleFilterChange = (filter: string) => {
    setFilterType(filter);
  };

  return (
    <div className="flex h-full gap-4">
      {/* メインビュー */}
      <div className="flex-1 bg-white rounded-lg shadow-md">
        <GraphControls
          projects={projects}
          selectedProjectId={selectedProjectId}
          layoutType={layoutType}
          filterType={filterType}
          charactersCount={characters.length}
          onProjectChange={setSelectedProjectId}
          onLayoutChange={setLayoutType}
          onFilterChange={handleFilterChange}
          onAddRelationship={() => setShowAddRelationshipDialog(true)}
        />

        <div className="h-[calc(100%-80px)] relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">読み込み中...</div>
            </div>
          ) : characters.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">👥</div>
                <div>キャラクターが登録されていません</div>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={1.5}
            >
              <Background variant={"dots" as any} />
              <Controls />
              <MiniMap
                nodeColor={(node) => node.data?.backgroundColor || '#ffffff'}
                style={{ backgroundColor: '#f3f4f6' }}
              />
              
              {/* 統計パネル */}
              <Panel position="bottom-left" className="bg-white p-3 rounded-lg shadow-md text-xs">
                <div className="font-semibold mb-2">統計情報</div>
                <div className="space-y-1">
                  <div>キャラクター数: {statistics.totalCharacters}</div>
                  <div>関係性の数: {statistics.totalRelationships}</div>
                  <div>平均関係数: {statistics.averageConnections.toFixed(1)}</div>
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </div>

      {/* サイドパネル */}
      <div className="w-96 space-y-4">
        {/* キャラクター詳細 */}
        {selectedCharacter && (
          <CharacterDetailPanel
            character={selectedCharacter}
            relationships={relationships}
            characters={characters}
            onClose={() => setSelectedCharacter(null)}
          />
        )}

        {/* 統計詳細 */}
        <StatisticsPanel statistics={statistics} />
      </div>

      {/* 関係追加ダイアログ */}
      <AnimatePresence>
        <AddRelationshipDialog
          isOpen={showAddRelationshipDialog}
          characters={characters}
          newRelationship={newRelationship}
          onRelationshipChange={setNewRelationship}
          onAdd={handleAddRelationship}
          onClose={() => setShowAddRelationshipDialog(false)}
        />
      </AnimatePresence>
    </div>
  );
}

export function CharacterRelationshipDiagram() {
  return (
    <ReactFlowProvider>
      <CharacterRelationshipDiagramInner />
    </ReactFlowProvider>
  );
}

// 互換性のため、既存の名前でもエクスポート
export { CharacterRelationshipDiagram as default };