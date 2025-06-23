/**
 * キャラクターノードコンポーネント
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CharacterNodeData } from './types';

interface CharacterNodeProps {
  data: CharacterNodeData;
}

export function CharacterNode({ data }: CharacterNodeProps) {
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
}