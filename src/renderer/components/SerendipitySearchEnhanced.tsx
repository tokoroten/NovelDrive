import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/serendipity-animations.css';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: string;
  score: number;
  projectId?: string;
  metadata?: any;
  createdAt: string;
  serendipityFactors?: {
    dimensionalShift: number;
    noiseInjection: number;
    temporalDistance: number;
    contextualSurprise: number;
  };
}

interface SearchProgress {
  phase: 'initializing' | 'vector_search' | 'serendipity_transform' | 'ranking' | 'completed';
  progress: number;
  message: string;
  details?: string;
}

interface SerendipitySearchEnhancedProps {
  projectId?: string;
  onResultSelect?: (result: SearchResult) => void;
  className?: string;
}

export function SerendipitySearchEnhanced({ 
  projectId, 
  onResultSelect, 
  className = '' 
}: SerendipitySearchEnhancedProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);
  const [serendipityLevel, setSerendipityLevel] = useState(0.3);
  const [searchMode, setSearchMode] = useState<'normal' | 'serendipity' | 'exploration'>('serendipity');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visualMode, setVisualMode] = useState<'list' | 'bubble' | 'constellation'>('bubble');
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // 検索履歴の管理
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('serendipitySearchHistory');
    if (saved) {
      setSearchHistory(JSON.parse(saved));
    }
  }, []);

  const saveSearchToHistory = (searchQuery: string) => {
    const newHistory = [searchQuery, ...searchHistory.filter(h => h !== searchQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('serendipitySearchHistory', JSON.stringify(newHistory));
  };

  const simulateSearchProgress = () => {
    const phases: SearchProgress[] = [
      { phase: 'initializing', progress: 10, message: '検索の準備中...', details: 'クエリを解析しています' },
      { phase: 'vector_search', progress: 30, message: 'ベクトル検索実行中...', details: '類似する知識を探しています' },
      { phase: 'serendipity_transform', progress: 60, message: 'セレンディピティ変換中...', details: '次元ノイズを注入しています' },
      { phase: 'ranking', progress: 85, message: '結果をランキング中...', details: '偶然性と関連性のバランスを調整' },
      { phase: 'completed', progress: 100, message: '検索完了', details: '' },
    ];

    let currentPhase = 0;
    const progressInterval = setInterval(() => {
      if (currentPhase < phases.length) {
        setSearchProgress(phases[currentPhase]);
        currentPhase++;
      } else {
        clearInterval(progressInterval);
        setSearchProgress(null);
      }
    }, 800);

    return progressInterval;
  };

  const performSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setResults([]);
    setSelectedResult(null);

    const progressInterval = simulateSearchProgress();

    try {
      saveSearchToHistory(searchQuery);

      const searchResults = await window.electronAPI.serendipity.search(searchQuery, {
        limit: 20,
        projectId,
        serendipityLevel,
        mode: searchMode,
      });

      // Mock serendipity factors for visual feedback
      const enhancedResults: SearchResult[] = searchResults.map((result: any, index: number) => ({
        ...result,
        serendipityFactors: {
          dimensionalShift: Math.random() * 0.8 + 0.1,
          noiseInjection: Math.random() * 0.6 + 0.2,
          temporalDistance: Math.random() * 0.9 + 0.1,
          contextualSurprise: Math.random() * 0.7 + 0.2,
        },
      }));

      setTimeout(() => {
        setResults(enhancedResults);
        setIsSearching(false);
        clearInterval(progressInterval);
        setSearchProgress(null);
      }, 1000);

    } catch (error) {
      console.error('Search failed:', error);
      setIsSearching(false);
      clearInterval(progressInterval);
      setSearchProgress(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const getSerendipityColor = (score: number) => {
    if (score > 0.7) return 'text-purple-600 bg-purple-100';
    if (score > 0.5) return 'text-blue-600 bg-blue-100';
    if (score > 0.3) return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      inspiration: '💡',
      article: '📄',
      idea: '🧠',
      url: '🔗',
      image: '🖼️',
      audio: '🎵',
      theme: '🎭',
      character: '👤',
      plot: '📚',
    };
    return icons[type] || '📋';
  };

  const renderProgressBar = () => {
    if (!searchProgress) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{searchProgress.message}</span>
          <span className="text-xs text-gray-500">{searchProgress.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${searchProgress.progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {searchProgress.details && (
          <p className="text-xs text-gray-600">{searchProgress.details}</p>
        )}
      </motion.div>
    );
  };

  const renderBubbleView = () => {
    return (
      <div className="relative min-h-96 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-lg p-6 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <AnimatePresence>
          {results.map((result, index) => {
            const size = 60 + (result.score * 80);
            const x = (index % 4) * 25 + (Math.random() - 0.5) * 10;
            const y = Math.floor(index / 4) * 30 + (Math.random() - 0.5) * 15;
            
            return (
              <motion.div
                key={result.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: `${x}%`,
                  y: `${y}%`,
                }}
                whileHover={{ scale: 1.1, zIndex: 10 }}
                transition={{ 
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 200,
                  damping: 15
                }}
                className="absolute cursor-pointer group"
                onClick={() => setSelectedResult(result)}
                style={{
                  width: size,
                  height: size,
                }}
              >
                <div 
                  className={`w-full h-full rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white font-medium relative overflow-hidden ${getSerendipityColor(result.serendipityFactors?.contextualSurprise || 0.5)}`}
                  style={{
                    background: `conic-gradient(from ${index * 45}deg, 
                      hsl(${200 + result.score * 160}, 70%, 60%), 
                      hsl(${250 + result.score * 100}, 80%, 70%))`,
                  }}
                >
                  {/* セレンディピティの視覚化 */}
                  <div 
                    className="absolute inset-0 bg-white opacity-20 rounded-full"
                    style={{
                      transform: `scale(${0.5 + (result.serendipityFactors?.dimensionalShift || 0) * 0.5})`,
                      animation: `pulse ${2 + Math.random() * 2}s infinite ease-in-out`,
                    }}
                  />
                  
                  <div className="text-center z-10 relative">
                    <div className="text-lg mb-1">{getTypeIcon(result.type)}</div>
                    <div className="text-xs font-bold leading-tight">
                      {result.title.slice(0, 8)}...
                    </div>
                  </div>

                  {/* ホバー時の詳細表示 */}
                  <div className="absolute inset-0 bg-black bg-opacity-80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-2">
                    <div className="text-center text-white text-xs">
                      <div className="font-medium mb-1">{result.title}</div>
                      <div className="text-xs opacity-80">
                        スコア: {Math.round(result.score * 100)}%
                      </div>
                      <div className="text-xs opacity-80">
                        偶然性: {Math.round((result.serendipityFactors?.contextualSurprise || 0) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  const renderConstellationView = () => {
    return (
      <div className="relative min-h-96 bg-gray-900 rounded-lg p-6 overflow-hidden">
        {/* 背景の星 */}
        <div className="absolute inset-0">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        <AnimatePresence>
          {results.map((result, index) => {
            const angle = (index / results.length) * 2 * Math.PI;
            const radius = 100 + (result.score * 80);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            return (
              <motion.div
                key={result.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  x: x + 200,
                  y: y + 150,
                }}
                whileHover={{ scale: 1.2 }}
                transition={{ delay: index * 0.05 }}
                className="absolute cursor-pointer"
                onClick={() => setSelectedResult(result)}
              >
                <div className="relative">
                  {/* 接続線 */}
                  <svg 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ width: radius * 2, height: radius * 2 }}
                  >
                    <line
                      x1={radius}
                      y1={radius}
                      x2={radius - x}
                      y2={radius - y}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="1"
                    />
                  </svg>
                  
                  {/* ノード */}
                  <div 
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-lg shadow-lg border-2 border-white"
                    style={{
                      boxShadow: `0 0 ${10 + result.score * 20}px rgba(147, 51, 234, 0.5)`,
                    }}
                  >
                    {getTypeIcon(result.type)}
                  </div>
                  
                  {/* ラベル */}
                  <div className="absolute top-14 left-1/2 transform -translate-x-1/2 text-center">
                    <div className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded whitespace-nowrap">
                      {result.title.slice(0, 15)}...
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-3">
        <AnimatePresence>
          {results.map((result, index) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-lg p-4 shadow-md border hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedResult(result)}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getTypeIcon(result.type)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{result.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">{result.content}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getSerendipityColor(result.score)}`}>
                      関連度: {Math.round(result.score * 100)}%
                    </span>
                    {result.serendipityFactors && (
                      <span className={`px-2 py-1 text-xs rounded-full ${getSerendipityColor(result.serendipityFactors.contextualSurprise)}`}>
                        偶然性: {Math.round(result.serendipityFactors.contextualSurprise * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 検索フォーム */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold">セレンディピティ検索</h2>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            {showAdvanced ? '簡易表示' : '詳細設定'}
          </button>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="検索クエリを入力..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:bg-gray-400 transition-all"
            >
              {isSearching ? '検索中...' : '検索'}
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  セレンディピティレベル: {Math.round(serendipityLevel * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={serendipityLevel}
                  onChange={(e) => setSerendipityLevel(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">検索モード</label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="normal">通常検索</option>
                  <option value="serendipity">セレンディピティ</option>
                  <option value="exploration">探索モード</option>
                </select>
              </div>
            </div>
          )}
        </form>

        {/* 検索履歴 */}
        {searchHistory.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">最近の検索</label>
            <div className="flex flex-wrap gap-2">
              {searchHistory.slice(0, 5).map((historyQuery, index) => (
                <button
                  key={index}
                  onClick={() => performSearch(historyQuery)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {historyQuery}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 進行状況バー */}
      <AnimatePresence>
        {renderProgressBar()}
      </AnimatePresence>

      {/* 結果表示 */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              検索結果 ({results.length}件)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setVisualMode('list')}
                className={`px-3 py-1 text-sm rounded ${visualMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                リスト
              </button>
              <button
                onClick={() => setVisualMode('bubble')}
                className={`px-3 py-1 text-sm rounded ${visualMode === 'bubble' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                バブル
              </button>
              <button
                onClick={() => setVisualMode('constellation')}
                className={`px-3 py-1 text-sm rounded ${visualMode === 'constellation' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
              >
                星座
              </button>
            </div>
          </div>

          {visualMode === 'list' && renderListView()}
          {visualMode === 'bubble' && renderBubbleView()}
          {visualMode === 'constellation' && renderConstellationView()}
        </div>
      )}

      {/* 詳細モーダル */}
      <AnimatePresence>
        {selectedResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setSelectedResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">{selectedResult.title}</h3>
                <button
                  onClick={() => setSelectedResult(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">内容</span>
                  <p className="text-gray-800 mt-1">{selectedResult.content}</p>
                </div>

                {selectedResult.serendipityFactors && (
                  <div>
                    <span className="text-sm font-medium text-gray-600">セレンディピティ要因</span>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div className="bg-purple-50 p-3 rounded">
                        <div className="text-sm font-medium">次元シフト</div>
                        <div className="text-lg">{Math.round(selectedResult.serendipityFactors.dimensionalShift * 100)}%</div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="text-sm font-medium">ノイズ注入</div>
                        <div className="text-lg">{Math.round(selectedResult.serendipityFactors.noiseInjection * 100)}%</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded">
                        <div className="text-sm font-medium">時間的距離</div>
                        <div className="text-lg">{Math.round(selectedResult.serendipityFactors.temporalDistance * 100)}%</div>
                      </div>
                      <div className="bg-orange-50 p-3 rounded">
                        <div className="text-sm font-medium">文脈的驚き</div>
                        <div className="text-lg">{Math.round(selectedResult.serendipityFactors.contextualSurprise * 100)}%</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      if (onResultSelect) onResultSelect(selectedResult);
                      setSelectedResult(null);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    選択
                  </button>
                  <button
                    onClick={() => setSelectedResult(null)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}