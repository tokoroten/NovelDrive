import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface GachaResult {
  id: string;
  timestamp: string;
  elements: {
    character?: Record<string, unknown>;
    theme?: Record<string, unknown>;
    situation?: Record<string, unknown>;
    keyword?: Record<string, unknown>;
    worldSetting?: Record<string, unknown>;
  };
  generatedIdea: string;
  saved: boolean;
}

interface GachaHistory {
  results: GachaResult[];
  favorites: string[];
}

export function IdeaGacha() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentResult, setCurrentResult] = useState<GachaResult | null>(null);
  const [history, setHistory] = useState<GachaHistory>({
    results: [],
    favorites: [],
  });
  const [showHistory, setShowHistory] = useState(false);
  const [gachaMode, setGachaMode] = useState<'random' | 'themed' | 'character'>('random');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<unknown[]>([]);
  const [, setAnimationStep] = useState(0);

  useEffect(() => {
    loadProjects();
    loadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    try {
      const sql = 'SELECT id, name FROM projects ORDER BY name';
      const result = await window.electronAPI.database.query(sql);
      setProjects(result);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadHistory = () => {
    const saved = localStorage.getItem('ideaGachaHistory');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  };

  const saveHistory = (newHistory: GachaHistory) => {
    localStorage.setItem('ideaGachaHistory', JSON.stringify(newHistory));
    setHistory(newHistory);
  };

  const getRandomElements = async () => {
    const elements: GachaResult['elements'] = {};

    try {
      // ランダムにキャラクターを取得
      if (Math.random() > 0.3) {
        const charSql = selectedProject
          ? 'SELECT * FROM characters WHERE project_id = ? ORDER BY RANDOM() LIMIT 1'
          : 'SELECT * FROM characters ORDER BY RANDOM() LIMIT 1';
        const charResult = await window.electronAPI.database.query(
          charSql,
          selectedProject ? [selectedProject] : []
        );
        if (charResult.length > 0) {
          elements.character = charResult[0];
        }
      }

      // ランダムにテーマを取得
      if (Math.random() > 0.2) {
        const themeSql = selectedProject
          ? "SELECT * FROM knowledge WHERE type = 'theme' AND project_id = ? ORDER BY RANDOM() LIMIT 1"
          : "SELECT * FROM knowledge WHERE type = 'theme' ORDER BY RANDOM() LIMIT 1";
        const themeResult = await window.electronAPI.database.query(
          themeSql,
          selectedProject ? [selectedProject] : []
        );
        if (themeResult.length > 0) {
          elements.theme = themeResult[0];
        }
      }

      // ランダムにシチュエーションを生成
      const situations = [
        '深夜の図書館で',
        '嵐の中の灯台で',
        '廃墟となった遊園地で',
        '満員電車の中で',
        '雪山の山小屋で',
        '夏祭りの屋台で',
        '病院の屋上で',
        '古い喫茶店で',
        '地下鉄のホームで',
        '学校の音楽室で',
      ];
      elements.situation = situations[Math.floor(Math.random() * situations.length)];

      // ランダムにキーワードを取得
      const keywordSql = selectedProject
        ? "SELECT title FROM knowledge WHERE type IN ('keyword', 'inspiration') AND project_id = ? ORDER BY RANDOM() LIMIT 3"
        : "SELECT title FROM knowledge WHERE type IN ('keyword', 'inspiration') ORDER BY RANDOM() LIMIT 3";
      const keywordResult = await window.electronAPI.database.query(
        keywordSql,
        selectedProject ? [selectedProject] : []
      );
      if (keywordResult.length > 0) {
        elements.keyword = keywordResult.map((k: Record<string, unknown>) => k.title).join('、');
      }

      // ランダムに世界設定を取得
      if (Math.random() > 0.5) {
        const worldSql = selectedProject
          ? "SELECT * FROM knowledge WHERE type = 'world_setting' AND project_id = ? ORDER BY RANDOM() LIMIT 1"
          : "SELECT * FROM knowledge WHERE type = 'world_setting' ORDER BY RANDOM() LIMIT 1";
        const worldResult = await window.electronAPI.database.query(
          worldSql,
          selectedProject ? [selectedProject] : []
        );
        if (worldResult.length > 0) {
          elements.worldSetting = worldResult[0];
        }
      }

      return elements;
    } catch (error) {
      console.error('Failed to get random elements:', error);
      return elements;
    }
  };

  const generateIdea = async (elements: GachaResult['elements']) => {
    let prompt = 'この要素から短い物語のアイデアを生成してください：\n\n';

    if (elements.character) {
      prompt += `キャラクター: ${elements.character.name} - ${elements.character.profile}\n`;
    }
    if (elements.theme) {
      prompt += `テーマ: ${elements.theme.title}\n`;
    }
    if (elements.situation) {
      prompt += `シチュエーション: ${elements.situation}\n`;
    }
    if (elements.keyword) {
      prompt += `キーワード: ${elements.keyword}\n`;
    }
    if (elements.worldSetting) {
      prompt += `世界設定: ${elements.worldSetting.title} - ${elements.worldSetting.content}\n`;
    }

    prompt += '\n50文字程度で、魅力的な物語のアイデアを一文で表現してください。';

    try {
      const response = await window.electronAPI.ai.chat([
        { role: 'system', content: 'あなたは創造的な物語作家です。' },
        { role: 'user', content: prompt },
      ]);
      return response;
    } catch (error) {
      console.error('Failed to generate idea:', error);
      return '謎めいた出会いが、運命を変える物語';
    }
  };

  const spinGacha = async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setAnimationStep(0);

    // アニメーション演出
    for (let i = 0; i < 10; i++) {
      setAnimationStep(i);
      await new Promise((resolve) => setTimeout(resolve, 100 + i * 20));
    }

    const elements = await getRandomElements();
    const idea = await generateIdea(elements);

    const result: GachaResult = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      elements,
      generatedIdea: idea,
      saved: false,
    };

    setCurrentResult(result);
    setIsSpinning(false);

    // 履歴に追加
    const newHistory = {
      ...history,
      results: [result, ...history.results].slice(0, 50), // 最大50件
    };
    saveHistory(newHistory);
  };

  const toggleFavorite = (resultId: string) => {
    const newFavorites = history.favorites.includes(resultId)
      ? history.favorites.filter((id) => id !== resultId)
      : [...history.favorites, resultId];

    saveHistory({ ...history, favorites: newFavorites });
  };

  const saveAsKnowledge = async (result: GachaResult) => {
    try {
      const knowledge = {
        title: `アイデア: ${result.generatedIdea.slice(0, 30)}...`,
        content: result.generatedIdea,
        type: 'idea',
        projectId: selectedProject || null,
        metadata: {
          gachaElements: result.elements,
          generatedAt: result.timestamp,
        },
      };

      await window.electronAPI.knowledge.save(knowledge);

      // 保存済みフラグを更新
      const updatedResults = history.results.map((r) =>
        r.id === result.id ? { ...r, saved: true } : r
      );
      saveHistory({ ...history, results: updatedResults });

      alert('アイデアを保存しました！');
    } catch (error) {
      console.error('Failed to save idea:', error);
      alert('保存に失敗しました');
    }
  };

  const renderGachaResult = (result: GachaResult, isMain: boolean = false) => {
    const isFavorite = history.favorites.includes(result.id);

    return (
      <div
        className={`bg-white rounded-lg shadow-md p-6 ${
          isMain ? 'transform scale-105' : ''
        } transition-all`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <p className="text-lg font-medium text-gray-800 leading-relaxed">
              {result.generatedIdea}
            </p>
            <div className="text-xs text-gray-500 mt-2">
              {formatDistanceToNow(new Date(result.timestamp), {
                addSuffix: true,
                locale: ja,
              })}
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => toggleFavorite(result.id)}
              className={`p-2 rounded transition-colors ${
                isFavorite
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-gray-400 hover:text-gray-500'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
            {!result.saved && (
              <button
                onClick={() => saveAsKnowledge(result)}
                className="p-2 text-primary-600 hover:text-primary-700 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {result.elements.character && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">キャラ:</span>
              <span className="text-gray-700">{result.elements.character.name}</span>
            </div>
          )}
          {result.elements.theme && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">テーマ:</span>
              <span className="text-gray-700">{result.elements.theme.title}</span>
            </div>
          )}
          {result.elements.situation && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">場所:</span>
              <span className="text-gray-700">{result.elements.situation}</span>
            </div>
          )}
          {result.elements.keyword && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500">キーワード:</span>
              <span className="text-gray-700">{result.elements.keyword}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8 mb-6">
        <h2 className="text-2xl font-bold text-center mb-8">アイディアガチャ</h2>

        {/* 設定エリア */}
        <div className="flex justify-center gap-4 mb-8">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">全プロジェクト</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            value={gachaMode}
            onChange={(e) => setGachaMode(e.target.value as 'random' | 'themed' | 'character')}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="random">完全ランダム</option>
            <option value="themed">テーマ重視</option>
            <option value="character">キャラクター重視</option>
          </select>
        </div>

        {/* ガチャマシン */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div
              className={`w-64 h-64 bg-gradient-to-br from-primary-400 to-secondary-600 rounded-full flex items-center justify-center shadow-2xl transform transition-all duration-500 ${
                isSpinning ? 'animate-spin' : ''
              }`}
            >
              <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center">
                <span className="text-6xl">
                  {isSpinning ? '?' : '💡'}
                </span>
              </div>
            </div>
            
            {/* アニメーション用のパーティクル */}
            {isSpinning && (
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-4 h-4 bg-yellow-400 rounded-full animate-ping"
                    style={{
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-100px)`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={spinGacha}
            disabled={isSpinning}
            className={`mt-8 px-8 py-4 text-xl font-bold rounded-full shadow-lg transform transition-all ${
              isSpinning
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:scale-105 hover:shadow-xl'
            }`}
          >
            {isSpinning ? '回転中...' : 'ガチャを回す！'}
          </button>
        </div>

        {/* 結果表示 */}
        {currentResult && !isSpinning && (
          <div className="mt-8 animate-fadeIn">
            {renderGachaResult(currentResult, true)}
          </div>
        )}
      </div>

      {/* 履歴 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">履歴</h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {showHistory ? '隠す' : '表示'}
          </button>
        </div>

        {showHistory && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {history.results.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                まだガチャを回していません
              </p>
            ) : (
              history.results.map((result) => (
                <div key={result.id}>
                  {renderGachaResult(result)}
                </div>
              ))
            )}
          </div>
        )}

        {/* お気に入り */}
        {history.favorites.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-3">⭐ お気に入り</h4>
            <div className="space-y-3">
              {history.results
                .filter((r) => history.favorites.includes(r.id))
                .map((result) => (
                  <div key={result.id}>
                    {renderGachaResult(result)}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}