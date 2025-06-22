/**
 * コスト分析タブコンポーネント
 */

import React from 'react';
import { motion } from 'framer-motion';
import { APIUsageStats } from './types';

interface CostTabProps {
  apiUsageStats: APIUsageStats;
}

export function CostTab({ apiUsageStats }: CostTabProps) {
  const costByProvider = Object.entries(apiUsageStats.byProvider);
  const costByType = Object.entries(apiUsageStats.byType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API使用状況サマリー */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">API使用状況</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-800">
                  {apiUsageStats.totalCalls.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 mt-1">総API呼び出し</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-primary-600">
                  ¥{apiUsageStats.costEstimate.toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 mt-1">推定コスト</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">エラー率</span>
                <span className={`font-semibold ${apiUsageStats.errorRate < 5 ? 'text-green-600' : 'text-red-600'}`}>
                  {apiUsageStats.errorRate.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">平均レイテンシ</span>
                <span className="font-semibold">{apiUsageStats.averageLatency.toFixed(0)}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* プロバイダー別コスト */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">プロバイダー別コスト</h3>
          <div className="space-y-3">
            {costByProvider.map(([provider, data]) => {
              const percentage = apiUsageStats.costEstimate > 0
                ? (data.cost / apiUsageStats.costEstimate * 100).toFixed(1)
                : 0;
              return (
                <div key={provider} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{provider}</span>
                    <span className="text-sm text-gray-600">
                      ¥{data.cost.toFixed(0)} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    {data.calls.toLocaleString()} 呼び出し
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* APIタイプ別使用状況 */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">APIタイプ別使用状況</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {costByType.map(([type, calls]) => {
              const percentage = apiUsageStats.totalCalls > 0
                ? (calls / apiUsageStats.totalCalls * 100).toFixed(1)
                : 0;
              return (
                <div key={type} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{type}</span>
                    <span className="text-2xl">
                      {type === 'chat' ? '💬' :
                       type === 'embedding' ? '🔍' :
                       type === 'image' ? '🖼️' : '🤖'}
                    </span>
                  </div>
                  <div className="text-xl font-bold">{calls.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">{percentage}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* コスト推移グラフ */}
        <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">日別コスト推移</h3>
          <div className="h-48 flex items-end justify-between gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const height = Math.random() * 100;
              const cost = Math.floor(Math.random() * 100 + 50);
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t transition-all duration-300 hover:opacity-80"
                    style={{ height: `${height}%` }}
                    title={`¥${cost}`}
                  />
                  <div className="text-xs text-gray-600 mt-2">
                    {i === 0 ? '月' : i === 1 ? '火' : i === 2 ? '水' : 
                     i === 3 ? '木' : i === 4 ? '金' : i === 5 ? '土' : '日'}
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