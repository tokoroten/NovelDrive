/**
 * 生産性タブコンポーネント
 */

import React from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { WritingStats, ActivityData } from './types';
import { WritingHeatmap } from './WritingHeatmap';

interface ProductivityTabProps {
  writingStats: WritingStats;
  activityData: ActivityData[];
}

export function ProductivityTab({ writingStats, activityData }: ProductivityTabProps) {
  const dailyAverage = activityData.length > 0
    ? activityData.reduce((sum, day) => sum + day.words, 0) / activityData.length
    : 0;

  const peakDay = activityData.reduce(
    (max, day) => day.words > max.words ? day : max,
    activityData[0] || { words: 0, date: '' }
  );

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
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
              <span className="text-lg font-semibold">
                {writingStats.mostProductiveHour}:00-{writingStats.mostProductiveHour + 1}:00
              </span>
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
          <WritingHeatmap />
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
                {peakDay && peakDay.date ? format(parseISO(peakDay.date), 'M/d', { locale: ja }) : '-'}
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
    </motion.div>
  );
}