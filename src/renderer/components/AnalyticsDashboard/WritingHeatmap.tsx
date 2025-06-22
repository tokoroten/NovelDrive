/**
 * 執筆ヒートマップコンポーネント
 */

import React, { useMemo } from 'react';

interface HeatmapData {
  day: number; // 0-6 (日-土)
  hour: number; // 0-23
  intensity: number; // 0-1
}

export function WritingHeatmap() {
  // モックデータの生成（実際の実装では props から受け取る）
  const heatmapData: HeatmapData[] = useMemo(() => {
    const data: HeatmapData[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        // 朝と夜に高い活動を示すようなパターンを生成
        const morningBoost = hour >= 6 && hour <= 9 ? 0.3 : 0;
        const eveningBoost = hour >= 19 && hour <= 22 ? 0.4 : 0;
        const baseActivity = Math.random() * 0.3;
        const intensity = Math.min(1, baseActivity + morningBoost + eveningBoost);
        
        data.push({ day, hour, intensity });
      }
    }
    return data;
  }, []);

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getColor = (intensity: number) => {
    if (intensity < 0.1) return 'bg-gray-100';
    if (intensity < 0.3) return 'bg-indigo-200';
    if (intensity < 0.5) return 'bg-indigo-400';
    if (intensity < 0.7) return 'bg-indigo-600';
    return 'bg-indigo-800';
  };

  return (
    <div>
      <div className="flex gap-2">
        {/* 時間軸ラベル */}
        <div className="w-8 flex flex-col justify-between py-3">
          {[0, 6, 12, 18].map(hour => (
            <div key={hour} className="text-xs text-gray-500">{hour}時</div>
          ))}
        </div>

        {/* ヒートマップ本体 */}
        <div className="flex-1">
          {/* 曜日ラベル */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map(day => (
              <div key={day} className="text-xs text-center text-gray-600 font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* ヒートマップグリッド */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((_, dayIndex) => (
              <div key={dayIndex} className="space-y-1">
                {hours.map(hour => {
                  const data = heatmapData.find(d => d.day === dayIndex && d.hour === hour);
                  const intensity = data?.intensity || 0;
                  
                  return (
                    <div
                      key={hour}
                      className={`w-full h-2 rounded-sm ${getColor(intensity)} transition-colors hover:opacity-80`}
                      title={`${days[dayIndex]} ${hour}:00 - 活動度: ${Math.round(intensity * 100)}%`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
        <span>活動度:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-100 rounded" />
          <span>なし</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-indigo-200 rounded" />
          <span>低</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-indigo-400 rounded" />
          <span>中</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-indigo-600 rounded" />
          <span>高</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-indigo-800 rounded" />
          <span>最高</span>
        </div>
      </div>
    </div>
  );
}