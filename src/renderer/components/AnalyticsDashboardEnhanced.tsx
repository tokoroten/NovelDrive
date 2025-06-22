import React, { useState, useEffect, useMemo } from 'react';
import { eachDayOfInterval, format, startOfWeek, endOfWeek, eachWeekOfInterval, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

interface WritingStats {
  totalWords: number;
  totalCharacters: number;
  chaptersWritten: number;
  writingSessions: number;
  averageWordsPerSession: number;
  totalWritingTime: number;
  writingStreak: number;
  mostProductiveHour: number;
  averageSessionDuration: number;
}

interface KnowledgeStats {
  totalItems: number;
  itemsByType: Record<string, number>;
  recentItems: number;
  mostUsedTags: Array<{ tag: string; count: number }>;
  growthRate: number;
  topSources: Array<{ source: string; count: number }>;
}

interface AgentStats {
  totalDiscussions: number;
  totalMessages: number;
  messagesByAgent: Record<string, number>;
  averageMessagesPerDiscussion: number;
  discussionTopics: Array<{ topic: string; count: number }>;
  consensusRate: number;
  averageDiscussionDuration: number;
}

interface APIUsageStats {
  totalCalls: number;
  costEstimate: number;
  byProvider: Record<string, { calls: number; cost: number }>;
  byType: Record<string, number>;
  errorRate: number;
  averageLatency: number;
}

interface ActivityData {
  date: string;
  words: number;
  knowledge: number;
  discussions: number;
  apiCalls: number;
  activeHours: number;
}

interface ProjectStats {
  id: string;
  name: string;
  words: number;
  chapters: number;
  knowledge: number;
  lastActivity: string;
  progress: number;
}

interface Goal {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  metric: 'words' | 'chapters' | 'knowledge';
  target: number;
  current: number;
  deadline: string;
}

export function AnalyticsDashboardEnhanced() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('week');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [writingStats, setWritingStats] = useState<WritingStats>({
    totalWords: 0,
    totalCharacters: 0,
    chaptersWritten: 0,
    writingSessions: 0,
    averageWordsPerSession: 0,
    totalWritingTime: 0,
    writingStreak: 0,
    mostProductiveHour: 0,
    averageSessionDuration: 0,
  });
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    totalItems: 0,
    itemsByType: {},
    recentItems: 0,
    mostUsedTags: [],
    growthRate: 0,
    topSources: [],
  });
  const [agentStats, setAgentStats] = useState<AgentStats>({
    totalDiscussions: 0,
    totalMessages: 0,
    messagesByAgent: {},
    averageMessagesPerDiscussion: 0,
    discussionTopics: [],
    consensusRate: 0,
    averageDiscussionDuration: 0,
  });
  const [apiUsageStats, setApiUsageStats] = useState<APIUsageStats>({
    totalCalls: 0,
    costEstimate: 0,
    byProvider: {},
    byType: {},
    errorRate: 0,
    averageLatency: 0,
  });
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'productivity' | 'costs' | 'goals'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, selectedProject]);

  const getTimeFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return `created_at >= datetime('now', '-7 days')`;
      case 'month':
        return `created_at >= datetime('now', '-30 days')`;
      case 'quarter':
        return `created_at >= datetime('now', '-90 days')`;
      case 'year':
        return `created_at >= datetime('now', '-365 days')`;
      default:
        return '1=1';
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadProjects(),
        loadWritingStats(),
        loadKnowledgeStats(),
        loadAgentStats(),
        loadAPIUsageStats(),
        loadActivityData(),
        loadGoals(),
      ]);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const projectList = await window.electronAPI.database.listProjects();
      const projectStats: ProjectStats[] = [];

      for (const project of projectList) {
        const stats = await loadProjectStats(project.id);
        projectStats.push({
          id: project.id,
          name: project.name,
          ...stats,
        });
      }

      setProjects(projectStats);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadProjectStats = async (projectId: string) => {
    const sql = `
      SELECT 
        (SELECT COALESCE(SUM(word_count), 0) FROM chapters WHERE project_id = ?) as words,
        (SELECT COUNT(*) FROM chapters WHERE project_id = ?) as chapters,
        (SELECT COUNT(*) FROM knowledge WHERE project_id = ?) as knowledge,
        (SELECT MAX(created_at) FROM chapters WHERE project_id = ?) as last_activity
    `;
    
    const result = await window.electronAPI.database.query(sql, [projectId, projectId, projectId, projectId]);
    const data = result[0] || { words: 0, chapters: 0, knowledge: 0, last_activity: null };
    
    return {
      words: data.words,
      chapters: data.chapters,
      knowledge: data.knowledge,
      lastActivity: data.last_activity || new Date().toISOString(),
      progress: Math.min(100, (data.chapters / 20) * 100), // 仮に20章を目標として進捗を計算
    };
  };

  const loadWritingStats = async () => {
    const timeFilter = getTimeFilter();
    const projectFilter = selectedProject !== 'all' ? `AND project_id = '${selectedProject}'` : '';
    
    // 執筆統計の詳細を取得
    const writingSql = `
      SELECT 
        COUNT(DISTINCT id) as total_chapters,
        SUM(word_count) as total_words,
        SUM(character_count) as total_characters,
        COUNT(DISTINCT DATE(created_at)) as writing_days,
        AVG(word_count) as avg_words_per_chapter,
        MAX(created_at) as last_writing_date,
        MIN(created_at) as first_writing_date
      FROM chapters
      WHERE ${timeFilter} ${projectFilter}
    `;
    
    const result = await window.electronAPI.database.query(writingSql);
    const data = result[0] || {};

    // 時間帯別の執筆統計（モック）
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      words: Math.floor(Math.random() * 1000),
    }));
    const mostProductiveHour = hourlyStats.reduce((max, curr) => 
      curr.words > max.words ? curr : max, hourlyStats[0]
    ).hour;

    // ストリーク計算（連続執筆日数）
    const writingStreak = await calculateWritingStreak(projectFilter);

    setWritingStats({
      totalWords: data.total_words || 0,
      totalCharacters: data.total_characters || 0,
      chaptersWritten: data.total_chapters || 0,
      writingSessions: data.writing_days || 0,
      averageWordsPerSession: data.writing_days > 0 ? Math.floor(data.total_words / data.writing_days) : 0,
      totalWritingTime: data.writing_days * 120, // 仮に1日2時間として計算
      writingStreak,
      mostProductiveHour,
      averageSessionDuration: 90, // 仮の値（分）
    });
  };

  const calculateWritingStreak = async (projectFilter: string): Promise<number> => {
    const sql = `
      SELECT DISTINCT DATE(created_at) as writing_date
      FROM chapters
      WHERE created_at >= datetime('now', '-30 days') ${projectFilter}
      ORDER BY writing_date DESC
    `;
    
    const result = await window.electronAPI.database.query(sql);
    let streak = 0;
    const today = new Date();
    
    for (let i = 0; i < result.length; i++) {
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      const writingDate = new Date(result[i].writing_date);
      
      if (writingDate.toDateString() === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const loadKnowledgeStats = async () => {
    const timeFilter = getTimeFilter();
    const projectFilter = selectedProject !== 'all' ? `AND project_id = '${selectedProject}'` : '';
    
    // 知識統計
    const knowledgeSql = `
      SELECT 
        COUNT(*) as total_items,
        type,
        COUNT(*) as type_count
      FROM knowledge
      WHERE ${timeFilter} ${projectFilter}
      GROUP BY type
    `;
    
    const knowledgeResult = await window.electronAPI.database.query(knowledgeSql);
    
    const itemsByType: Record<string, number> = {};
    let totalItems = 0;
    
    knowledgeResult.forEach((row: { type: string; type_count: number }) => {
      itemsByType[row.type] = row.type_count;
      totalItems += row.type_count;
    });

    // 成長率計算（前期比）
    const previousPeriodSql = `
      SELECT COUNT(*) as prev_count
      FROM knowledge
      WHERE created_at < datetime('now', '-${timeRange === 'week' ? 7 : 30} days')
        AND created_at >= datetime('now', '-${timeRange === 'week' ? 14 : 60} days')
        ${projectFilter}
    `;
    
    const prevResult = await window.electronAPI.database.query(previousPeriodSql);
    const prevCount = prevResult[0]?.prev_count || 1;
    const growthRate = ((totalItems - prevCount) / prevCount) * 100;

    // トップソース（モック）
    const topSources = [
      { source: 'Web検索', count: Math.floor(totalItems * 0.4) },
      { source: 'Anything Box', count: Math.floor(totalItems * 0.3) },
      { source: '手動入力', count: Math.floor(totalItems * 0.2) },
      { source: 'AI生成', count: Math.floor(totalItems * 0.1) },
    ];

    setKnowledgeStats({
      totalItems,
      itemsByType,
      recentItems: Math.floor(totalItems * 0.1),
      mostUsedTags: [],
      growthRate,
      topSources,
    });
  };

  const loadAgentStats = async () => {
    const timeFilter = getTimeFilter();
    const projectFilter = selectedProject !== 'all' ? `AND project_id = '${selectedProject}'` : '';
    
    // エージェント統計（モック強化版）
    const totalDiscussions = Math.floor(Math.random() * 50) + 10;
    const totalMessages = totalDiscussions * (Math.floor(Math.random() * 30) + 10);
    
    const messagesByAgent = {
      'ライターAI': Math.floor(totalMessages * 0.3),
      'エディターAI': Math.floor(totalMessages * 0.25),
      '校正AI': Math.floor(totalMessages * 0.2),
      '副編集長AI': Math.floor(totalMessages * 0.15),
      'ユーザー': Math.floor(totalMessages * 0.1),
    };

    const discussionTopics = [
      { topic: 'プロット改善', count: Math.floor(totalDiscussions * 0.3) },
      { topic: 'キャラクター開発', count: Math.floor(totalDiscussions * 0.25) },
      { topic: '文章校正', count: Math.floor(totalDiscussions * 0.2) },
      { topic: '世界観構築', count: Math.floor(totalDiscussions * 0.15) },
      { topic: 'その他', count: Math.floor(totalDiscussions * 0.1) },
    ];

    setAgentStats({
      totalDiscussions,
      totalMessages,
      messagesByAgent,
      averageMessagesPerDiscussion: Math.floor(totalMessages / totalDiscussions),
      discussionTopics,
      consensusRate: 78.5, // モック値（%）
      averageDiscussionDuration: 25, // モック値（分）
    });
  };

  const loadAPIUsageStats = async () => {
    try {
      // API使用統計を取得
      const apiSql = `
        SELECT 
          COUNT(*) as total_calls,
          SUM(estimatedCost) as total_cost,
          provider,
          apiType,
          COUNT(*) as call_count,
          SUM(estimatedCost) as provider_cost,
          AVG(duration_ms) as avg_latency,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
        FROM api_usage_logs
        WHERE ${getTimeFilter()}
        GROUP BY provider, apiType
      `;
      
      const apiResult = await window.electronAPI.database.query(apiSql);
      
      let totalCalls = 0;
      let totalCost = 0;
      let totalErrors = 0;
      let totalLatency = 0;
      const byProvider: Record<string, { calls: number; cost: number }> = {};
      const byType: Record<string, number> = {};
      
      apiResult.forEach((row: any) => {
        totalCalls += row.call_count || 0;
        totalCost += row.provider_cost || 0;
        totalErrors += row.error_count || 0;
        totalLatency += row.avg_latency || 0;
        
        if (!byProvider[row.provider]) {
          byProvider[row.provider] = { calls: 0, cost: 0 };
        }
        byProvider[row.provider].calls += row.call_count || 0;
        byProvider[row.provider].cost += row.provider_cost || 0;
        
        byType[row.apiType] = (byType[row.apiType] || 0) + (row.call_count || 0);
      });
      
      setApiUsageStats({
        totalCalls,
        costEstimate: totalCost,
        byProvider,
        byType,
        errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
        averageLatency: apiResult.length > 0 ? totalLatency / apiResult.length : 0,
      });
    } catch (error) {
      // APIログテーブルが存在しない場合のモックデータ
      setApiUsageStats({
        totalCalls: 1250,
        costEstimate: 4.85,
        byProvider: {
          openai: { calls: 1000, cost: 4.50 },
          local: { calls: 250, cost: 0.35 },
        },
        byType: {
          chat: 600,
          embedding: 400,
          image: 50,
          assistant: 200,
        },
        errorRate: 2.4,
        averageLatency: 450,
      });
    }
  };

  const loadActivityData = async () => {
    const now = new Date();
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const projectFilter = selectedProject !== 'all' ? `AND project_id = '${selectedProject}'` : '';
    
    const dates = eachDayOfInterval({ start: startDate, end: now });
    const activityData: ActivityData[] = [];

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // その日の各種統計を取得
      const [wordsResult, knowledgeResult, discussionResult] = await Promise.all([
        window.electronAPI.database.query(`
          SELECT COALESCE(SUM(word_count), 0) as words
          FROM chapters
          WHERE DATE(created_at) = DATE('${dateStr}') ${projectFilter}
        `),
        window.electronAPI.database.query(`
          SELECT COUNT(*) as knowledge
          FROM knowledge
          WHERE DATE(created_at) = DATE('${dateStr}') ${projectFilter}
        `),
        window.electronAPI.database.query(`
          SELECT COUNT(*) as discussions
          FROM agent_discussions
          WHERE DATE(created_at) = DATE('${dateStr}') ${projectFilter}
        `),
      ]);
      
      activityData.push({
        date: dateStr,
        words: wordsResult[0]?.words || 0,
        knowledge: knowledgeResult[0]?.knowledge || 0,
        discussions: discussionResult[0]?.discussions || 0,
        apiCalls: Math.floor(Math.random() * 50), // モック
        activeHours: Math.floor(Math.random() * 8) + 1, // モック
      });
    }
    
    setActivityData(activityData);
  };

  const loadGoals = async () => {
    // 目標データ（モック）
    const mockGoals: Goal[] = [
      {
        id: '1',
        type: 'daily',
        metric: 'words',
        target: 1000,
        current: writingStats.totalWords / Math.max(activityData.length, 1),
        deadline: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'weekly',
        metric: 'chapters',
        target: 3,
        current: writingStats.chaptersWritten,
        deadline: endOfWeek(new Date()).toISOString(),
      },
      {
        id: '3',
        type: 'monthly',
        metric: 'knowledge',
        target: 100,
        current: knowledgeStats.totalItems,
        deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
      },
    ];
    
    setGoals(mockGoals);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

  const renderProductivityMetrics = () => {
    const weeklyData = activityData.slice(-7);
    const dailyAverage = weeklyData.reduce((sum, day) => sum + day.words, 0) / 7;
    const peakDay = weeklyData.reduce((max, day) => day.words > max.words ? day : max, weeklyData[0]);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 執筆習慣分析 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">執筆習慣分析</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">現在のストリーク</span>
              <span className="text-2xl font-bold text-green-600">{writingStats.writingStreak}日</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">最も生産的な時間帯</span>
              <span className="text-lg font-semibold">{writingStats.mostProductiveHour}:00-{writingStats.mostProductiveHour + 1}:00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">平均セッション時間</span>
              <span className="text-lg font-semibold">{formatTime(writingStats.averageSessionDuration)}</span>
            </div>
          </div>
        </div>

        {/* 週間ヒートマップ */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">執筆ヒートマップ</h3>
          <div className="grid grid-cols-7 gap-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
              <div key={day} className="text-center">
                <div className="text-xs text-gray-600 mb-1">{day}</div>
                <div className="grid grid-rows-4 gap-1">
                  {[0, 6, 12, 18].map(hour => {
                    const intensity = Math.random();
                    return (
                      <div
                        key={hour}
                        className="w-full h-4 rounded"
                        style={{
                          backgroundColor: `rgba(99, 102, 241, ${intensity})`,
                        }}
                        title={`${hour}:00-${hour + 6}:00`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-100 rounded" />
              <span>低活動</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-400 rounded" />
              <span>中活動</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-indigo-700 rounded" />
              <span>高活動</span>
            </div>
          </div>
        </div>

        {/* パフォーマンストレンド */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-3">
          <h3 className="text-lg font-semibold mb-4">パフォーマンストレンド</h3>
          <div className="h-48">
            <svg viewBox="0 0 400 150" className="w-full h-full">
              <polyline
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="2"
                points={activityData.map((day, i) => 
                  `${(i / activityData.length) * 380 + 10},${140 - (day.words / Math.max(...activityData.map(d => d.words))) * 130}`
                ).join(' ')}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              {activityData.map((day, i) => (
                <circle
                  key={i}
                  cx={(i / activityData.length) * 380 + 10}
                  cy={140 - (day.words / Math.max(...activityData.map(d => d.words))) * 130}
                  r="3"
                  fill="#4f46e5"
                />
              ))}
            </svg>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{Math.round(dailyAverage)}</div>
              <div className="text-gray-600">日平均語数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {peakDay ? format(parseISO(peakDay.date), 'M/d', { locale: ja }) : '-'}
              </div>
              <div className="text-gray-600">最高記録日</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((writingStats.totalWords / Math.max(writingStats.totalWritingTime, 1)) * 60)}
              </div>
              <div className="text-gray-600">語/時間</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCostAnalysis = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API使用状況 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">API使用状況</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-600">総API呼び出し</span>
              <span className="text-xl font-bold">{apiUsageStats.totalCalls.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-600">推定コスト</span>
              <span className="text-xl font-bold text-green-600">${apiUsageStats.costEstimate.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-600">エラー率</span>
              <span className={`text-xl font-bold ${apiUsageStats.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                {apiUsageStats.errorRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">平均レイテンシ</span>
              <span className="text-xl font-bold">{Math.round(apiUsageStats.averageLatency)}ms</span>
            </div>
          </div>
        </div>

        {/* プロバイダー別コスト */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">プロバイダー別コスト</h3>
          <div className="space-y-3">
            {Object.entries(apiUsageStats.byProvider).map(([provider, stats]) => {
              const percentage = (stats.cost / apiUsageStats.costEstimate) * 100;
              return (
                <div key={provider}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 capitalize">{provider}</span>
                    <span className="text-gray-600">
                      ${stats.cost.toFixed(2)} ({stats.calls}回)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* APIタイプ別使用状況 */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">APIタイプ別使用状況</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(apiUsageStats.byType).map(([type, count]) => (
              <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl mb-2">
                  {type === 'chat' ? '💬' : type === 'embedding' ? '🔢' : type === 'image' ? '🖼️' : '🤖'}
                </div>
                <div className="text-lg font-bold">{count.toLocaleString()}</div>
                <div className="text-sm text-gray-600 capitalize">{type}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderGoals = () => {
    return (
      <div className="space-y-6">
        {/* 目標達成状況 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">目標達成状況</h3>
          <div className="space-y-4">
            {goals.map((goal) => {
              const progress = Math.min(100, (goal.current / goal.target) * 100);
              const isAchieved = progress >= 100;
              
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium px-2 py-1 rounded ${
                        goal.type === 'daily' ? 'bg-blue-100 text-blue-700' :
                        goal.type === 'weekly' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {goal.type === 'daily' ? '日次' : goal.type === 'weekly' ? '週次' : '月次'}
                      </span>
                      <span className="font-medium">
                        {goal.metric === 'words' ? '執筆語数' :
                         goal.metric === 'chapters' ? '章の完成' :
                         '知識の収集'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${isAchieved ? 'text-green-600' : ''}`}>
                        {Math.round(goal.current).toLocaleString()}
                      </span>
                      <span className="text-gray-600"> / {goal.target.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-3 rounded-full ${
                          isAchieved ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'
                        }`}
                      />
                    </div>
                    {isAchieved && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute right-0 top-1/2 transform -translate-y-1/2 text-green-600"
                      >
                        ✓
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 推奨アクション */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">推奨アクション</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">📝</span>
                </div>
                <div>
                  <h4 className="font-medium">執筆時間を増やす</h4>
                  <p className="text-sm text-gray-600">
                    現在の平均より30分多く執筆すると、月間目標を達成できます
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🎯</span>
                </div>
                <div>
                  <h4 className="font-medium">朝の執筆を試す</h4>
                  <p className="text-sm text-gray-600">
                    統計によると、朝の時間帯の生産性が高い傾向があります
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">分析データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">分析ダッシュボード</h2>
            <p className="text-gray-600 mt-1">創作活動の詳細な分析とインサイト</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* プロジェクト選択 */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">すべてのプロジェクト</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            
            {/* 期間選択 */}
            <div className="flex gap-1 bg-gray-100 rounded-md p-1">
              {(['week', 'month', 'quarter', 'year', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded transition-colors ${
                    timeRange === range
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {range === 'week' ? '週' :
                   range === 'month' ? '月' :
                   range === 'quarter' ? '四半期' :
                   range === 'year' ? '年' : '全期間'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* タブ */}
        <div className="flex gap-4 mt-6 border-b">
          {(['overview', 'productivity', 'costs', 'goals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-primary-600 border-primary-600'
                  : 'text-gray-600 border-transparent hover:text-gray-800'
              }`}
            >
              {tab === 'overview' ? '概要' :
               tab === 'productivity' ? '生産性' :
               tab === 'costs' ? 'コスト' : '目標'}
            </button>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* 統計カード（既存のコードを使用） */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* 執筆統計 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">執筆統計</h3>
                  <div className="text-3xl">📝</div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {writingStats.totalWords.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">総単語数</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">章数:</span>
                    <span className="font-semibold">{writingStats.chaptersWritten}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">ストリーク:</span>
                    <span className="font-semibold text-green-600">{writingStats.writingStreak}日</span>
                  </div>
                </div>
              </div>

              {/* 知識統計 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">知識ベース</h3>
                  <div className="text-3xl">📚</div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {knowledgeStats.totalItems.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">総アイテム数</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">成長率:</span>
                    <span className={`font-semibold ${knowledgeStats.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {knowledgeStats.growthRate >= 0 ? '+' : ''}{knowledgeStats.growthRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">新規:</span>
                    <span className="font-semibold">{knowledgeStats.recentItems}</span>
                  </div>
                </div>
              </div>

              {/* AI協調統計 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">AI協調</h3>
                  <div className="text-3xl">🤝</div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {agentStats.totalDiscussions}
                    </div>
                    <div className="text-sm text-gray-600">議論セッション</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">合意率:</span>
                    <span className="font-semibold">{agentStats.consensusRate}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">平均時間:</span>
                    <span className="font-semibold">{agentStats.averageDiscussionDuration}分</span>
                  </div>
                </div>
              </div>

              {/* コスト統計 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-700">APIコスト</h3>
                  <div className="text-3xl">💰</div>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      ${apiUsageStats.costEstimate.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">推定コスト</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">呼び出し:</span>
                    <span className="font-semibold">{apiUsageStats.totalCalls.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">エラー率:</span>
                    <span className={`font-semibold ${apiUsageStats.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                      {apiUsageStats.errorRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* プロジェクト別統計 */}
            {selectedProject === 'all' && projects.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">プロジェクト別統計</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">プロジェクト</th>
                        <th className="text-right py-2 px-4">語数</th>
                        <th className="text-right py-2 px-4">章数</th>
                        <th className="text-right py-2 px-4">知識</th>
                        <th className="text-right py-2 px-4">進捗</th>
                        <th className="text-right py-2 px-4">最終更新</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project) => (
                        <tr key={project.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-4 font-medium">{project.name}</td>
                          <td className="text-right py-2 px-4">{project.words.toLocaleString()}</td>
                          <td className="text-right py-2 px-4">{project.chapters}</td>
                          <td className="text-right py-2 px-4">{project.knowledge}</td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{Math.round(project.progress)}%</span>
                            </div>
                          </td>
                          <td className="text-right py-2 px-4 text-sm text-gray-600">
                            {format(parseISO(project.lastActivity), 'M/d', { locale: ja })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'productivity' && (
          <motion.div
            key="productivity"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderProductivityMetrics()}
          </motion.div>
        )}

        {activeTab === 'costs' && (
          <motion.div
            key="costs"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderCostAnalysis()}
          </motion.div>
        )}

        {activeTab === 'goals' && (
          <motion.div
            key="goals"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderGoals()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}