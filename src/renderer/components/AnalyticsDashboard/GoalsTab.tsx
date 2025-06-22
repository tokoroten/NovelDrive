/**
 * 目標管理タブコンポーネント
 */

import React from 'react';
import { motion } from 'framer-motion';
import { parseISO, differenceInDays } from 'date-fns';
import { Goal } from './types';

interface GoalsTabProps {
  goals: Goal[];
  onGoalUpdate?: (goalId: string, newTarget: number) => void;
}

export function GoalsTab({ goals, onGoalUpdate }: GoalsTabProps) {
  const getGoalProgress = (goal: Goal) => {
    const progress = Math.min((goal.current / goal.target) * 100, 100);
    return progress;
  };

  const getGoalStatus = (goal: Goal) => {
    const progress = getGoalProgress(goal);
    const daysLeft = differenceInDays(parseISO(goal.deadline), new Date());

    if (progress >= 100) return { text: '達成！', color: 'text-green-600' };
    if (daysLeft < 0) return { text: '期限切れ', color: 'text-red-600' };
    if (daysLeft <= 3) return { text: `あと${daysLeft}日`, color: 'text-amber-600' };
    return { text: `あと${daysLeft}日`, color: 'text-gray-600' };
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 70) return 'bg-blue-500';
    if (progress >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getGoalIcon = (metric: string) => {
    switch (metric) {
      case 'words': return '✍️';
      case 'chapters': return '📄';
      case 'knowledge': return '💡';
      default: return '🎯';
    }
  };

  const getRecommendations = (goal: Goal) => {
    const progress = getGoalProgress(goal);
    const daysLeft = differenceInDays(parseISO(goal.deadline), new Date());
    const dailyTarget = daysLeft > 0 ? Math.ceil((goal.target - goal.current) / daysLeft) : 0;

    if (progress >= 100) {
      return '素晴らしい！目標を達成しました。新しい目標を設定しましょう。';
    }
    if (daysLeft <= 0) {
      return '期限が過ぎています。目標を見直して再設定することをお勧めします。';
    }
    if (goal.metric === 'words') {
      return `目標達成まで1日あたり${dailyTarget}語の執筆が必要です。`;
    }
    if (goal.metric === 'chapters') {
      return `残り${goal.target - goal.current}章を${daysLeft}日で完成させる必要があります。`;
    }
    return `1日あたり${dailyTarget}個の${goal.metric === 'knowledge' ? '知識アイテム' : 'アイテム'}を追加しましょう。`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="space-y-6">
        {/* 目標達成状況 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const progress = getGoalProgress(goal);
            const status = getGoalStatus(goal);

            return (
              <div key={goal.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getGoalIcon(goal.metric)}</span>
                    <div>
                      <h4 className="font-semibold">
                        {goal.type === 'daily' ? '日次' : 
                         goal.type === 'weekly' ? '週次' : '月次'}目標
                      </h4>
                      <p className="text-sm text-gray-600">
                        {goal.metric === 'words' ? '単語数' :
                         goal.metric === 'chapters' ? '章数' : '知識収集'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${status.color}`}>
                    {status.text}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{goal.current.toLocaleString()} / {goal.target.toLocaleString()}</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`${getProgressColor(progress)} h-3 rounded-full transition-all duration-300`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {onGoalUpdate && (
                    <button
                      onClick={() => {
                        const newTarget = prompt('新しい目標値を入力してください:', goal.target.toString());
                        if (newTarget && !isNaN(Number(newTarget))) {
                          onGoalUpdate(goal.id, Number(newTarget));
                        }
                      }}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      目標を編集
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 推奨アクション */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">推奨アクション</h3>
          <div className="space-y-4">
            {goals.map(goal => (
              <div key={goal.id} className="flex gap-3">
                <span className="text-2xl flex-shrink-0">{getGoalIcon(goal.metric)}</span>
                <div>
                  <h4 className="font-medium mb-1">
                    {goal.type === 'daily' ? '日次' : 
                     goal.type === 'weekly' ? '週次' : '月次'}
                    {goal.metric === 'words' ? '執筆' :
                     goal.metric === 'chapters' ? '章作成' : '知識収集'}目標
                  </h4>
                  <p className="text-sm text-gray-600">{getRecommendations(goal)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 目標達成のヒント */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">目標達成のヒント</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>大きな目標は小さなタスクに分割して、毎日少しずつ進めましょう</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>執筆の最適な時間帯を見つけて、ルーティンを確立しましょう</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>進捗を可視化することで、モチベーションを維持できます</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 mt-0.5">•</span>
              <span>無理のない目標設定が、長期的な成功の鍵です</span>
            </li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}