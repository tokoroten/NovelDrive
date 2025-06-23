/**
 * グループノードコンポーネント
 */

import React from 'react';
import { GroupNodeData } from './types';

interface GroupNodeProps {
  data: GroupNodeData;
}

export function GroupNode({ data }: GroupNodeProps) {
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
}