import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { performanceMonitor } from '../utils/performance';
import { ProjectCreation } from './ProjectCreation';

interface DashboardStats {
  totalKnowledge: number;
  recentKnowledge: number;
  totalChapters: number;
  totalWords: number;
  activeProjects: number;
  recentDiscussions: number;
}

interface RecentActivity {
  id: string;
  type: 'knowledge' | 'chapter' | 'discussion' | 'plot';
  title: string;
  description: string;
  timestamp: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalKnowledge: 0,
    recentKnowledge: 0,
    totalChapters: 0,
    totalWords: 0,
    activeProjects: 0,
    recentDiscussions: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [inspirationOfTheDay, setInspirationOfTheDay] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [showProjectCreation, setShowProjectCreation] = useState(false);

  useEffect(() => {
    // Debug: Check if electronAPI is available
    console.log('window.electronAPI:', window.electronAPI);
    console.log('window.electronAPI.database:', window.electronAPI?.database);
    
    loadDashboardData();
    generateInspirationOfTheDay();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      await performanceMonitor.measureAsync('Dashboard Data Load', async () => {
        await Promise.all([
          loadStats(),
          loadRecentActivities(),
        ]);
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStats = async () => {
    try {
      // Check if database API is available
      if (!window.electronAPI?.database?.query) {
        console.warn('Database API not available, using default values');
        setStats({
          totalKnowledge: 0,
          recentKnowledge: 0,
          totalChapters: 0,
          totalWords: 0,
          activeProjects: 0,
          recentDiscussions: 0,
        });
        return;
      }

      // 知識統計
      const knowledgeCountSql = 'SELECT COUNT(*) as total FROM knowledge';
      const recentKnowledgeSql = "SELECT COUNT(*) as recent FROM knowledge WHERE created_at >= datetime('now', '-24 hours')";
      
      // チャプター統計
      const chapterStatsSql = 'SELECT COUNT(*) as total_chapters, COALESCE(SUM(word_count), 0) as total_words FROM chapters';
      
      // プロジェクト統計
      const projectCountSql = "SELECT COUNT(*) as total FROM projects WHERE status = 'active'";
      
      // 議論統計
      const recentDiscussionsSql = "SELECT COUNT(*) as recent FROM agent_discussions WHERE created_at >= datetime('now', '-7 days')";

      const [knowledgeCount, recentKnowledge, chapterStats, projectCount, recentDiscussions] = await Promise.all([
        window.electronAPI.database.query(knowledgeCountSql),
        window.electronAPI.database.query(recentKnowledgeSql),
        window.electronAPI.database.query(chapterStatsSql),
        window.electronAPI.database.query(projectCountSql),
        window.electronAPI.database.query(recentDiscussionsSql),
      ]);

      setStats({
        totalKnowledge: knowledgeCount[0]?.total || 0,
        recentKnowledge: recentKnowledge[0]?.recent || 0,
        totalChapters: chapterStats[0]?.total_chapters || 0,
        totalWords: chapterStats[0]?.total_words || 0,
        activeProjects: projectCount[0]?.total || 0,
        recentDiscussions: recentDiscussions[0]?.recent || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Set default values on error
      setStats({
        totalKnowledge: 0,
        recentKnowledge: 0,
        totalChapters: 0,
        totalWords: 0,
        activeProjects: 0,
        recentDiscussions: 0,
      });
    }
  };

  const loadRecentActivities = async () => {
    try {
      // Check if database API is available
      if (!window.electronAPI?.database?.query) {
        console.warn('Database API not available for recent activities');
        setRecentActivities([]);
        return;
      }

      const activities: RecentActivity[] = [];

      // 最近の知識
      const recentKnowledgeSql = `
        SELECT id, title, content, type, created_at
        FROM knowledge
        ORDER BY created_at DESC
        LIMIT 3
      `;
      const knowledgeResults = await window.electronAPI.database.query(recentKnowledgeSql);
      
      knowledgeResults.forEach((item: any) => {
        activities.push({
          id: item.id as string,
          type: 'knowledge',
          title: item.title as string,
          description: (item.content as string).substring(0, 100) + '...',
          timestamp: item.created_at as string,
        });
      });

      // 最近のチャプター
      const recentChaptersSql = `
        SELECT id, title, word_count, created_at
        FROM chapters
        ORDER BY created_at DESC
        LIMIT 2
      `;
      const chapterResults = await window.electronAPI.database.query(recentChaptersSql);
      
      chapterResults.forEach((item: any) => {
        activities.push({
          id: item.id as string,
          type: 'chapter',
          title: item.title as string,
          description: `${item.word_count || 0}語の章を作成`,
          timestamp: item.created_at as string,
        });
      });

      // タイムスタンプでソート
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setRecentActivities(activities.slice(0, 5));
    } catch (error) {
      console.error('Failed to load recent activities:', error);
    }
  };

  const generateInspirationOfTheDay = async () => {
    try {
      // Check if database API is available
      if (!window.electronAPI?.database?.query) {
        console.warn('Database API not available for inspiration');
        setInspirationOfTheDay('今日も素晴らしい物語を書きましょう！');
        return;
      }

      // ランダムな知識を取得
      const randomKnowledgeSql = `
        SELECT title, content, type
        FROM knowledge
        WHERE type IN ('inspiration', 'theme', 'idea')
        ORDER BY RANDOM()
        LIMIT 1
      `;
      const result = await window.electronAPI.database.query(randomKnowledgeSql);
      
      if (result.length > 0) {
        const item = result[0];
        // Content or title, whichever is more suitable
        const inspiration = item.content && item.content.length > 10 ? item.content : item.title;
        setInspirationOfTheDay(inspiration);
      } else {
        // デフォルトのインスピレーション
        const defaultInspirations = [
          '今日も素晴らしい物語を紡ぎましょう',
          '予期せぬ出会いが、新しい物語を生む',
          '小さなアイデアが、大きな冒険の始まり',
          'キャラクターの声に耳を傾けてみよう',
          '今日はどんな世界を創造しますか？',
          'セレンディピティが新たな物語を紡ぐ',
          '想像力は無限の可能性を秘めている',
        ];
        setInspirationOfTheDay(
          defaultInspirations[Math.floor(Math.random() * defaultInspirations.length)]
        );
      }
    } catch (error) {
      console.error('Failed to generate inspiration:', error);
      setInspirationOfTheDay('創造性は無限の可能性を秘めている');
    }
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'knowledge':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'chapter':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
      case 'discussion':
        return (
          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
        );
      case 'plot':
        return (
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">ダッシュボードを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6" data-testid="dashboard">
      {/* プロジェクト作成モーダル */}
      {showProjectCreation && (
        <ProjectCreation
          onClose={() => setShowProjectCreation(false)}
          onProjectCreated={(projectId) => {
            setShowProjectCreation(false);
            // プロジェクト詳細画面に遷移
            const event = new CustomEvent('navigate', { detail: { screen: 'plot-management', projectId } });
            window.dispatchEvent(event);
          }}
        />
      )}

      {/* ウェルカムセクション */}
      <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-4" data-testid="dashboard-title">NovelDriveへようこそ</h1>
        <p className="text-lg mb-6">
          今日も素晴らしい物語を創造しましょう。セレンディピティがあなたを待っています。
        </p>
        <div className="bg-white bg-opacity-20 rounded-lg p-4">
          <h3 className="font-semibold mb-2">💡 今日のインスピレーション</h3>
          <p className="italic">{inspirationOfTheDay}</p>
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">知識ベース</h3>
            <span className="text-3xl">📚</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {stats.totalKnowledge.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            総アイテム数（本日 +{stats.recentKnowledge}）
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">執筆進捗</h3>
            <span className="text-3xl">✍️</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {stats.totalWords.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            総単語数（{stats.totalChapters}章）
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">プロジェクト</h3>
            <span className="text-3xl">🎯</span>
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {stats.activeProjects}
          </div>
          <div className="text-sm text-gray-600">
            アクティブなプロジェクト
          </div>
        </div>
      </div>

      {/* クイックアクション */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              const event = new CustomEvent('navigate', { detail: { screen: 'anything-box' } });
              window.dispatchEvent(event);
            }}
            className="p-4 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors text-center"
          >
            <div className="text-3xl mb-2">📥</div>
            <div className="font-medium text-primary-700">Anything Box</div>
            <div className="text-xs text-gray-600 mt-1">アイデアを投入</div>
          </button>

          <button
            onClick={() => {
              const event = new CustomEvent('navigate', { detail: { screen: 'writing-editor' } });
              window.dispatchEvent(event);
            }}
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-center"
          >
            <div className="text-3xl mb-2">📝</div>
            <div className="font-medium text-green-700">執筆開始</div>
            <div className="text-xs text-gray-600 mt-1">新しい章を書く</div>
          </button>

          <button
            onClick={() => {
              const event = new CustomEvent('navigate', { detail: { screen: 'idea-gacha' } });
              window.dispatchEvent(event);
            }}
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-center"
          >
            <div className="text-3xl mb-2">🎲</div>
            <div className="font-medium text-purple-700">アイデアガチャ</div>
            <div className="text-xs text-gray-600 mt-1">インスピレーション</div>
          </button>

          <button
            onClick={() => {
              const event = new CustomEvent('navigate', { detail: { screen: 'agent-meeting' } });
              window.dispatchEvent(event);
            }}
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-center"
          >
            <div className="text-3xl mb-2">🤝</div>
            <div className="font-medium text-orange-700">AI会議</div>
            <div className="text-xs text-gray-600 mt-1">プロット議論</div>
          </button>
        </div>
      </div>

      {/* 最近のアクティビティ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6" data-testid="recent-inspirations">
          <h2 className="text-xl font-semibold mb-4">最近のアクティビティ</h2>
          <div className="space-y-3">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-1">{getActivityIcon(activity.type)}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{activity.title}</h4>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), {
                      addSuffix: true,
                      locale: ja,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6" data-testid="recent-projects">
          <h2 className="text-xl font-semibold mb-4">プロジェクト</h2>
          <button 
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 mb-4"
            data-testid="create-project-button"
            onClick={() => setShowProjectCreation(true)}
          >
            新規プロジェクト作成
          </button>
          <p className="text-sm text-gray-600 text-center">クリックして新しい小説プロジェクトを作成しましょう</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">AIエージェント活動</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-lg">🤖</span>
                </div>
                <div>
                  <div className="font-medium">最近の議論</div>
                  <div className="text-sm text-gray-600">
                    過去7日間で{stats.recentDiscussions}回の議論
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="text-sm text-gray-600 mb-2">エージェント別活動</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>ライターAI</span>
                  <span className="text-gray-500">活発</span>
                </div>
                <div className="flex justify-between">
                  <span>エディターAI</span>
                  <span className="text-gray-500">通常</span>
                </div>
                <div className="flex justify-between">
                  <span>校正AI</span>
                  <span className="text-gray-500">待機</span>
                </div>
                <div className="flex justify-between">
                  <span>副編集長AI</span>
                  <span className="text-gray-500">通常</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ヒントセクション */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-2">💡 ヒント</h3>
        <p className="text-blue-700">
          セレンディピティ検索を使うと、思いがけない組み合わせから新しいアイデアが生まれます。
          知識グラフで情報の繋がりを視覚的に探索してみましょう。
        </p>
      </div>
    </div>
  );
}