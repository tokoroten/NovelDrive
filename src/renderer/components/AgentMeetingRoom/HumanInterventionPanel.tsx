/**
 * 人間介入パネルコンポーネント
 */

import React, { useRef, useEffect } from 'react';
import { HumanIntervention } from './types';

interface HumanInterventionPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  interventionHistory: HumanIntervention[];
  isActive: boolean;
}

export function HumanInterventionPanel({
  value,
  onChange,
  onSubmit,
  onClose,
  interventionHistory,
  isActive
}: HumanInterventionPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isActive]);

  const getImpactColor = (impact: HumanIntervention['impact']) => {
    switch (impact) {
      case 'low':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-red-600';
    }
  };

  const getImpactLabel = (impact: HumanIntervention['impact']) => {
    switch (impact) {
      case 'low':
        return '低';
      case 'medium':
        return '中';
      case 'high':
        return '高';
    }
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-red-700">人間介入</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="議論に介入する内容を入力してください..."
        className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
      />
      
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          キャンセル
        </button>
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          介入する
        </button>
      </div>

      {interventionHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">介入履歴</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {interventionHistory.map((intervention) => (
              <div key={intervention.id} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">{intervention.timestamp}</span>
                  <span className={`font-medium ${getImpactColor(intervention.impact)}`}>
                    影響度: {getImpactLabel(intervention.impact)}
                  </span>
                </div>
                <p className="text-gray-800 mt-1">{intervention.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}