/**
 * 関係追加ダイアログコンポーネント
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Character, Relationship } from './types';

interface AddRelationshipDialogProps {
  isOpen: boolean;
  characters: Character[];
  newRelationship: Partial<Relationship>;
  onRelationshipChange: (relationship: Partial<Relationship>) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddRelationshipDialog({
  isOpen,
  characters,
  newRelationship,
  onRelationshipChange,
  onAdd,
  onClose
}: AddRelationshipDialogProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
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
              onChange={(e) => onRelationshipChange({ ...newRelationship, source_character_id: e.target.value })}
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
              onChange={(e) => onRelationshipChange({ ...newRelationship, relationship_type: e.target.value as any })}
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
              onChange={(e) => onRelationshipChange({ ...newRelationship, target_character_id: e.target.value })}
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
              onChange={(e) => onRelationshipChange({ ...newRelationship, description: e.target.value })}
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
              onChange={(e) => onRelationshipChange({ ...newRelationship, strength: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newRelationship.mutual}
                onChange={(e) => onRelationshipChange({ ...newRelationship, mutual: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">相互関係</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            追加
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}