/**
 * エージェント会議室（リファクタリング版）
 */

import React from 'react';
import { SessionHeader } from './SessionHeader';
import { AgentConfigPanel } from './AgentConfigPanel';
import { MessageList } from './MessageList';
import { AgentStatusPanel } from './AgentStatusPanel';
import { DiscussionProgressPanel } from './DiscussionProgressPanel';
import { HumanInterventionPanel } from './HumanInterventionPanel';
import { useAgentMeeting } from './hooks/useAgentMeeting';

export function AgentMeetingRoom() {
  const {
    activeSession,
    messages,
    topic,
    participants,
    agentStatuses,
    discussionProgress,
    humanIntervention,
    interventionHistory,
    isLoading,
    error,
    showInterventionPanel,
    autoScroll,
    setTopic,
    setHumanIntervention,
    setShowInterventionPanel,
    setAutoScroll,
    startDiscussion,
    pauseSession,
    resumeSession,
    endSession,
    sendHumanIntervention,
    addParticipant,
    removeParticipant,
    updateParticipant,
  } = useAgentMeeting();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* ヘッダー */}
      <SessionHeader
        session={activeSession}
        topic={topic}
        onTopicChange={setTopic}
        isEditable={!activeSession}
        error={error}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* メインコンテンツ */}
        <div className="lg:col-span-2 space-y-6">
          {/* エージェント設定（セッション開始前のみ） */}
          {!activeSession && (
            <AgentConfigPanel
              participants={participants}
              onAdd={addParticipant}
              onRemove={removeParticipant}
              onChange={updateParticipant}
              disabled={!!activeSession}
            />
          )}

          {/* メッセージリスト */}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            autoScroll={autoScroll}
            onAutoScrollToggle={() => setAutoScroll(!autoScroll)}
          />
        </div>

        {/* サイドバー */}
        <div className="space-y-6">
          {/* エージェントステータス */}
          {activeSession && agentStatuses.length > 0 && (
            <AgentStatusPanel statuses={agentStatuses} />
          )}

          {/* 進捗状況 */}
          {activeSession && discussionProgress && (
            <DiscussionProgressPanel
              progress={discussionProgress}
              participants={participants}
            />
          )}

          {/* コントロールボタン */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-3">
              {!activeSession && (
                <button
                  onClick={startDiscussion}
                  disabled={!topic.trim() || isLoading || participants.length < 2}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                    !topic.trim() || isLoading || participants.length < 2
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isLoading ? '準備中...' : '議論を開始'}
                </button>
              )}

              {activeSession?.status === 'active' && (
                <>
                  <button
                    onClick={pauseSession}
                    className="w-full py-3 px-4 bg-yellow-500 text-white rounded-md font-medium hover:bg-yellow-600"
                  >
                    一時停止
                  </button>
                  <button
                    onClick={() => setShowInterventionPanel(!showInterventionPanel)}
                    className="w-full py-2 px-4 bg-red-500 text-white rounded-md font-medium hover:bg-red-600 text-sm"
                  >
                    人間が介入する
                  </button>
                </>
              )}

              {activeSession?.status === 'paused' && (
                <>
                  <button
                    onClick={resumeSession}
                    className="w-full py-3 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700"
                  >
                    再開
                  </button>
                  <button
                    onClick={() => setShowInterventionPanel(!showInterventionPanel)}
                    className="w-full py-2 px-4 bg-red-500 text-white rounded-md font-medium hover:bg-red-600 text-sm"
                  >
                    人間が介入する
                  </button>
                </>
              )}

              {activeSession?.status === 'concluded' && (
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 px-4 bg-secondary-600 text-white rounded-md font-medium hover:bg-secondary-700"
                >
                  新しい議論を開始
                </button>
              )}

              {activeSession && activeSession.status !== 'concluded' && (
                <button
                  onClick={endSession}
                  className="w-full py-2 px-3 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50"
                >
                  議論を終了
                </button>
              )}
            </div>
          </div>

          {/* 人間介入パネル */}
          {showInterventionPanel && activeSession && (
            <HumanInterventionPanel
              value={humanIntervention}
              onChange={setHumanIntervention}
              onSubmit={sendHumanIntervention}
              onClose={() => setShowInterventionPanel(false)}
              interventionHistory={interventionHistory}
              isActive={showInterventionPanel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 互換性のため、既存の名前でもエクスポート
export { AgentMeetingRoom as default };