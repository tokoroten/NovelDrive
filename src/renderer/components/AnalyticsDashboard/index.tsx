/**
 * 分析ダッシュボード（リファクタリング版）
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  WritingStats,
  KnowledgeStats,
  AgentStats,
  APIUsageStats,
  ActivityData,
  ProjectStats,
  Goal,
  TimeRange
} from './types';
import { OverviewTab } from './OverviewTab';
import { ProductivityTab } from './ProductivityTab';
import { CostTab } from './CostTab';
import { GoalsTab } from './GoalsTab';
import { useAnalyticsData } from './hooks/useAnalyticsData';

type TabType = 'overview' | 'productivity' | 'costs' | 'goals';

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // カスタムフックで統計データを取得
  const {
    projects,
    writingStats,
    knowledgeStats,
    agentStats,
    apiUsageStats,
    activityData,
    goals,
    isLoading,
    error,
    refresh
  } = useAnalyticsData(timeRange, selectedProject);

  // エラー処理
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">データの読み込み中にエラーが発生しました: {error.message}</p>
          <button
            onClick={refresh}
            className="mt-2 text-red-600 hover:text-red-700 font-medium"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  // ローディング状態
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">データを読み込んでいます...</p>
        </div>
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
          <OverviewTab
            key="overview"
            writingStats={writingStats}
            knowledgeStats={knowledgeStats}
            agentStats={agentStats}
            apiUsageStats={apiUsageStats}
            activityData={activityData}
          />
        )}
        {activeTab === 'productivity' && (
          <ProductivityTab
            key="productivity"
            writingStats={writingStats}
            activityData={activityData}
          />
        )}
        {activeTab === 'costs' && (
          <CostTab
            key="costs"
            apiUsageStats={apiUsageStats}
          />
        )}
        {activeTab === 'goals' && (
          <GoalsTab
            key="goals"
            goals={goals}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// 互換性のため、既存の名前でもエクスポート
export { AnalyticsDashboard as AnalyticsDashboardEnhanced };