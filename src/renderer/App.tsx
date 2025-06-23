import React, { useState, lazy, Suspense } from 'react';
import { Dashboard } from './components/Dashboard';

// 遅延読み込みコンポーネント
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const AnythingBox = lazy(() => import('./components/AnythingBox').then(m => ({ default: m.AnythingBox })));
const AgentMeetingRoom = lazy(() => import('./components/AgentMeetingRoom').then(m => ({ default: m.AgentMeetingRoom })));
const PlotManagement = lazy(() => import('./components/PlotManagement').then(m => ({ default: m.PlotManagement })));
const KnowledgeGraph = lazy(() => import('./components/KnowledgeGraph').then(m => ({ default: m.KnowledgeGraph })));
const WritingEditor = lazy(() => import('./components/WritingEditorEnhanced').then(m => ({ default: m.WritingEditorEnhanced })));
const ProjectKnowledge = lazy(() => import('./components/ProjectKnowledge').then(m => ({ default: m.ProjectKnowledge })));
const IdeaGacha = lazy(() => import('./components/IdeaGacha').then(m => ({ default: m.IdeaGacha })));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const AutonomousMode = lazy(() => import('./components/AutonomousMode').then(m => ({ default: m.AutonomousMode })));
const BackupRestore = lazy(() => import('./components/BackupRestore').then(m => ({ default: m.BackupRestore })));
const VersionHistory = lazy(() => import('./components/VersionHistory').then(m => ({ default: m.VersionHistory })));
const PlotBranchingManagement = lazy(() => import('./components/PlotBranchingManagement').then(m => ({ default: m.PlotBranchingManagement })));
const SerendipitySearchPage = lazy(() => import('./components/SerendipitySearchPage').then(m => ({ default: m.SerendipitySearchPage })));
const CharacterRelationshipDiagram = lazy(() => import('./components/CharacterRelationshipDiagram').then(m => ({ default: m.CharacterRelationshipDiagram })));

// ローディングコンポーネント
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

export function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'settings':
        return <Settings />;
      case 'anything-box':
        return <AnythingBox />;
      case 'agent-meeting':
        return <AgentMeetingRoom />;
      case 'plot-management':
        return <PlotManagement />;
      case 'knowledge-graph':
        return <KnowledgeGraph />;
      case 'writing-editor':
        return <WritingEditor />;
      case 'project-knowledge':
        return <ProjectKnowledge />;
      case 'idea-gacha':
        return <IdeaGacha />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'autonomous-mode':
        return <AutonomousMode />;
      case 'backup-restore':
        return <BackupRestore />;
      case 'version-history':
        return <VersionHistory />;
      case 'plot-branching':
        return <PlotBranchingManagement />;
      case 'serendipity-search':
        return <SerendipitySearchPage />;
      case 'character-relationships':
        return <CharacterRelationshipDiagram />;
      default:
        return (
          <div>
            <h2 className="text-3xl font-bold text-secondary-800 mb-5">
              {getViewTitle(currentView)}
            </h2>
            <p className="text-secondary-600">このビューは現在開発中です。</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <nav className="w-64 bg-secondary-900 text-white p-5 overflow-y-auto" data-testid="nav-menu">
        <h1 className="text-2xl font-bold text-center mb-8">NovelDrive</h1>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'dashboard' ? 'bg-secondary-800' : ''
              }`}
              data-testid="nav-dashboard"
            >
              ダッシュボード
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('anything-box')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'anything-box' ? 'bg-secondary-800' : ''
              }`}
              data-testid="nav-anything-box"
            >
              Anything Box
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('knowledge-graph')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'knowledge-graph' ? 'bg-secondary-800' : ''
              }`}
              data-testid="nav-knowledge-graph"
            >
              知識グラフ
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('plot-management')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'plot-management' ? 'bg-secondary-800' : ''
              }`}
            >
              プロット管理
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('plot-branching')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'plot-branching' ? 'bg-secondary-800' : ''
              }`}
            >
              プロット分岐管理
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('agent-meeting')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'agent-meeting' ? 'bg-secondary-800' : ''
              }`}
            >
              エージェント会議室
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('writing-editor')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'writing-editor' ? 'bg-secondary-800' : ''
              }`}
            >
              執筆エディタ
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('project-knowledge')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'project-knowledge' ? 'bg-secondary-800' : ''
              }`}
            >
              プロジェクト知識
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('idea-gacha')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'idea-gacha' ? 'bg-secondary-800' : ''
              }`}
            >
              アイディアガチャ
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('serendipity-search')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'serendipity-search' ? 'bg-secondary-800' : ''
              }`}
            >
              セレンディピティ検索
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('character-relationships')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'character-relationships' ? 'bg-secondary-800' : ''
              }`}
            >
              キャラクター関係図
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('analytics')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'analytics' ? 'bg-secondary-800' : ''
              }`}
            >
              分析ダッシュボード
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('autonomous-mode')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'autonomous-mode' ? 'bg-secondary-800' : ''
              }`}
            >
              24時間自律モード
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('backup-restore')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'backup-restore' ? 'bg-secondary-800' : ''
              }`}
            >
              バックアップ・リストア
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('version-history')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'version-history' ? 'bg-secondary-800' : ''
              }`}
            >
              バージョン履歴
            </button>
          </li>
          <li>
            <button
              onClick={() => setCurrentView('settings')}
              className={`w-full px-4 py-3 text-left rounded transition-colors hover:bg-secondary-800 ${
                currentView === 'settings' ? 'bg-secondary-800' : ''
              }`}
            >
              設定
            </button>
          </li>
        </ul>
      </nav>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <Suspense fallback={<LoadingSpinner />}>
            {renderView()}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

function getViewTitle(view: string): string {
  const titles: Record<string, string> = {
    dashboard: 'ダッシュボード',
    'anything-box': 'Anything Box',
    'knowledge-graph': '知識グラフ',
    'plot-management': 'プロット管理',
    'plot-branching': 'プロット分岐管理',
    'serendipity-search': 'セレンディピティ検索',
    'character-relationships': 'キャラクター関係図',
    'agent-meeting': 'エージェント会議室',
    'writing-editor': '執筆エディタ',
    'project-knowledge': 'プロジェクト知識',
    'idea-gacha': 'アイディアガチャ',
    analytics: '分析ダッシュボード',
    'autonomous-mode': '24時間自律モード',
    'backup-restore': 'バックアップ・リストア',
    'version-history': 'バージョン履歴',
    settings: '設定',
  };
  return titles[view] || view;
}
