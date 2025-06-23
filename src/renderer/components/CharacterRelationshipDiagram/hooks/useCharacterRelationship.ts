/**
 * キャラクター関係図のカスタムフック
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Node, Edge, MarkerType } from 'reactflow';
import {
  Character,
  Relationship,
  Project,
  LayoutType,
  RelationshipStatistics,
  CharacterNodeData,
  RELATIONSHIP_COLORS,
  RELATIONSHIP_DESCRIPTIONS,
  RelationshipType
} from '../types';

export function useCharacterRelationship() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [layoutType, setLayoutType] = useState<LayoutType>('force');
  const [showGroups, setShowGroups] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddRelationshipDialog, setShowAddRelationshipDialog] = useState(false);
  const [newRelationship, setNewRelationship] = useState<Partial<Relationship>>({
    strength: 0.5,
    mutual: true,
  });

  // プロジェクト一覧を読み込み
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

  // モック関係性データの生成
  const generateMockRelationships = (chars: Character[]): Relationship[] => {
    const relationshipTypes: RelationshipType[] = ['family', 'friend', 'rival', 'romantic', 'mentor', 'enemy', 'colleague'];
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
            description: RELATIONSHIP_DESCRIPTIONS[type],
            strength: Math.random() * 0.7 + 0.3,
            mutual: type !== 'mentor' && type !== 'enemy' && Math.random() > 0.3,
            metadata: {},
          });
        }
      }
    }
    
    return relationships;
  };

  // キャラクターと関係性を読み込み
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
      const mockRelationships = generateMockRelationships(characterList);
      setRelationships(mockRelationships);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ノード位置の計算
  const getNodePosition = (index: number, total: number, layout: LayoutType): { x: number; y: number } => {
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

  // グラフの構築
  const buildGraph = useCallback((chars: Character[], rels: Relationship[]): { nodes: Node[]; edges: Edge[] } => {
    // ノードを作成
    const nodes: Node[] = chars.map((char, index) => {
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
          selected: selectedCharacter?.id === char.id,
        } as CharacterNodeData,
      };
    });

    // エッジを作成
    const edges: Edge[] = rels
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
            stroke: RELATIONSHIP_COLORS[rel.relationship_type],
            strokeWidth: 1 + rel.strength * 3,
          },
          markerEnd: rel.mutual ? undefined : {
            type: MarkerType.ArrowClosed,
            color: RELATIONSHIP_COLORS[rel.relationship_type],
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

    return { nodes, edges };
  }, [layoutType, filterType, selectedCharacter]);

  // 新しい関係を追加
  const handleAddRelationship = () => {
    if (!newRelationship.source_character_id || !newRelationship.target_character_id) {
      alert('キャラクターを選択してください');
      return;
    }

    const newRel: Relationship = {
      id: `rel-${Date.now()}`,
      source_character_id: newRelationship.source_character_id,
      target_character_id: newRelationship.target_character_id,
      relationship_type: (newRelationship.relationship_type || 'friend') as RelationshipType,
      description: newRelationship.description,
      strength: newRelationship.strength || 0.5,
      mutual: newRelationship.mutual || false,
      metadata: {},
    };

    setRelationships([...relationships, newRel]);
    setShowAddRelationshipDialog(false);
    setNewRelationship({ strength: 0.5, mutual: true });
  };

  // 統計情報の計算
  const statistics = useMemo((): RelationshipStatistics => {
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

  // 初期化
  useEffect(() => {
    loadProjects();
  }, []);

  // プロジェクト選択時の処理
  useEffect(() => {
    if (selectedProjectId) {
      loadCharactersAndRelationships();
    }
  }, [selectedProjectId]);

  return {
    // State
    characters,
    relationships,
    projects,
    selectedProjectId,
    selectedCharacter,
    layoutType,
    showGroups,
    filterType,
    isLoading,
    showAddRelationshipDialog,
    newRelationship,
    statistics,

    // Actions
    setSelectedProjectId,
    setSelectedCharacter,
    setLayoutType,
    setShowGroups,
    setFilterType,
    setShowAddRelationshipDialog,
    setNewRelationship,
    handleAddRelationship,
    buildGraph,
  };
}