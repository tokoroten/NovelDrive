import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ProjectCreationProps {
  onClose: () => void;
  onProjectCreated: (projectId: string) => void;
}

interface ProjectFormData {
  name: string;
  description: string;
  genre: string;
  targetLength: number;
  writingStyle?: string;
  themes: string[];
  settings: {
    worldType: string;
    timePeriod: string;
    location: string;
  };
  aiSettings: {
    creativity: 'low' | 'medium' | 'high';
    autonomous24h: boolean;
    generatePlotOnCreate: boolean;
  };
}

export function ProjectCreation({ onClose, onProjectCreated }: ProjectCreationProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    genre: '',
    targetLength: 100000,
    themes: [],
    settings: {
      worldType: 'contemporary',
      timePeriod: 'present',
      location: '',
    },
    aiSettings: {
      creativity: 'medium',
      autonomous24h: false,
      generatePlotOnCreate: false,
    },
  });

  const genres = [
    'ファンタジー',
    'SF',
    'ミステリー',
    'ロマンス',
    '青春',
    'ホラー',
    'サスペンス',
    '歴史',
    '現代文学',
    'ライトノベル',
  ];

  const targetLengths = [
    { value: 50000, label: '短編（5万字）' },
    { value: 100000, label: '中編（10万字）' },
    { value: 200000, label: '長編（20万字）' },
    { value: 400000, label: '大長編（40万字）' },
  ];

  const worldTypes = [
    { value: 'contemporary', label: '現代' },
    { value: 'fantasy', label: 'ファンタジー世界' },
    { value: 'scifi', label: 'SF世界' },
    { value: 'historical', label: '歴史' },
    { value: 'alternate', label: '異世界' },
  ];

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    
    try {
      const projectId = uuidv4();
      
      // プロジェクトをデータベースに保存
      await window.electronAPI.database.createProject({
        id: projectId,
        name: formData.name,
        description: formData.description,
        metadata: {
          genre: formData.genre,
          targetLength: formData.targetLength,
          writingStyle: formData.writingStyle,
          themes: formData.themes,
          settings: formData.settings,
          aiSettings: formData.aiSettings,
        },
        status: 'active',
      });

      // プロット生成が有効な場合
      if (formData.aiSettings.generatePlotOnCreate) {
        // プロット生成ワークフローを開始
        await window.electronAPI.plotGen.start({
          projectId,
          topic: formData.description,
          genre: formData.genre,
          themes: formData.themes,
          settings: formData.settings,
        });
      }

      // 24時間自律モードが有効な場合
      if (formData.aiSettings.autonomous24h) {
        await window.electronAPI.autonomous.updateConfig({
          enabled: true,
          projectId,
        });
      }

      onProjectCreated(projectId);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('プロジェクトの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">基本情報</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          プロジェクト名 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="例: 星を継ぐもの"
          data-testid="project-title-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          作品の概要 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 h-32"
          placeholder="どんな物語を書きたいか、簡単に説明してください"
          data-testid="project-description-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ジャンル <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2" data-testid="genre-select">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setFormData({ ...formData, genre })}
              className={`px-3 py-2 border rounded-md transition-colors ${
                formData.genre === genre
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              data-testid={`genre-option-${genre}`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          目標文字数
        </label>
        <div className="grid grid-cols-2 gap-2" data-testid="length-select">
          {targetLengths.map((length) => (
            <button
              key={length.value}
              onClick={() => setFormData({ ...formData, targetLength: length.value })}
              className={`px-3 py-2 border rounded-md transition-colors ${
                formData.targetLength === length.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              data-testid={`length-option-${length.value}`}
            >
              {length.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">作品設定</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          世界観
        </label>
        <select
          value={formData.settings.worldType}
          onChange={(e) => setFormData({
            ...formData,
            settings: { ...formData.settings, worldType: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {worldTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          舞台・場所
        </label>
        <input
          type="text"
          value={formData.settings.location}
          onChange={(e) => setFormData({
            ...formData,
            settings: { ...formData.settings, location: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="例: 東京、架空の王国、宇宙ステーション"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          文体・作風（オプション）
        </label>
        <input
          type="text"
          value={formData.writingStyle || ''}
          onChange={(e) => setFormData({ ...formData, writingStyle: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="例: 村上春樹風、ライトノベル風、純文学風"
          data-testid="writing-style-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          テーマ・モチーフ
        </label>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Enterキーで追加"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                setFormData({
                  ...formData,
                  themes: [...formData.themes, e.currentTarget.value.trim()]
                });
                e.currentTarget.value = '';
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex flex-wrap gap-2">
            {formData.themes.map((theme, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm flex items-center gap-2"
              >
                {theme}
                <button
                  onClick={() => setFormData({
                    ...formData,
                    themes: formData.themes.filter((_, i) => i !== index)
                  })}
                  className="text-primary-500 hover:text-primary-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">AI設定</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-4">
          AIの創造性レベル
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              value="low"
              checked={formData.aiSettings.creativity === 'low'}
              onChange={(e) => setFormData({
                ...formData,
                aiSettings: { ...formData.aiSettings, creativity: 'low' }
              })}
              className="text-primary-600"
            />
            <div>
              <div className="font-medium">控えめ</div>
              <div className="text-sm text-gray-600">安定した、予測可能な展開を重視</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              value="medium"
              checked={formData.aiSettings.creativity === 'medium'}
              onChange={(e) => setFormData({
                ...formData,
                aiSettings: { ...formData.aiSettings, creativity: 'medium' }
              })}
              className="text-primary-600"
            />
            <div>
              <div className="font-medium">標準</div>
              <div className="text-sm text-gray-600">バランスの取れた創造性</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              value="high"
              checked={formData.aiSettings.creativity === 'high'}
              onChange={(e) => setFormData({
                ...formData,
                aiSettings: { ...formData.aiSettings, creativity: 'high' }
              })}
              className="text-primary-600"
              data-testid="ai-creativity-high"
            />
            <div>
              <div className="font-medium">高い</div>
              <div className="text-sm text-gray-600">予想外の展開や実験的なアイデアを歓迎</div>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.aiSettings.generatePlotOnCreate}
            onChange={(e) => setFormData({
              ...formData,
              aiSettings: { ...formData.aiSettings, generatePlotOnCreate: e.target.checked }
            })}
            className="w-5 h-5 text-primary-600 rounded"
            data-testid="generate-plot-on-create"
          />
          <div>
            <div className="font-medium">プロジェクト作成時にプロットを生成</div>
            <div className="text-sm text-gray-600">AIエージェントが即座にプロット作成を開始します</div>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.aiSettings.autonomous24h}
            onChange={(e) => setFormData({
              ...formData,
              aiSettings: { ...formData.aiSettings, autonomous24h: e.target.checked }
            })}
            className="w-5 h-5 text-primary-600 rounded"
            data-testid="enable-24h-mode"
          />
          <div>
            <div className="font-medium">24時間自律モード</div>
            <div className="text-sm text-gray-600">AIが自律的に執筆を進め、品質の高い部分のみを保存します</div>
          </div>
        </label>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">確認</h3>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div>
          <span className="font-medium text-gray-700">プロジェクト名:</span>
          <span className="ml-2">{formData.name}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">ジャンル:</span>
          <span className="ml-2">{formData.genre}</span>
        </div>
        <div>
          <span className="font-medium text-gray-700">目標文字数:</span>
          <span className="ml-2">{formData.targetLength.toLocaleString()}字</span>
        </div>
        {formData.writingStyle && (
          <div>
            <span className="font-medium text-gray-700">文体:</span>
            <span className="ml-2">{formData.writingStyle}</span>
          </div>
        )}
        {formData.themes.length > 0 && (
          <div>
            <span className="font-medium text-gray-700">テーマ:</span>
            <span className="ml-2">{formData.themes.join('、')}</span>
          </div>
        )}
        <div>
          <span className="font-medium text-gray-700">AI創造性:</span>
          <span className="ml-2">
            {formData.aiSettings.creativity === 'low' ? '控えめ' :
             formData.aiSettings.creativity === 'medium' ? '標準' : '高い'}
          </span>
        </div>
        {formData.aiSettings.generatePlotOnCreate && (
          <div className="text-primary-600">✓ プロット自動生成</div>
        )}
        {formData.aiSettings.autonomous24h && (
          <div className="text-primary-600">✓ 24時間自律モード</div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          プロジェクトを作成すると、AIエージェントたちがあなたの設定に基づいて
          創作活動を開始します。いつでも介入して方向性を調整できます。
        </p>
      </div>
    </div>
  );

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.name.trim() && formData.description.trim() && formData.genre;
      case 2:
        return true; // Step 2 is always valid
      case 3:
        return true; // Step 3 is always valid
      case 4:
        return true; // Step 4 is always valid
      default:
        return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden" data-testid="project-creation-form">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">新規プロジェクト作成</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              data-testid="cancel-project-creation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center mt-6">
            {[1, 2, 3, 4].map((step) => (
              <React.Fragment key={step}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                    step <= currentStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
                {step < 4 && (
                  <div
                    className={`w-20 h-1 ${
                      step < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`px-6 py-2 rounded-md ${
              currentStep === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            戻る
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            
            {currentStep < 4 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className={`px-6 py-2 rounded-md ${
                  isStepValid()
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                次へ
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isCreating || !isStepValid()}
                className={`px-6 py-2 rounded-md ${
                  isCreating || !isStepValid()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
                data-testid="create-project-submit"
              >
                {isCreating ? '作成中...' : 'プロジェクトを作成'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}