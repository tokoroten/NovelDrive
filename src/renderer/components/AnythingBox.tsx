import React, { useState, useCallback, useRef, useEffect } from 'react';

interface ProcessingResult {
  originalId: string;
  inspirationCount: number;
  knowledgeCount: number;
}

interface SavedKnowledge {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
}

export function AnythingBox() {
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [recentEntries, setRecentEntries] = useState<SavedKnowledge[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await window.electronAPI.anythingBox.process({
        content: content.trim(),
      });

      if (response.success) {
        setResult(response.processed);
        setContent('');

        // URLの場合はクロールも開始
        if (content.trim().startsWith('http')) {
          await window.electronAPI.crawler.crawl(content.trim(), 2);
        }
      } else {
        setError(response.error || '処理に失敗しました');
      }
    } catch (err) {
      setError('エラーが発生しました');
      // Error processing input
    } finally {
      setIsProcessing(false);
    }
  }, [content]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const text = e.dataTransfer.getData('text/plain');
    if (text) {
      setContent(text);
    }

    // ファイルのドロップも対応（将来的に画像や音声ファイルの処理用）
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // TODO: ファイル処理の実装
      // Dropped files
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // 画像のペーストにも対応（将来的に）
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        // TODO: 画像処理の実装
        // Pasted image
      }
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter で送信
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Load recent entries on component mount
  useEffect(() => {
    loadRecentHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecentHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await window.electronAPI.anythingBox.history({ limit: 5 });
      setRecentEntries(history);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Reload history after successful processing
  useEffect(() => {
    if (result) {
      loadRecentHistory();
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-4xl mx-auto" data-testid="anything-box-page">
      <h2 className="text-3xl font-bold text-secondary-800 mb-2" data-testid="anything-box-title">Anything Box</h2>
      <p className="text-secondary-600 mb-6">
        ニュース、SNS、アイデア、URL... なんでも放り込んでください。 AIが創作の種を見つけ出します。
      </p>

      <div
        className={`relative bg-white rounded-lg shadow-lg border-2 transition-colors ${
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder="テキスト、URL、アイデアをここに入力またはドラッグ&ドロップ..."
          className="w-full p-6 min-h-[300px] text-lg resize-none focus:outline-none bg-transparent"
          disabled={isProcessing}
          data-testid="content-textarea"
        />

        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary-100 bg-opacity-90 pointer-events-none rounded-lg">
            <p className="text-primary-700 text-xl font-medium">ここにドロップしてください</p>
          </div>
        )}

        <div className="flex items-center justify-between p-4 border-t border-gray-200">
          <div className="text-sm text-secondary-500">
            {content.length > 0 && `${content.length} 文字`}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!content.trim() || isProcessing}
            data-testid="submit-button"
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              !content.trim() || isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                処理中...
              </span>
            ) : (
              '処理開始'
            )}
          </button>
        </div>
      </div>

      {/* 処理結果 */}
      {result && (
        <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">処理完了</h3>
          <div className="space-y-1 text-green-700">
            <p>✓ {result.knowledgeCount} 個のナレッジを生成</p>
            <p>✓ {result.inspirationCount} 個のインスピレーションを抽出</p>
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mt-6 p-6 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">エラー</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 使い方のヒント */}
      <div className="mt-8 p-6 bg-secondary-50 rounded-lg">
        <h3 className="text-lg font-semibold text-secondary-800 mb-3">使い方のヒント</h3>
        <ul className="space-y-2 text-secondary-600">
          <li className="flex items-start">
            <span className="text-primary-500 mr-2">•</span>
            <span>ニュース記事をコピペして、物語のインスピレーションを得る</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary-500 mr-2">•</span>
            <span>興味深いWebサイトのURLを入力して、関連情報を一気に収集</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary-500 mr-2">•</span>
            <span>思いついたアイデアの断片を投げ込んで、AIに膨らませてもらう</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary-500 mr-2">•</span>
            <span>Ctrl/Cmd + Enter で素早く送信</span>
          </li>
        </ul>
      </div>

      {/* 最近の入力履歴 */}
      {recentEntries.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-secondary-800 mb-3">最近の処理</h3>
          {isLoadingHistory ? (
            <div className="text-gray-500">読み込み中...</div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setContent(entry.content)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800">{entry.title}</h4>
                    <span className="text-xs text-gray-500">
                      {new Date(entry.createdAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{entry.content}</p>
                  <div className="mt-2">
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {entry.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
