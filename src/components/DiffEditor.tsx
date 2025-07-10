import React from 'react';

interface DiffEditorProps {
  original: string;
  edited: string;
  onAccept: () => void;
  onReject: () => void;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({ 
  original, 
  edited, 
  onAccept, 
  onReject 
}) => {
  // 簡易的な差分表示（実際の実装ではdiff-match-patchなどを使用）
  const getDiffView = () => {
    const originalLines = original.split('\n');
    const editedLines = edited.split('\n');
    
    return (
      <div className="font-mono text-sm">
        {editedLines.map((line, i) => {
          const isChanged = originalLines[i] !== line;
          return (
            <div key={i} className={isChanged ? 'bg-yellow-50' : ''}>
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">提案された変更</h3>
      <div className="mb-4">
        {getDiffView()}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          変更を適用
        </button>
        <button
          onClick={onReject}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          変更を破棄
        </button>
      </div>
    </div>
  );
};