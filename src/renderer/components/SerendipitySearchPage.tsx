import React, { useState, useEffect } from 'react';
import { SerendipitySearchEnhanced } from './SerendipitySearchEnhanced';

interface Project {
  id: string;
  name: string;
}

export function SerendipitySearchPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [savedResults, setSavedResults] = useState<any[]>([]);

  useEffect(() => {
    loadProjects();
    loadSavedResults();
  }, []);

  const loadProjects = async () => {
    try {
      const projectList = await window.electronAPI.database.listProjects();
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadSavedResults = () => {
    const saved = localStorage.getItem('serendipitySavedResults');
    if (saved) {
      setSavedResults(JSON.parse(saved));
    }
  };

  const handleResultSelect = (result: any) => {
    // 結果を保存済みリストに追加
    const newSaved = [result, ...savedResults.filter(r => r.id !== result.id)].slice(0, 20);
    setSavedResults(newSaved);
    localStorage.setItem('serendipitySavedResults', JSON.stringify(newSaved));

    // ナレッジベースに追加するかユーザーに確認
    if (confirm('この結果を知識ベースに保存しますか？')) {
      saveToKnowledgeBase(result);
    }
  };

  const saveToKnowledgeBase = async (result: any) => {
    try {
      await window.electronAPI.database.createKnowledge({
        title: `セレンディピティ発見: ${result.title}`,
        content: result.content,
        type: 'serendipity_discovery',
        project_id: selectedProjectId || null,
        metadata: JSON.stringify({
          originalId: result.id,
          originalType: result.type,
          discoveryMethod: 'serendipity_search',
          serendipityFactors: result.serendipityFactors,
          discoveryDate: new Date().toISOString(),
        }),
      });
      
      alert('知識ベースに保存されました！');
    } catch (error) {
      console.error('Failed to save to knowledge base:', error);
      alert('保存に失敗しました');
    }
  };

  const clearSavedResults = () => {
    if (confirm('保存済みの結果をすべて削除しますか？')) {
      setSavedResults([]);
      localStorage.removeItem('serendipitySavedResults');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-secondary-800 mb-2">セレンディピティ検索</h2>
        <p className="text-secondary-600">
          偶然の発見を促進する高度な検索システム。予期しない知識の関連性を発見します。
        </p>
      </div>

      {/* プロジェクト選択 */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          検索対象プロジェクト（任意）
        </label>
        <div className="flex items-center gap-4">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">すべてのプロジェクト</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <div className="text-sm text-gray-600">
            プロジェクトを選択すると、そのプロジェクト内の知識を優先的に検索します
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* メインの検索インターフェース */}
        <div className="col-span-2">
          <SerendipitySearchEnhanced
            projectId={selectedProjectId || undefined}
            onResultSelect={handleResultSelect}
          />
        </div>

        {/* 保存済み結果のサイドバー */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">保存済み発見</h3>
            {savedResults.length > 0 && (
              <button
                onClick={clearSavedResults}
                className="text-xs text-red-600 hover:text-red-800"
              >
                すべて削除
              </button>
            )}
          </div>

          {savedResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔍</div>
              <div className="text-sm">
                セレンディピティ検索で<br />
                発見した結果がここに<br />
                表示されます
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {savedResults.map((result, index) => (
                <div
                  key={`${result.id}-${index}`}
                  className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    // 詳細を表示するかアクションを実行
                    console.log('Viewing saved result:', result);
                  }}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {result.content}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      {Math.round(result.score * 100)}%
                    </span>
                    {result.serendipityFactors && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                        偶然性: {Math.round(result.serendipityFactors.contextualSurprise * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 統計情報 */}
          {savedResults.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">発見統計</h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>総発見数:</span>
                  <span>{savedResults.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>平均関連度:</span>
                  <span>
                    {Math.round((savedResults.reduce((sum, r) => sum + r.score, 0) / savedResults.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>平均偶然性:</span>
                  <span>
                    {Math.round(
                      (savedResults.reduce((sum, r) => sum + (r.serendipityFactors?.contextualSurprise || 0), 0) / savedResults.length) * 100
                    )}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 使用方法のヘルプ */}
      <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">セレンディピティ検索の使い方</h3>
        <div className="grid grid-cols-2 gap-6 text-sm text-gray-700">
          <div>
            <h4 className="font-medium mb-2">🎯 基本的な使い方</h4>
            <ul className="space-y-1 text-xs">
              <li>• キーワードを入力して検索を実行</li>
              <li>• セレンディピティレベルで偶然性を調整</li>
              <li>• 3つの表示モード（リスト・バブル・星座）を切り替え</li>
              <li>• 興味深い結果をクリックして詳細を確認</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">🔬 高度な機能</h4>
            <ul className="space-y-1 text-xs">
              <li>• 検索モードで探索の方向性を変更</li>
              <li>• セレンディピティ要因の可視化</li>
              <li>• 発見した知識の自動保存</li>
              <li>• 検索履歴からの再実行</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}