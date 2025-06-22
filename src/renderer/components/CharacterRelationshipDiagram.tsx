import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Position,
  ReactFlowProvider,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';

interface Character {
  id: string;
  project_id: string;
  name: string;
  profile?: string;
  personality?: string;
  speech_style?: string;
  background?: string;
  dialogue_samples?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface Relationship {
  id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: string;
  description?: string;
  strength: number; // 0-1
  mutual: boolean;
  metadata?: any;
}

interface Project {
  id: string;
  name: string;
}

// カスタムノードコンポーネント
const CharacterNode = ({ data }: { data: any }) => {
  const getGenderIcon = (gender?: string) => {
    switch (gender) {
      case '男性': return '👨';
      case '女性': return '👩';
      case '中性': return '🧑';
      default: return '👤';
    }
  };

  const getAgeGroup = (age?: number) => {
    if (!age) return '';
    if (age < 13) return '子供';
    if (age < 20) return '若者';
    if (age < 40) return '成人';
    if (age < 60) return '中年';
    return '高齢';
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`px-4 py-3 bg-white rounded-lg border-2 shadow-lg cursor-pointer transition-all ${
        data.selected ? 'border-purple-500 shadow-purple-200' : 'border-gray-300 hover:shadow-xl'
      }`}
      style={{
        minWidth: '150px',
        backgroundColor: data.backgroundColor || '#ffffff',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="text-2xl">{getGenderIcon(data.gender)}</div>
        <div className="flex-1">
          <div className="font-bold text-gray-900">{data.label}</div>
          {data.role && (
            <div className="text-xs text-gray-600">{data.role}</div>
          )}
        </div>
      </div>
      
      {data.age && (
        <div className="text-xs text-gray-500">
          {data.age}歳 ({getAgeGroup(data.age)})
        </div>
      )}
      
      {data.personality && (
        <div className="text-xs text-gray-600 mt-1 line-clamp-2">
          {data.personality}
        </div>
      )}

      {/* 関係性の強度インジケーター */}
      {data.relationshipCount > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <div className="text-xs text-gray-500">関係:</div>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(data.relationshipCount, 5) }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-purple-400"
                style={{ opacity: 1 - i * 0.15 }}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// グループノードコンポーネント
const GroupNode = ({ data }: { data: any }) => {
  return (
    <div
      className="px-6 py-4 bg-gray-100 rounded-xl border-2 border-dashed border-gray-400"
      style={{
        minWidth: '200px',
        minHeight: '100px',
      }}
    >
      <div className="text-center">
        <div className="text-lg font-bold text-gray-700 mb-1">{data.label}</div>
        <div className="text-sm text-gray-500">{data.memberCount}人</div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  character: CharacterNode,
  group: GroupNode,
};

// エッジのカスタムラベル
const EdgeLabel = ({ label, type }: { label: string; type: string }) => {
  const getTypeColor = () => {
    switch (type) {
      case 'family': return 'bg-red-100 text-red-700';
      case 'friend': return 'bg-blue-100 text-blue-700';
      case 'rival': return 'bg-orange-100 text-orange-700';
      case 'romantic': return 'bg-pink-100 text-pink-700';
      case 'mentor': return 'bg-green-100 text-green-700';
      case 'enemy': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor()}`}>
      {label}
    </div>
  );
};

function CharacterRelationshipDiagramInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [layoutType, setLayoutType] = useState<'force' | 'hierarchical' | 'circular'>('force');
  const [showGroups, setShowGroups] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddRelationshipDialog, setShowAddRelationshipDialog] = useState(false);
  const [newRelationship, setNewRelationship] = useState<Partial<Relationship>>({
    strength: 0.5,
    mutual: true,
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadCharactersAndRelationships();
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const projectList = await window.electronAPI.database.listProjects();
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadCharactersAndRelationships = async () => {
    if (!selectedProjectId) return;

    setIsLoading(true);
    try {
      // キャラクターを読み込み
      const characterList = await window.electronAPI.database.listCharacters({
        projectId: selectedProjectId,
      });
      setCharacters(characterList);

      // 関係性を読み込み（モックデータ）
      const mockRelationships: Relationship[] = generateMockRelationships(characterList);
      setRelationships(mockRelationships);

      // グラフを構築
      buildGraph(characterList, mockRelationships);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockRelationships = (chars: Character[]): Relationship[] => {
    const relationshipTypes = ['family', 'friend', 'rival', 'romantic', 'mentor', 'enemy', 'colleague'];
    const relationships: Relationship[] = [];
    
    // ランダムに関係性を生成
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        if (Math.random() > 0.6) { // 40%の確率で関係性を作成
          const type = relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)];
          relationships.push({
            id: `rel-${i}-${j}`,
            source_character_id: chars[i].id,
            target_character_id: chars[j].id,
            relationship_type: type,
            description: getRelationshipDescription(type),
            strength: Math.random() * 0.7 + 0.3,
            mutual: type !== 'mentor' && type !== 'enemy' && Math.random() > 0.3,
            metadata: {},
          });
        }
      }
    }
    
    return relationships;
  };

  const getRelationshipDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      family: '家族関係',
      friend: '友人関係',
      rival: 'ライバル関係',
      romantic: '恋愛関係',
      mentor: '師弟関係',
      enemy: '敵対関係',
      colleague: '同僚関係',
    };
    return descriptions[type] || '関係';
  };

  const buildGraph = (chars: Character[], rels: Relationship[]) => {
    // ノードを作成
    const newNodes: Node[] = chars.map((char, index) => {
      const metadata = char.metadata ? JSON.parse(char.metadata) : {};
      const relCount = rels.filter(r => 
        r.source_character_id === char.id || r.target_character_id === char.id
      ).length;

      return {
        id: char.id,
        type: 'character',
        position: getNodePosition(index, chars.length, layoutType),
        data: {
          label: char.name,
          personality: char.personality,
          role: metadata.role,
          age: metadata.age,
          gender: metadata.gender,
          backgroundColor: metadata.color || '#ffffff',
          relationshipCount: relCount,
          character: char,
        },
      };
    });

    // エッジを作成
    const newEdges: Edge[] = rels
      .filter(rel => filterType === 'all' || rel.relationship_type === filterType)
      .map((rel) => {
        const sourceChar = chars.find(c => c.id === rel.source_character_id);
        const targetChar = chars.find(c => c.id === rel.target_character_id);
        
        return {
          id: rel.id,
          source: rel.source_character_id,
          target: rel.target_character_id,
          type: 'smoothstep',
          animated: rel.strength > 0.7,
          style: {
            stroke: getRelationshipColor(rel.relationship_type),
            strokeWidth: 1 + rel.strength * 3,
          },
          markerEnd: rel.mutual ? undefined : {
            type: MarkerType.ArrowClosed,
            color: getRelationshipColor(rel.relationship_type),
          },
          label: rel.description,
          labelStyle: {
            fontSize: 12,
            fontWeight: 500,
          },
          labelBgStyle: {
            fill: '#ffffff',
            fillOpacity: 0.8,
          },
          data: {
            relationship: rel,
            sourceCharName: sourceChar?.name,
            targetCharName: targetChar?.name,
          },
        };
      });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const getNodePosition = (index: number, total: number, layout: string): { x: number; y: number } => {
    const centerX = 400;
    const centerY = 300;
    const radius = 250;

    switch (layout) {
      case 'circular':
        const angle = (index / total) * 2 * Math.PI;
        return {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      
      case 'hierarchical':
        const cols = Math.ceil(Math.sqrt(total));
        const row = Math.floor(index / cols);
        const col = index % cols;
        return {
          x: 100 + col * 200,
          y: 100 + row * 150,
        };
      
      case 'force':
      default:
        // 初期位置をランダムに配置（後でforce-directedレイアウトで調整）
        return {
          x: centerX + (Math.random() - 0.5) * radius * 2,
          y: centerY + (Math.random() - 0.5) * radius * 2,
        };
    }
  };

  const getRelationshipColor = (type: string): string => {
    const colors: Record<string, string> = {
      family: '#ef4444',
      friend: '#3b82f6',
      rival: '#f97316',
      romantic: '#ec4899',
      mentor: '#10b981',
      enemy: '#6b7280',
      colleague: '#8b5cf6',
    };
    return colors[type] || '#6b7280';
  };

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
  }, [setNodes, setEdges]);

  const handleAddRelationship = () => {
    if (!newRelationship.source_character_id || !newRelationship.target_character_id) {
      alert('キャラクターを選択してください');
      return;
    }

    const newRel: Relationship = {
      id: `rel-${Date.now()}`,
      source_character_id: newRelationship.source_character_id,
      target_character_id: newRelationship.target_character_id,
      relationship_type: newRelationship.relationship_type || 'friend',
      description: newRelationship.description,
      strength: newRelationship.strength || 0.5,
      mutual: newRelationship.mutual || false,
      metadata: {},
    };

    setRelationships([...relationships, newRel]);
    buildGraph(characters, [...relationships, newRel]);
    setShowAddRelationshipDialog(false);
    setNewRelationship({ strength: 0.5, mutual: true });
  };

  // 統計情報の計算
  const statistics = useMemo(() => {
    const typeCount: Record<string, number> = {};
    relationships.forEach(rel => {
      typeCount[rel.relationship_type] = (typeCount[rel.relationship_type] || 0) + 1;
    });

    const characterConnections: Record<string, number> = {};
    relationships.forEach(rel => {
      characterConnections[rel.source_character_id] = (characterConnections[rel.source_character_id] || 0) + 1;
      if (rel.mutual) {
        characterConnections[rel.target_character_id] = (characterConnections[rel.target_character_id] || 0) + 1;
      }
    });

    const mostConnected = characters
      .map(char => ({
        name: char.name,
        connections: characterConnections[char.id] || 0,
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 3);

    return {
      totalCharacters: characters.length,
      totalRelationships: relationships.length,
      typeCount,
      mostConnected,
      averageConnections: characters.length > 0 
        ? relationships.length * 2 / characters.length 
        : 0,
    };
  }, [characters, relationships]);

  return (
    <div className="flex h-full gap-4">
      {/* メインビュー */}
      <div className="flex-1 bg-white rounded-lg shadow-md">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">キャラクター関係図</h3>
            <div className="flex items-center gap-4">
              {/* プロジェクト選択 */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">プロジェクトを選択...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              {/* レイアウト選択 */}
              <select
                value={layoutType}
                onChange={(e) => setLayoutType(e.target.value as any)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="force">力学的配置</option>
                <option value="hierarchical">階層配置</option>
                <option value="circular">円形配置</option>
              </select>

              {/* フィルター */}
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  buildGraph(characters, relationships);
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">すべての関係</option>
                <option value="family">家族関係</option>
                <option value="friend">友人関係</option>
                <option value="rival">ライバル関係</option>
                <option value="romantic">恋愛関係</option>
                <option value="mentor">師弟関係</option>
                <option value="enemy">敵対関係</option>
              </select>

              {/* アクションボタン */}
              <button
                onClick={() => setShowAddRelationshipDialog(true)}
                disabled={characters.length < 2}
                className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
              >
                関係を追加
              </button>
            </div>
          </div>
        </div>

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
              <Background variant="dots" />
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">{selectedCharacter.name}</h3>
            
            <div className="space-y-4">
              {selectedCharacter.profile && (
                <div>
                  <span className="text-sm font-medium text-gray-600">プロフィール</span>
                  <p className="text-gray-800 text-sm mt-1">{selectedCharacter.profile}</p>
                </div>
              )}

              {selectedCharacter.personality && (
                <div>
                  <span className="text-sm font-medium text-gray-600">性格</span>
                  <p className="text-gray-800 text-sm mt-1">{selectedCharacter.personality}</p>
                </div>
              )}

              {selectedCharacter.background && (
                <div>
                  <span className="text-sm font-medium text-gray-600">背景</span>
                  <p className="text-gray-800 text-sm mt-1">{selectedCharacter.background}</p>
                </div>
              )}

              {/* 関係性リスト */}
              <div>
                <span className="text-sm font-medium text-gray-600">関係性</span>
                <div className="mt-2 space-y-2">
                  {relationships
                    .filter(rel => 
                      rel.source_character_id === selectedCharacter.id || 
                      (rel.mutual && rel.target_character_id === selectedCharacter.id)
                    )
                    .map(rel => {
                      const otherCharId = rel.source_character_id === selectedCharacter.id 
                        ? rel.target_character_id 
                        : rel.source_character_id;
                      const otherChar = characters.find(c => c.id === otherCharId);
                      
                      return otherChar ? (
                        <div key={rel.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <div className={`px-2 py-1 rounded text-xs text-white`}
                            style={{ backgroundColor: getRelationshipColor(rel.relationship_type) }}
                          >
                            {getRelationshipDescription(rel.relationship_type)}
                          </div>
                          <div className="text-sm">{otherChar.name}</div>
                          <div className="ml-auto text-xs text-gray-500">
                            強度: {Math.round(rel.strength * 100)}%
                          </div>
                        </div>
                      ) : null;
                    })}
                </div>
              </div>

              <button
                onClick={() => setSelectedCharacter(null)}
                className="w-full py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        {/* 統計詳細 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">関係性の分析</h3>
          
          <div className="space-y-4">
            <div>
              <span className="text-sm font-medium text-gray-600">関係タイプ別</span>
              <div className="mt-2 space-y-1">
                {Object.entries(statistics.typeCount).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: getRelationshipColor(type) }} 
                      />
                      <span className="text-sm">{getRelationshipDescription(type)}</span>
                    </div>
                    <span className="text-sm text-gray-600">{count}件</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-gray-600">最も関係の多いキャラクター</span>
              <div className="mt-2 space-y-1">
                {statistics.mostConnected.map((char, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{char.name}</span>
                    <span className="text-sm text-gray-600">{char.connections}関係</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 関係追加ダイアログ */}
      <AnimatePresence>
        {showAddRelationshipDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowAddRelationshipDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold mb-4">関係を追加</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    キャラクター1
                  </label>
                  <select
                    value={newRelationship.source_character_id || ''}
                    onChange={(e) => setNewRelationship({ ...newRelationship, source_character_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">選択してください...</option>
                    {characters.map(char => (
                      <option key={char.id} value={char.id}>{char.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    関係タイプ
                  </label>
                  <select
                    value={newRelationship.relationship_type || 'friend'}
                    onChange={(e) => setNewRelationship({ ...newRelationship, relationship_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="family">家族関係</option>
                    <option value="friend">友人関係</option>
                    <option value="rival">ライバル関係</option>
                    <option value="romantic">恋愛関係</option>
                    <option value="mentor">師弟関係</option>
                    <option value="enemy">敵対関係</option>
                    <option value="colleague">同僚関係</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    キャラクター2
                  </label>
                  <select
                    value={newRelationship.target_character_id || ''}
                    onChange={(e) => setNewRelationship({ ...newRelationship, target_character_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">選択してください...</option>
                    {characters
                      .filter(char => char.id !== newRelationship.source_character_id)
                      .map(char => (
                        <option key={char.id} value={char.id}>{char.name}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明（任意）
                  </label>
                  <input
                    type="text"
                    value={newRelationship.description || ''}
                    onChange={(e) => setNewRelationship({ ...newRelationship, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="例: 幼馴染、師匠と弟子"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    関係の強さ: {Math.round((newRelationship.strength || 0.5) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={newRelationship.strength || 0.5}
                    onChange={(e) => setNewRelationship({ ...newRelationship, strength: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newRelationship.mutual}
                      onChange={(e) => setNewRelationship({ ...newRelationship, mutual: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">相互関係</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddRelationshipDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAddRelationship}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  追加
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
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