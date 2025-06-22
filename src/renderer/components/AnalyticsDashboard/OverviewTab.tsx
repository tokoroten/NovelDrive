/**
 * 概要タブコンポーネント
 */

import React from 'react';
import { motion } from 'framer-motion';
import { WritingStats, KnowledgeStats, AgentStats, APIUsageStats, ActivityData } from './types';
import { StatCard } from './StatCard';
import { ActivityChart } from './ActivityChart';

interface OverviewTabProps {
  writingStats: WritingStats;
  knowledgeStats: KnowledgeStats;
  agentStats: AgentStats;
  apiUsageStats: APIUsageStats;
  activityData: ActivityData[];
}

export function OverviewTab({
  writingStats,
  knowledgeStats,
  agentStats,
  apiUsageStats,
  activityData
}: OverviewTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* 統計カード */}
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

        {/* APIコスト統計 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">APIコスト</h3>
            <div className="text-3xl">💰</div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-2xl font-bold text-gray-800">
                ¥{apiUsageStats.costEstimate.toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">推定コスト</div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">API呼び出し:</span>
              <span className="font-semibold">{apiUsageStats.totalCalls.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">エラー率:</span>
              <span className={`font-semibold ${apiUsageStats.errorRate < 5 ? 'text-green-600' : 'text-red-600'}`}>
                {apiUsageStats.errorRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* アクティビティグラフ */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">活動推移</h3>
        <ActivityChart data={activityData} />
      </div>

      {/* プロジェクト別統計 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* タイプ別知識分布 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">知識タイプ分布</h3>
          <div className="space-y-3">
            {Object.entries(knowledgeStats.itemsByType).map(([type, count]) => {
              const percentage = knowledgeStats.totalItems > 0 
                ? (count / knowledgeStats.totalItems * 100).toFixed(1)
                : 0;
              return (
                <div key={type} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium capitalize">{type}</span>
                      <span className="text-sm text-gray-600">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* エージェント別メッセージ数 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">エージェント活動</h3>
          <div className="space-y-3">
            {Object.entries(agentStats.messagesByAgent).map(([agent, messages]) => {
              const percentage = agentStats.totalMessages > 0 
                ? (messages / agentStats.totalMessages * 100).toFixed(1)
                : 0;
              return (
                <div key={agent} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{agent}</span>
                      <span className="text-sm text-gray-600">{messages} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}