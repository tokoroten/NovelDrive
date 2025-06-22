import React, { useState } from 'react';

interface EditorToolbarProps {
  onFormat: (format: string, value?: string) => void;
  onInsert: (type: string, value?: string) => void;
  wordCount: number;
  characterCount: number;
}

export function EditorToolbar({ onFormat, onInsert, wordCount, characterCount }: EditorToolbarProps) {
  const [showRubyDialog, setShowRubyDialog] = useState(false);
  const [rubyText, setRubyText] = useState('');
  const [rubyReading, setRubyReading] = useState('');

  const formatButtons = [
    { icon: 'B', format: 'bold', title: '太字 (Ctrl+B)' },
    { icon: 'I', format: 'italic', title: '斜体 (Ctrl+I)' },
    { icon: '｜', format: 'emphasis', title: '傍点' },
    { icon: 'ル', format: 'ruby', title: 'ルビ' },
  ];

  const insertButtons = [
    { icon: '—', type: 'dash', title: 'ダッシュ' },
    { icon: '…', type: 'ellipsis', title: '三点リーダー' },
    { icon: '「」', type: 'quote', title: 'かぎ括弧' },
    { icon: '『』', type: 'double-quote', title: '二重かぎ括弧' },
    { icon: '※', type: 'note', title: '注釈' },
  ];

  const handleFormat = (format: string) => {
    if (format === 'ruby') {
      setShowRubyDialog(true);
    } else {
      onFormat(format);
    }
  };

  const handleRubyInsert = () => {
    if (rubyText && rubyReading) {
      onFormat('ruby', `｜${rubyText}《${rubyReading}》`);
      setRubyText('');
      setRubyReading('');
      setShowRubyDialog(false);
    }
  };

  const handleInsert = (type: string) => {
    switch (type) {
      case 'dash':
        onInsert('text', '——');
        break;
      case 'ellipsis':
        onInsert('text', '……');
        break;
      case 'quote':
        onInsert('wrap', { before: '「', after: '」' });
        break;
      case 'double-quote':
        onInsert('wrap', { before: '『', after: '』' });
        break;
      case 'note':
        onInsert('text', '※');
        break;
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1">
          {formatButtons.map((btn) => (
            <button
              key={btn.format}
              onClick={() => handleFormat(btn.format)}
              className="px-2 py-1 text-sm font-medium hover:bg-gray-200 rounded transition-colors"
              title={btn.title}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex items-center gap-1">
          {insertButtons.map((btn) => (
            <button
              key={btn.type}
              onClick={() => handleInsert(btn.type)}
              className="px-2 py-1 text-sm hover:bg-gray-200 rounded transition-colors"
              title={btn.title}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-300" />

        <div className="flex items-center gap-4 text-sm text-gray-600 ml-auto">
          <span>{wordCount.toLocaleString()}語</span>
          <span>{characterCount.toLocaleString()}文字</span>
        </div>
      </div>

      {/* ルビダイアログ */}
      {showRubyDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">ルビを追加</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  対象の文字
                </label>
                <input
                  type="text"
                  value={rubyText}
                  onChange={(e) => setRubyText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ふりがな
                </label>
                <input
                  type="text"
                  value={rubyReading}
                  onChange={(e) => setRubyReading(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowRubyDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                キャンセル
              </button>
              <button
                onClick={handleRubyInsert}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                追加
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}