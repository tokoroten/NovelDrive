/**
 * 統計パネルコンポーネント
 */

import React from 'react';
import { RelationshipStatistics, RELATIONSHIP_COLORS, RELATIONSHIP_DESCRIPTIONS, RelationshipType } from './types';

interface StatisticsPanelProps {
  statistics: RelationshipStatistics;
}

export function StatisticsPanel({ statistics }: StatisticsPanelProps) {
  return (
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
                    style={{ backgroundColor: RELATIONSHIP_COLORS[type as RelationshipType] }} 
                  />
                  <span className="text-sm">{RELATIONSHIP_DESCRIPTIONS[type as RelationshipType]}</span>
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
  );
}