/**
 * 分析データ取得用カスタムフック
 */

import { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import {
  WritingStats,
  KnowledgeStats,
  AgentStats,
  APIUsageStats,
  ActivityData,
  ProjectStats,
  Goal,
  TimeRange
} from '../types';

interface UseAnalyticsDataReturn {
  projects: ProjectStats[];
  writingStats: WritingStats;
  knowledgeStats: KnowledgeStats;
  agentStats: AgentStats;
  apiUsageStats: APIUsageStats;
  activityData: ActivityData[];
  goals: Goal[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useAnalyticsData(
  timeRange: TimeRange,
  selectedProject: string
): UseAnalyticsDataReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // 各種統計データの状態
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

  // 時間フィルターの生成
  const getTimeFilter = useCallback(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        return '1=1'; // すべてのデータ
      default:
        startDate = startOfWeek(now);
    }

    return `created_at >= '${format(startDate, 'yyyy-MM-dd')}'`;
  }, [timeRange]);

  // データ読み込み関数
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // プロジェクト一覧の取得
      await loadProjects();
      
      // 各種統計データの読み込み
      await Promise.all([
        loadWritingStats(),
        loadKnowledgeStats(),
        loadAgentStats(),
        loadAPIUsageStats(),
        loadActivityData(),
        loadGoals()
      ]);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load analytics data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, selectedProject]);

  // プロジェクト一覧の読み込み
  const loadProjects = async () => {
    // モックデータ（実際の実装ではAPIを呼び出す）
    const mockProjects: ProjectStats[] = [
      {
        id: '1',
        name: 'ファンタジー小説',
        words: 45000,
        chapters: 12,
        knowledge: 234,
        lastActivity: new Date().toISOString(),
        progress: 65
      },
      {
        id: '2',
        name: 'SF短編集',
        words: 23000,
        chapters: 8,
        knowledge: 156,
        lastActivity: new Date().toISOString(),
        progress: 40
      }
    ];
    setProjects(mockProjects);
  };

  // 執筆統計の読み込み
  const loadWritingStats = async () => {
    // 実際の実装ではデータベースクエリを実行
    const mockStats: WritingStats = {
      totalWords: 68000,
      totalCharacters: 102000,
      chaptersWritten: 20,
      writingSessions: 45,
      averageWordsPerSession: 1511,
      totalWritingTime: 5400, // 分
      writingStreak: 7,
      mostProductiveHour: 21,
      averageSessionDuration: 120,
    };
    setWritingStats(mockStats);
  };

  // 知識統計の読み込み
  const loadKnowledgeStats = async () => {
    const mockStats: KnowledgeStats = {
      totalItems: 390,
      itemsByType: {
        note: 156,
        article: 89,
        social: 78,
        inspiration: 67
      },
      recentItems: 23,
      mostUsedTags: [
        { tag: 'キャラクター', count: 45 },
        { tag: '世界観', count: 38 },
        { tag: 'プロット', count: 32 }
      ],
      growthRate: 12.5,
      topSources: [
        { source: 'Web', count: 156 },
        { source: 'Note', count: 123 },
        { source: 'Social', count: 78 }
      ]
    };
    setKnowledgeStats(mockStats);
  };

  // エージェント統計の読み込み
  const loadAgentStats = async () => {
    const mockStats: AgentStats = {
      totalDiscussions: 34,
      totalMessages: 289,
      messagesByAgent: {
        'Writer AI': 98,
        'Editor AI': 87,
        'Proofreader AI': 65,
        'Deputy Editor AI': 39
      },
      averageMessagesPerDiscussion: 8.5,
      discussionTopics: [
        { topic: 'プロット改善', count: 12 },
        { topic: 'キャラクター開発', count: 10 },
        { topic: '文体調整', count: 8 }
      ],
      consensusRate: 78,
      averageDiscussionDuration: 25
    };
    setAgentStats(mockStats);
  };

  // API使用統計の読み込み
  const loadAPIUsageStats = async () => {
    const mockStats: APIUsageStats = {
      totalCalls: 1234,
      costEstimate: 890,
      byProvider: {
        'OpenAI': { calls: 890, cost: 678 },
        'Local Model': { calls: 344, cost: 212 }
      },
      byType: {
        'chat': 567,
        'embedding': 445,
        'image': 123,
        'assistant': 99
      },
      errorRate: 2.3,
      averageLatency: 234
    };
    setApiUsageStats(mockStats);
  };

  // アクティビティデータの読み込み
  const loadActivityData = async () => {
    const days = 7;
    const mockData: ActivityData[] = Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - i - 1);
      return {
        date: format(date, 'MM/dd'),
        words: Math.floor(Math.random() * 2000 + 500),
        knowledge: Math.floor(Math.random() * 20 + 5),
        discussions: Math.floor(Math.random() * 5),
        apiCalls: Math.floor(Math.random() * 50 + 10),
        activeHours: Math.floor(Math.random() * 6 + 1)
      };
    });
    setActivityData(mockData);
  };

  // 目標の読み込み
  const loadGoals = async () => {
    const mockGoals: Goal[] = [
      {
        id: '1',
        type: 'daily',
        metric: 'words',
        target: 1000,
        current: 750,
        deadline: format(new Date(), 'yyyy-MM-dd')
      },
      {
        id: '2',
        type: 'weekly',
        metric: 'chapters',
        target: 3,
        current: 2,
        deadline: format(endOfWeek(new Date()), 'yyyy-MM-dd')
      },
      {
        id: '3',
        type: 'monthly',
        metric: 'knowledge',
        target: 100,
        current: 67,
        deadline: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd')
      }
    ];
    setGoals(mockGoals);
  };

  // 初回読み込みと依存関係の変更時に再読み込み
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    projects,
    writingStats,
    knowledgeStats,
    agentStats,
    apiUsageStats,
    activityData,
    goals,
    isLoading,
    error,
    refresh: loadData
  };
}