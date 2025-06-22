/**
 * 分析ダッシュボードの型定義
 */

export interface WritingStats {
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

export interface KnowledgeStats {
  totalItems: number;
  itemsByType: Record<string, number>;
  recentItems: number;
  mostUsedTags: Array<{ tag: string; count: number }>;
  growthRate: number;
  topSources: Array<{ source: string; count: number }>;
}

export interface AgentStats {
  totalDiscussions: number;
  totalMessages: number;
  messagesByAgent: Record<string, number>;
  averageMessagesPerDiscussion: number;
  discussionTopics: Array<{ topic: string; count: number }>;
  consensusRate: number;
  averageDiscussionDuration: number;
}

export interface APIUsageStats {
  totalCalls: number;
  costEstimate: number;
  byProvider: Record<string, { calls: number; cost: number }>;
  byType: Record<string, number>;
  errorRate: number;
  averageLatency: number;
}

export interface ActivityData {
  date: string;
  words: number;
  knowledge: number;
  discussions: number;
  apiCalls: number;
  activeHours: number;
}

export interface ProjectStats {
  id: string;
  name: string;
  words: number;
  chapters: number;
  knowledge: number;
  lastActivity: string;
  progress: number;
}

export interface Goal {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  metric: 'words' | 'chapters' | 'knowledge';
  target: number;
  current: number;
  deadline: string;
}

export type TimeRange = 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface DashboardTab {
  id: string;
  label: string;
  icon: React.ReactNode;
}