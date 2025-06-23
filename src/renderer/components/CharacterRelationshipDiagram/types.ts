/**
 * CharacterRelationshipDiagram用の型定義
 */

export interface Character {
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

export interface Relationship {
  id: string;
  source_character_id: string;
  target_character_id: string;
  relationship_type: RelationshipType;
  description?: string;
  strength: number; // 0-1
  mutual: boolean;
  metadata?: any;
}

export interface Project {
  id: string;
  name: string;
}

export type RelationshipType = 
  | 'family' 
  | 'friend' 
  | 'rival' 
  | 'romantic' 
  | 'mentor' 
  | 'enemy' 
  | 'colleague';

export type LayoutType = 'force' | 'hierarchical' | 'circular';

export interface CharacterNodeData {
  label: string;
  personality?: string;
  role?: string;
  age?: number;
  gender?: string;
  backgroundColor: string;
  relationshipCount: number;
  character: Character;
  selected?: boolean;
}

export interface GroupNodeData {
  label: string;
  memberCount: number;
}

export interface RelationshipStatistics {
  totalCharacters: number;
  totalRelationships: number;
  typeCount: Record<string, number>;
  mostConnected: Array<{
    name: string;
    connections: number;
  }>;
  averageConnections: number;
}

// 関係性の色定義
export const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  family: '#ef4444',
  friend: '#3b82f6',
  rival: '#f97316',
  romantic: '#ec4899',
  mentor: '#10b981',
  enemy: '#6b7280',
  colleague: '#8b5cf6',
};

// 関係性の説明
export const RELATIONSHIP_DESCRIPTIONS: Record<RelationshipType, string> = {
  family: '家族関係',
  friend: '友人関係',
  rival: 'ライバル関係',
  romantic: '恋愛関係',
  mentor: '師弟関係',
  enemy: '敵対関係',
  colleague: '同僚関係',
};

// 関係性タイプのスタイル
export const getRelationshipTypeStyle = (type: RelationshipType) => {
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