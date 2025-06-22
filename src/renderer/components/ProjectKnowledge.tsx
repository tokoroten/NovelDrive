import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface Character {
  id: string;
  projectId: string;
  name: string;
  profile: string;
  personality: string;
  speechStyle: string;
  background: string;
  dialogueSamples: string;
  createdAt: string;
  updatedAt: string;
}

interface WorldSetting {
  id: string;
  projectId: string;
  category: string;
  name: string;
  description: string;
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Term {
  id: string;
  projectId: string;
  term: string;
  reading: string;
  category: string;
  definition: string;
  usage: string;
  createdAt: string;
  updatedAt: string;
}

type KnowledgeType = 'characters' | 'worldSettings' | 'terms';

export function ProjectKnowledge() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [activeTab, setActiveTab] = useState<KnowledgeType>('characters');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worldSettings, setWorldSettings] = useState<WorldSetting[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedItem, setSelectedItem] = useState<Character | WorldSetting | Term | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 初期データの読み込み
  useEffect(() => {
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // プロジェクト選択時にデータを読み込み
  useEffect(() => {
    if (selectedProject) {
      loadProjectData();
    }
  }, [selectedProject, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    try {
      const sql = 'SELECT * FROM projects ORDER BY updated_at DESC';
      const result = await window.electronAPI.database.query(sql);
      setProjects(result.map((p: Record<string, unknown>) => ({
        ...p,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })));
      
      if (result.length > 0 && !selectedProject) {
        setSelectedProject(result[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadProjectData = async () => {
    if (!selectedProject) return;

    try {
      switch (activeTab) {
        case 'characters':
          await loadCharacters();
          break;
        case 'worldSettings':
          await loadWorldSettings();
          break;
        case 'terms':
          await loadTerms();
          break;
      }
    } catch (error) {
      console.error('Failed to load project data:', error);
    }
  };

  const loadCharacters = async () => {
    const sql = 'SELECT * FROM characters WHERE project_id = ? ORDER BY name';
    const result = await window.electronAPI.database.query(sql, [selectedProject]);
    setCharacters(result.map((c: Record<string, unknown>) => ({
      ...c,
      projectId: c.project_id,
      speechStyle: c.speech_style,
      dialogueSamples: c.dialogue_samples,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })));
  };

  const loadWorldSettings = async () => {
    const sql = `
      SELECT id, project_id, category, name, description, details, created_at, updated_at
      FROM knowledge
      WHERE project_id = ? AND type = 'world_setting'
      ORDER BY category, name
    `;
    const result = await window.electronAPI.database.query(sql, [selectedProject]);
    setWorldSettings(result.map((w: Record<string, unknown>) => ({
      ...w,
      projectId: w.project_id,
      details: JSON.parse(w.details || '{}'),
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    })));
  };

  const loadTerms = async () => {
    const sql = `
      SELECT * FROM knowledge
      WHERE project_id = ? AND type = 'term'
      ORDER BY term
    `;
    const result = await window.electronAPI.database.query(sql, [selectedProject]);
    
    setTerms(result.map((t: Record<string, unknown>) => {
      const metadata = JSON.parse(t.metadata || '{}');
      return {
        id: t.id,
        projectId: t.project_id,
        term: t.title,
        reading: metadata.reading || '',
        category: metadata.category || '一般',
        definition: t.content,
        usage: metadata.usage || '',
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    }));
  };

  const handleCreateCharacter = async (data: Partial<Character>) => {
    try {
      const sql = `
        INSERT INTO characters (id, project_id, name, profile, personality, speech_style, background, dialogue_samples)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const id = Date.now().toString();
      await window.electronAPI.database.execute(sql, [
        id,
        selectedProject,
        data.name || '',
        data.profile || '',
        data.personality || '',
        data.speechStyle || '',
        data.background || '',
        data.dialogueSamples || '',
      ]);
      
      await loadCharacters();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create character:', error);
    }
  };

  const handleUpdateCharacter = async (id: string, updates: Partial<Character>) => {
    try {
      const sql = `
        UPDATE characters
        SET name = ?, profile = ?, personality = ?, speech_style = ?, 
            background = ?, dialogue_samples = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      await window.electronAPI.database.execute(sql, [
        updates.name || '',
        updates.profile || '',
        updates.personality || '',
        updates.speechStyle || '',
        updates.background || '',
        updates.dialogueSamples || '',
        id,
      ]);
      
      await loadCharacters();
      setIsEditing(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to update character:', error);
    }
  };

  // Removed unused functions: handleCreateWorldSetting and handleCreateTerm
  // These can be re-implemented when needed

  // Commented out for future implementation
  // const _handleCreateTerm = async (_data: Partial<Term>) => {
  //   try {
  //     const knowledge = {
  //       title: _data.term,
  //       content: _data.definition,
  //       type: 'term',
  //       projectId: selectedProject,
  //       metadata: {
  //         reading: _data.reading,
  //         category: _data.category || '一般',
  //         usage: _data.usage,
  //       },
  //     };
  //     
  //     await window.electronAPI.knowledge.save(knowledge);
  //     await loadTerms();
  //     setShowCreateModal(false);
  //   } catch (error) {
  //     console.error('Failed to create term:', error);
  //   }
  // };

  const filteredItems = () => {
    const query = searchQuery.toLowerCase();
    
    switch (activeTab) {
      case 'characters':
        return characters.filter(c => 
          c.name.toLowerCase().includes(query) ||
          c.profile.toLowerCase().includes(query)
        );
      case 'worldSettings':
        return worldSettings.filter(w =>
          w.name.toLowerCase().includes(query) ||
          w.description.toLowerCase().includes(query) ||
          w.category.toLowerCase().includes(query)
        );
      case 'terms':
        return terms.filter(t =>
          t.term.toLowerCase().includes(query) ||
          t.definition.toLowerCase().includes(query) ||
          t.reading.toLowerCase().includes(query)
        );
      default:
        return [];
    }
  };

  const renderCharacterForm = (character?: Character) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
        <input
          type="text"
          defaultValue={character?.name}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          id="character-name"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">プロフィール</label>
        <textarea
          defaultValue={character?.profile}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          id="character-profile"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">性格</label>
        <textarea
          defaultValue={character?.personality}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          id="character-personality"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">話し方の特徴</label>
        <textarea
          defaultValue={character?.speechStyle}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          id="character-speechStyle"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">背景・経歴</label>
        <textarea
          defaultValue={character?.background}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          id="character-background"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">セリフサンプル</label>
        <textarea
          defaultValue={character?.dialogueSamples}
          rows={3}
          placeholder="「こんにちは」「ありがとう」など、キャラクターらしいセリフの例"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          id="character-dialogueSamples"
        />
      </div>
    </div>
  );

  const renderCharacterCard = (character: Character) => (
    <div
      key={character.id}
      onClick={() => setSelectedItem(character)}
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <h4 className="font-semibold text-lg mb-2">{character.name}</h4>
      <p className="text-gray-600 text-sm line-clamp-2 mb-2">{character.profile}</p>
      <div className="text-xs text-gray-500">
        更新: {formatDistanceToNow(new Date(character.updatedAt), { addSuffix: true, locale: ja })}
      </div>
    </div>
  );

  const renderWorldSettingCard = (setting: WorldSetting) => (
    <div
      key={setting.id}
      onClick={() => setSelectedItem(setting)}
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-1 bg-secondary-100 text-secondary-700 rounded text-xs">
          {setting.category}
        </span>
        <h4 className="font-semibold">{setting.name}</h4>
      </div>
      <p className="text-gray-600 text-sm line-clamp-2">{setting.description}</p>
    </div>
  );

  const renderTermCard = (term: Term) => (
    <div
      key={term.id}
      onClick={() => setSelectedItem(term)}
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
    >
      <div className="flex items-baseline gap-2 mb-1">
        <h4 className="font-semibold">{term.term}</h4>
        {term.reading && (
          <span className="text-sm text-gray-500">（{term.reading}）</span>
        )}
      </div>
      <p className="text-gray-600 text-sm line-clamp-2">{term.definition}</p>
      <div className="mt-2 text-xs text-gray-500">
        <span className="px-2 py-1 bg-gray-100 rounded">{term.category}</span>
      </div>
    </div>
  );

  return (
    <div className="h-full flex gap-4">
      {/* メインコンテンツ */}
      <div className="flex-1 bg-white rounded-lg shadow-md">
        {/* ヘッダー */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">プロジェクト知識管理</h2>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">プロジェクトを選択</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* タブ */}
          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setActiveTab('characters')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'characters'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              キャラクター
            </button>
            <button
              onClick={() => setActiveTab('worldSettings')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'worldSettings'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              世界設定
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`px-4 py-2 rounded-md transition-colors ${
                activeTab === 'terms'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              用語集
            </button>
          </div>

          {/* 検索バー */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="検索..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedProject}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
            >
              新規作成
            </button>
          </div>
        </div>

        {/* コンテンツグリッド */}
        <div className="p-4 overflow-y-auto h-[calc(100%-200px)]">
          {selectedProject ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems().map((item) => {
                switch (activeTab) {
                  case 'characters':
                    return renderCharacterCard(item as Character);
                  case 'worldSettings':
                    return renderWorldSettingCard(item as WorldSetting);
                  case 'terms':
                    return renderTermCard(item as Term);
                  default:
                    return null;
                }
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-8">
              プロジェクトを選択してください
            </div>
          )}
        </div>
      </div>

      {/* 詳細パネル */}
      {selectedItem && (
        <div className="w-96 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">
              {activeTab === 'characters' && (selectedItem as Character).name}
              {activeTab === 'worldSettings' && (selectedItem as WorldSetting).name}
              {activeTab === 'terms' && (selectedItem as Term).term}
            </h3>
            <div className="flex gap-2">
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                >
                  編集
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setIsEditing(false);
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          </div>

          {isEditing ? (
            <div>
              {activeTab === 'characters' && renderCharacterForm(selectedItem as Character)}
              
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => {
                    if (activeTab === 'characters') {
                      const form = {
                        name: (document.getElementById('character-name') as HTMLInputElement)?.value,
                        profile: (document.getElementById('character-profile') as HTMLTextAreaElement)?.value,
                        personality: (document.getElementById('character-personality') as HTMLTextAreaElement)?.value,
                        speechStyle: (document.getElementById('character-speechStyle') as HTMLTextAreaElement)?.value,
                        background: (document.getElementById('character-background') as HTMLTextAreaElement)?.value,
                        dialogueSamples: (document.getElementById('character-dialogueSamples') as HTMLTextAreaElement)?.value,
                      };
                      handleUpdateCharacter(selectedItem.id, form);
                    }
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  保存
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'characters' && (
                <>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">プロフィール</h4>
                    <p className="text-gray-600">{(selectedItem as Character).profile}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">性格</h4>
                    <p className="text-gray-600">{(selectedItem as Character).personality}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">話し方の特徴</h4>
                    <p className="text-gray-600">{(selectedItem as Character).speechStyle}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">背景・経歴</h4>
                    <p className="text-gray-600">{(selectedItem as Character).background}</p>
                  </div>
                  {(selectedItem as Character).dialogueSamples && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">セリフサンプル</h4>
                      <p className="text-gray-600 whitespace-pre-wrap">
                        {(selectedItem as Character).dialogueSamples}
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {activeTab === 'worldSettings' && (
                <>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">カテゴリ</h4>
                    <p className="text-gray-600">{(selectedItem as WorldSetting).category}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">説明</h4>
                    <p className="text-gray-600">{(selectedItem as WorldSetting).description}</p>
                  </div>
                  {Object.keys((selectedItem as WorldSetting).details || {}).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">詳細</h4>
                      <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify((selectedItem as WorldSetting).details, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
              
              {activeTab === 'terms' && (
                <>
                  {(selectedItem as Term).reading && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">読み方</h4>
                      <p className="text-gray-600">{(selectedItem as Term).reading}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">カテゴリ</h4>
                    <p className="text-gray-600">{(selectedItem as Term).category}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">定義</h4>
                    <p className="text-gray-600">{(selectedItem as Term).definition}</p>
                  </div>
                  {(selectedItem as Term).usage && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-1">用例</h4>
                      <p className="text-gray-600">{(selectedItem as Term).usage}</p>
                    </div>
                  )}
                </>
              )}
              
              <div className="text-xs text-gray-500 pt-4 border-t">
                <div>作成: {formatDistanceToNow(new Date(selectedItem.createdAt), { addSuffix: true, locale: ja })}</div>
                <div>更新: {formatDistanceToNow(new Date(selectedItem.updatedAt), { addSuffix: true, locale: ja })}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {activeTab === 'characters' && '新規キャラクター'}
              {activeTab === 'worldSettings' && '新規世界設定'}
              {activeTab === 'terms' && '新規用語'}
            </h3>
            
            {activeTab === 'characters' && renderCharacterForm()}
            
            <div className="mt-6 flex gap-2 justify-end">
              <button
                onClick={() => {
                  if (activeTab === 'characters') {
                    const form = {
                      name: (document.getElementById('character-name') as HTMLInputElement)?.value,
                      profile: (document.getElementById('character-profile') as HTMLTextAreaElement)?.value,
                      personality: (document.getElementById('character-personality') as HTMLTextAreaElement)?.value,
                      speechStyle: (document.getElementById('character-speechStyle') as HTMLTextAreaElement)?.value,
                      background: (document.getElementById('character-background') as HTMLTextAreaElement)?.value,
                      dialogueSamples: (document.getElementById('character-dialogueSamples') as HTMLTextAreaElement)?.value,
                    };
                    handleCreateCharacter(form);
                  }
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                作成
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}