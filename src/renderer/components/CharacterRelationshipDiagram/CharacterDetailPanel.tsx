/**
 * キャラクター詳細パネルコンポーネント
 */

import React from 'react';
import { Character, Relationship, RELATIONSHIP_COLORS, RELATIONSHIP_DESCRIPTIONS } from './types';

interface CharacterDetailPanelProps {
  character: Character;
  relationships: Relationship[];
  characters: Character[];
  onClose: () => void;
}

export function CharacterDetailPanel({
  character,
  relationships,
  characters,
  onClose
}: CharacterDetailPanelProps) {
  const characterRelationships = relationships.filter(rel => 
    rel.source_character_id === character.id || 
    (rel.mutual && rel.target_character_id === character.id)
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">{character.name}</h3>
      
      <div className="space-y-4">
        {character.profile && (
          <div>
            <span className="text-sm font-medium text-gray-600">プロフィール</span>
            <p className="text-gray-800 text-sm mt-1">{character.profile}</p>
          </div>
        )}

        {character.personality && (
          <div>
            <span className="text-sm font-medium text-gray-600">性格</span>
            <p className="text-gray-800 text-sm mt-1">{character.personality}</p>
          </div>
        )}

        {character.background && (
          <div>
            <span className="text-sm font-medium text-gray-600">背景</span>
            <p className="text-gray-800 text-sm mt-1">{character.background}</p>
          </div>
        )}

        {/* 関係性リスト */}
        <div>
          <span className="text-sm font-medium text-gray-600">関係性</span>
          <div className="mt-2 space-y-2">
            {characterRelationships.map(rel => {
              const otherCharId = rel.source_character_id === character.id 
                ? rel.target_character_id 
                : rel.source_character_id;
              const otherChar = characters.find(c => c.id === otherCharId);
              
              return otherChar ? (
                <div key={rel.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div className={`px-2 py-1 rounded text-xs text-white`}
                    style={{ backgroundColor: RELATIONSHIP_COLORS[rel.relationship_type] }}
                  >
                    {RELATIONSHIP_DESCRIPTIONS[rel.relationship_type]}
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
          onClick={onClose}
          className="w-full py-2 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}