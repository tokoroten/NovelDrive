/**
 * ディスカッション進捗パネルコンポーネント
 */

import React from 'react';
import { DiscussionProgress, AgentConfig } from './types';

interface DiscussionProgressPanelProps {
  progress: DiscussionProgress;
  participants: AgentConfig[];
}

export function DiscussionProgressPanel({ progress, participants }: DiscussionProgressPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">進捗状況</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>ラウンド {progress.currentRound} / {progress.maxRounds}</span>
          <span className="text-gray-600">完了: {progress.completedRounds}</span>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>全体進捗</span>
            <span>{Math.round(progress.overallProgress)}%</span>
          </div>
          <div className="bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.overallProgress}%` }}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          {Object.entries(progress.participantProgress).map(([agentId, agentProgress]) => {
            const agent = participants.find(p => p.role === agentId);
            return (
              <div key={agentId} className="flex items-center gap-2">
                <span className="text-xs w-20 truncate">{agent?.name || agentId}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${agentProgress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8">{Math.round(agentProgress)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}