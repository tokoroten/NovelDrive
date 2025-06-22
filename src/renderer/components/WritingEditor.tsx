import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Chapter {
  id: string;
  title: string;
  content: string;
  plotId: string;
  order: number;
  status: 'draft' | 'writing' | 'review' | 'completed';
  wordCount: number;
  characterCount: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface WritingSession {
  id: string;
  chapterId: string;
  startTime: string;
  endTime?: string;
  wordCountStart: number;
  wordCountEnd?: number;
  agentSuggestions: Array<{
    id: string;
    agentId: string;
    agentName: string;
    suggestion: string;
    accepted: boolean;
    timestamp: string;
  }>;
}

interface Plot {
  id: string;
  title: string;
  parentId?: string;
  version: string;
}

export function WritingEditor() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<string>('');
  const [content, setContent] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [writingSession, setWritingSession] = useState<WritingSession | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState<WritingSession['agentSuggestions']>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showAIAssistant, setShowAIAssistant] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // 初期データの読み込み
  useEffect(() => {
    loadPlots();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // プロット選択時にチャプターを読み込み
  useEffect(() => {
    if (selectedPlot) {
      loadChapters(selectedPlot);
    }
  }, [selectedPlot]);

  // 自動保存
  useEffect(() => {
    if (selectedChapter && content !== selectedChapter.content) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }

      setAutoSaveStatus('saving');
      autoSaveTimeout.current = setTimeout(() => {
        saveChapter();
      }, 2000);
    }

    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, [content, selectedChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // 文字数・単語数のカウント
  useEffect(() => {
    const chars = content.length;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    setCharacterCount(chars);
    setWordCount(words);
  }, [content]);

  const loadPlots = async () => {
    try {
      const sql = `
        SELECT id, title, parent_id as parentId, version
        FROM plots
        WHERE status = 'active'
        ORDER BY created_at DESC
      `;
      const result = await window.electronAPI.database.query(sql);
      setPlots(result);
      
      if (result.length > 0 && !selectedPlot) {
        setSelectedPlot(result[0].id);
      }
    } catch (error) {
      // Failed to load plots
    }
  };

  const loadChapters = async (plotId: string) => {
    try {
      const sql = `
        SELECT *
        FROM chapters
        WHERE plot_id = ?
        ORDER BY "order" ASC
      `;
      const result = await window.electronAPI.database.query(sql, [plotId]);
      
      const chaptersWithCounts = result.map((chapter: Record<string, unknown>) => ({
        id: chapter.id as string,
        title: chapter.title as string,
        content: chapter.content as string,
        plotId: chapter.plot_id as string,
        order: chapter.order as number,
        status: chapter.status as 'draft' | 'writing' | 'review' | 'completed',
        wordCount: (chapter.word_count as number) || 0,
        characterCount: (chapter.character_count as number) || 0,
        createdAt: chapter.created_at as string,
        updatedAt: chapter.updated_at as string,
        metadata: JSON.parse((chapter.metadata as string) || '{}'),
      }));
      
      setChapters(chaptersWithCounts);
    } catch (error) {
      // Failed to load chapters
    }
  };

  const createNewChapter = async () => {
    if (!selectedPlot) return;

    const newChapter: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'> = {
      title: `第${chapters.length + 1}章`,
      content: '',
      plotId: selectedPlot,
      order: chapters.length,
      status: 'draft',
      wordCount: 0,
      characterCount: 0,
    };

    try {
      const result = await window.electronAPI.chapters.create(newChapter);
      await loadChapters(selectedPlot);
      
      const created = chapters.find(c => c.id === result.id);
      if (created) {
        setSelectedChapter(created);
        setContent(created.content);
      }
    } catch (error) {
      // Failed to create chapter
    }
  };

  const saveChapter = async () => {
    if (!selectedChapter) return;

    try {
      await window.electronAPI.chapters.update(selectedChapter.id, {
        content,
        wordCount,
        characterCount,
        status: isWriting ? 'writing' : selectedChapter.status,
      });

      setAutoSaveStatus('saved');
      
      // 章リストを更新
      setChapters(prev =>
        prev.map(ch =>
          ch.id === selectedChapter.id
            ? { ...ch, content, wordCount, characterCount, updatedAt: new Date().toISOString() }
            : ch
        )
      );
    } catch (error) {
      // Failed to save chapter
      setAutoSaveStatus('error');
    }
  };

  const startWritingSession = async () => {
    if (!selectedChapter) return;

    const session: Omit<WritingSession, 'id'> = {
      chapterId: selectedChapter.id,
      startTime: new Date().toISOString(),
      wordCountStart: wordCount,
      agentSuggestions: [],
    };

    setIsWriting(true);
    setWritingSession({
      ...session,
      id: Date.now().toString(),
    });

    // AIアシスタントを開始
    requestAISuggestions();
  };

  const endWritingSession = async () => {
    if (!writingSession) return;

    setIsWriting(false);
    setWritingSession(null);
    
    // セッション終了時に保存
    await saveChapter();
  };

  const requestAISuggestions = async () => {
    if (!selectedChapter || !selectedPlot) return;

    try {
      // プロットとチャプター情報を使ってAIに提案を求める
      const context = {
        plotId: selectedPlot,
        chapterTitle: selectedChapter.title,
        previousContent: content.slice(-1000), // 直前の1000文字
        chapterOrder: selectedChapter.order,
      };

      const suggestions = await window.electronAPI.agents.requestWritingSuggestions(context);
      
      if (suggestions && suggestions.length > 0) {
        setAgentSuggestions(prev => [...prev, ...suggestions]);
      }
    } catch (error) {
      // Failed to get AI suggestions
    }
  };

  const applySuggestion = (suggestion: WritingSession['agentSuggestions'][0]) => {
    // 提案を本文に適用
    if (textareaRef.current) {
      const position = textareaRef.current.selectionStart;
      const newContent = 
        content.slice(0, position) + 
        '\n' + suggestion.suggestion + '\n' + 
        content.slice(position);
      
      setContent(newContent);
      
      // カーソル位置を調整
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = position + suggestion.suggestion.length + 2;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const handleChapterSelect = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setContent(chapter.content);
    setAgentSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Sで保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveChapter();
    }
  };

  return (
    <div className="flex h-full gap-4">
      {/* サイドバー：章リスト */}
      <div className="w-64 bg-white rounded-lg shadow-md p-4 overflow-y-auto">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            プロット選択
          </label>
          <select
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">プロットを選択</option>
            {plots.map((plot) => (
              <option key={plot.id} value={plot.id}>
                {plot.title} (v{plot.version})
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">章一覧</h3>
          <button
            onClick={createNewChapter}
            disabled={!selectedPlot}
            className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:bg-gray-400"
          >
            新規
          </button>
        </div>

        <div className="space-y-2">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => handleChapterSelect(chapter)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selectedChapter?.id === chapter.id
                  ? 'bg-primary-100 border-primary-500 border'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium text-sm">{chapter.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {chapter.characterCount.toLocaleString()}文字
              </div>
              <div className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(chapter.updatedAt), {
                  addSuffix: true,
                  locale: ja,
                })}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* メインエディタ */}
      <div className="flex-1 bg-white rounded-lg shadow-md">
        {selectedChapter ? (
          <>
            {/* ツールバー */}
            <div className="border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <input
                    type="text"
                    value={selectedChapter.title}
                    onChange={(e) => {
                      setSelectedChapter({ ...selectedChapter, title: e.target.value });
                    }}
                    onBlur={async () => {
                      // Save title change
                      if (selectedChapter && selectedChapter.title) {
                        try {
                          await window.electronAPI.chapters.update(selectedChapter.id, {
                            title: selectedChapter.title,
                          });
                        } catch (error) {
                          console.error('Failed to update title:', error);
                        }
                      }
                    }}
                    className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary-500 focus:outline-none px-1"
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    {wordCount.toLocaleString()}語 / {characterCount.toLocaleString()}文字
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500">
                    {autoSaveStatus === 'saving' && '保存中...'}
                    {autoSaveStatus === 'saved' && '保存済み'}
                    {autoSaveStatus === 'error' && '保存エラー'}
                  </div>

                  {!isWriting ? (
                    <button
                      onClick={startWritingSession}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                    >
                      執筆開始
                    </button>
                  ) : (
                    <button
                      onClick={endWritingSession}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      執筆終了
                    </button>
                  )}

                  <button
                    onClick={() => setShowAIAssistant(!showAIAssistant)}
                    className={`px-3 py-2 rounded-md ${
                      showAIAssistant
                        ? 'bg-secondary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    AI
                  </button>
                </div>
              </div>
            </div>

            {/* エディタエリア */}
            <div className="flex h-[calc(100%-80px)]">
              <div className={`flex-1 ${showAIAssistant ? 'pr-80' : ''}`}>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ここに本文を入力..."
                  className="w-full h-full p-6 resize-none focus:outline-none text-gray-800 leading-relaxed"
                  style={{ fontFamily: 'Noto Serif JP, serif' }}
                />
              </div>

              {/* AIアシスタントパネル */}
              {showAIAssistant && isWriting && (
                <div className="w-80 border-l border-gray-200 p-4 overflow-y-auto">
                  <h3 className="font-semibold mb-4">AIアシスタント</h3>

                  {agentSuggestions.length === 0 ? (
                    <div className="text-gray-500 text-sm">
                      執筆を続けると、AIからの提案が表示されます...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {agentSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-medium text-primary-600">
                              {suggestion.agentName}
                            </span>
                            <button
                              onClick={() => applySuggestion(suggestion)}
                              className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                            >
                              適用
                            </button>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {suggestion.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={requestAISuggestions}
                    className="w-full mt-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    新しい提案を取得
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            {selectedPlot ? '章を選択するか、新しく作成してください' : 'プロットを選択してください'}
          </div>
        )}
      </div>
    </div>
  );
}