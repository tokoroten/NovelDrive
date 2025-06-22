/**
 * アクティビティチャートコンポーネント
 */

import React from 'react';
import { ActivityData } from './types';

interface ActivityChartProps {
  data: ActivityData[];
}

export function ActivityChart({ data }: ActivityChartProps) {
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.words, d.knowledge, d.discussions))
  );

  const scale = (value: number) => (value / maxValue) * 100;

  return (
    <div className="relative">
      {/* Y軸ラベル */}
      <div className="absolute -left-10 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
        <span>{maxValue}</span>
        <span>{Math.floor(maxValue / 2)}</span>
        <span>0</span>
      </div>

      {/* グラフエリア */}
      <div className="relative h-64 border-l border-b border-gray-300">
        <svg className="absolute inset-0 w-full h-full">
          {/* グリッドライン */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={`${100 - y}%`}
              x2="100%"
              y2={`${100 - y}%`}
              stroke="#e5e7eb"
              strokeDasharray="2 2"
            />
          ))}

          {/* データライン */}
          {['words', 'knowledge', 'discussions'].map((metric, idx) => {
            const color = ['#3b82f6', '#10b981', '#f59e0b'][idx];
            const points = data.map((d, i) => {
              const x = (i / (data.length - 1)) * 100;
              const y = 100 - scale(d[metric as keyof ActivityData] as number);
              return `${x},${y}`;
            }).join(' ');

            return (
              <g key={metric}>
                {/* エリア */}
                <polyline
                  points={`0,100 ${points} 100,100`}
                  fill={color}
                  fillOpacity="0.1"
                />
                {/* ライン */}
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                />
                {/* データポイント */}
                {data.map((d, i) => {
                  const x = (i / (data.length - 1)) * 100;
                  const y = 100 - scale(d[metric as keyof ActivityData] as number);
                  return (
                    <circle
                      key={i}
                      cx={`${x}%`}
                      cy={`${y}%`}
                      r="3"
                      fill={color}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* X軸ラベル */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        {data.map((d, i) => {
          if (i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) {
            return <span key={i}>{d.date}</span>;
          }
          return null;
        })}
      </div>

      {/* 凡例 */}
      <div className="flex justify-center gap-4 mt-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-sm text-gray-600">単語数</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">知識</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          <span className="text-sm text-gray-600">議論</span>
        </div>
      </div>
    </div>
  );
}