/**
 * グラフコントロールパネルコンポーネント
 */

import React from 'react';
import { Project, LayoutType, RelationshipType } from './types';

interface GraphControlsProps {
  projects: Project[];
  selectedProjectId: string;
  layoutType: LayoutType;
  filterType: string;
  charactersCount: number;
  onProjectChange: (projectId: string) => void;
  onLayoutChange: (layout: LayoutType) => void;
  onFilterChange: (filter: string) => void;
  onAddRelationship: () => void;
}

export function GraphControls({
  projects,
  selectedProjectId,
  layoutType,
  filterType,
  charactersCount,
  onProjectChange,
  onLayoutChange,
  onFilterChange,
  onAddRelationship
}: GraphControlsProps) {
  return (
    <div className="p-4 border-b border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">キャラクター関係図</h3>
        <div className="flex items-center gap-4">
          {/* プロジェクト選択 */}
          <select
            value={selectedProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
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
            onChange={(e) => onLayoutChange(e.target.value as LayoutType)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="force">力学的配置</option>
            <option value="hierarchical">階層配置</option>
            <option value="circular">円形配置</option>
          </select>

          {/* フィルター */}
          <select
            value={filterType}
            onChange={(e) => onFilterChange(e.target.value)}
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
            onClick={onAddRelationship}
            disabled={charactersCount < 2}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
          >
            関係を追加
          </button>
        </div>
      </div>
    </div>
  );
}