import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AgentConfig {
  role: 'writer' | 'editor' | 'proofreader' | 'deputy_editor';
  personality: 'experimental' | 'traditional' | 'logical' | 'emotional' | 'commercial';
  name?: string;
}

interface Message {
  id: string;
  agentId: string;
  agentRole: string;
  agentName?: string;
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    emotionalTone?: string;
    thinkingTime?: number;
    replyTo?: string;
  };
}

interface AgentStatus {
  id: string;
  role: string;
  name?: string;
  status: 'active' | 'thinking' | 'finished' | 'idle';
  lastActivity?: string;
  messageCount: number;
}

interface DiscussionProgress {
  currentRound: number;
  maxRounds: number;
  completedRounds: number;
  participantProgress: Record<string, number>;
  overallProgress: number;
}

interface HumanIntervention {
  id: string;
  content: string;
  timestamp: string;
  impact: 'low' | 'medium' | 'high';
}

interface Session {
  id: string;
  topic: string;
  status: 'active' | 'paused' | 'concluded';
  messageCount: number;
  summary?: string;
  startTime: string;
  endTime?: string;
}

const AGENT_ROLES = [
  { value: 'writer', label: '作家AI' },
  { value: 'editor', label: '編集AI' },
  { value: 'proofreader', label: '校閲AI' },
  { value: 'deputy_editor', label: '副編集長AI' },
];

const PERSONALITIES = [
  { value: 'experimental', label: '実験的・挑戦的' },
  { value: 'traditional', label: '伝統的・保守的' },
  { value: 'logical', label: '論理的・分析的' },
  { value: 'emotional', label: '感情的・直感的' },
  { value: 'commercial', label: '商業的・市場志向' },
];

export function AgentMeetingRoom() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [topic, setTopic] = useState('');
  const [participants, setParticipants] = useState<AgentConfig[]>([
    { role: 'writer', personality: 'experimental', name: 'クリエイティブ・ライター' },
    { role: 'editor', personality: 'logical', name: 'ロジカル・エディター' },
  ]);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>([]);
  const [discussionProgress, setDiscussionProgress] = useState<DiscussionProgress | null>(null);
  const [humanIntervention, setHumanIntervention] = useState('');
  const [interventionHistory, setInterventionHistory] = useState<HumanIntervention[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInterventionPanel, setShowInterventionPanel] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const interventionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // セッション一覧を取得
    loadSessions();

    // リアルタイムイベントのリスナー設定
    window.electronAPI.agents.onMessage((data: any) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setMessages((prev) => [...prev, data.message]);
        updateAgentStatus(data.message.agentId, 'active');
        
        // メッセージ数更新
        setAgentStatuses(prev => prev.map(s => 
          s.id === data.message.agentId 
            ? { ...s, messageCount: s.messageCount + 1 }
            : s
        ));
      }
    });

    window.electronAPI.agents.onSessionStarted((_data: any) => {
      loadSessions();
    });

    window.electronAPI.agents.onSessionConcluded((data: any) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setActiveSession((prev) =>
          prev ? { ...prev, status: 'concluded', summary: data.summary } : null
        );
        updateAllAgentStatuses('finished');
      }
      loadSessions();
    });

    // エージェント状態更新イベント
    window.electronAPI.agents.onAgentStatusUpdate?.((data: any) => {
      if (activeSession && data.sessionId === activeSession.id) {
        updateAgentStatus(data.agentId, data.status);
      }
    });

    // 議論進捗更新イベント
    window.electronAPI.agents.onProgressUpdate?.((data: any) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setDiscussionProgress(data.progress);
      }
    });

    return () => {
      // クリーンアップ処理
      setError(null);
    };
  }, [activeSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScroll]);

  const updateAgentStatus = (agentId: string, status: AgentStatus['status']) => {
    setAgentStatuses(prev => {
      const existing = prev.find(s => s.id === agentId);
      if (existing) {
        return prev.map(s => s.id === agentId ? 
          { ...s, status, lastActivity: new Date().toISOString() } : s
        );
      } else {
        const agent = participants.find(p => p.role === agentId);
        return [...prev, {
          id: agentId,
          role: agent?.role || agentId,
          name: agent?.name,
          status,
          lastActivity: new Date().toISOString(),
          messageCount: 0
        }];
      }
    });
  };

  const updateAllAgentStatuses = (status: AgentStatus['status']) => {
    setAgentStatuses(prev => prev.map(s => ({ ...s, status })));
  };

  const handleHumanIntervention = async () => {
    if (!humanIntervention.trim() || !activeSession) return;

    try {
      const intervention: HumanIntervention = {
        id: Date.now().toString(),
        content: humanIntervention,
        timestamp: new Date().toISOString(),
        impact: 'medium'
      };

      // バックエンドに送信
      await window.electronAPI.agents.submitHumanIntervention?.({
        sessionId: activeSession.id,
        intervention: intervention.content
      });

      // ローカル状態更新
      setInterventionHistory(prev => [...prev, intervention]);
      setHumanIntervention('');
      setShowInterventionPanel(false);

      // メッセージとして表示
      const humanMessage: Message = {
        id: `human-${Date.now()}`,
        agentId: 'human',
        agentRole: 'human',
        agentName: '人間（あなた）',
        content: intervention.content,
        timestamp: intervention.timestamp,
        metadata: {
          emotionalTone: 'neutral',
          confidence: 1.0
        }
      };
      setMessages(prev => [...prev, humanMessage]);
    } catch (error) {
      console.error('Failed to submit human intervention:', error);
      setError('人間の介入の送信に失敗しました');
    }
  };

  const loadSessions = async () => {
    try {
      const response = await window.electronAPI.agents.getAllSessions();
      if (response.success) {
        setSessions(response.sessions);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const startDiscussion = async () => {
    if (!topic.trim() || participants.length < 2) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await window.electronAPI.agents.startDiscussion({
        topic,
        agentConfigs: participants,
        maxRounds: 5,
      });

      if (response.success) {
        setActiveSession(response.session);
        setMessages([]);
        setInterventionHistory([]);
        
        // エージェント状態初期化
        const initialStatuses: AgentStatus[] = participants.map(p => ({
          id: p.role,
          role: p.role,
          name: p.name,
          status: 'idle',
          messageCount: 0
        }));
        setAgentStatuses(initialStatuses);

        // 進捗初期化
        setDiscussionProgress({
          currentRound: 0,
          maxRounds: 5,
          completedRounds: 0,
          participantProgress: participants.reduce((acc, p) => ({ ...acc, [p.role]: 0 }), {}),
          overallProgress: 0
        });
        
        // セッションの詳細を取得
        await loadSessionDetails(response.session.id);
      } else {
        setError(response.error || '議論の開始に失敗しました');
      }
    } catch (error) {
      console.error('Failed to start discussion:', error);
      setError('議論の開始中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const response = await window.electronAPI.agents.getSession(sessionId);
      if (response.success) {
        const session = response.session as any;
        setMessages(session.messages || []);
        
        // メッセージ数をカウントしてエージェント状態更新
        const messageCounts: Record<string, number> = {};
        (session.messages || []).forEach((msg: any) => {
          messageCounts[msg.agentId] = (messageCounts[msg.agentId] || 0) + 1;
        });
        
        setAgentStatuses(prev => prev.map(s => ({
          ...s,
          messageCount: messageCounts[s.id] || 0
        })));
      } else {
        setError(response.error || 'セッションの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
      setError('セッションの読み込み中にエラーが発生しました');
    }
  };

  const pauseSession = async () => {
    if (!activeSession) return;

    try {
      const response = await window.electronAPI.agents.pauseSession(activeSession.id);
      if (response.success) {
        setActiveSession((prev) => (prev ? { ...prev, status: 'paused' } : null));
        updateAllAgentStatuses('idle');
      } else {
        setError(response.error || 'セッションの一時停止に失敗しました');
      }
    } catch (error) {
      console.error('Failed to pause session:', error);
      setError('セッションの一時停止中にエラーが発生しました');
    }
  };

  const resumeSession = async () => {
    if (!activeSession) return;

    try {
      const response = await window.electronAPI.agents.resumeSession(activeSession.id);
      if (response.success) {
        setActiveSession((prev) => (prev ? { ...prev, status: 'active' } : null));
        updateAllAgentStatuses('thinking');
      } else {
        setError(response.error || 'セッションの再開に失敗しました');
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      setError('セッションの再開中にエラーが発生しました');
    }
  };

  const addParticipant = () => {
    if (participants.length < 5) {
      setParticipants([...participants, { role: 'writer', personality: 'experimental' }]);
    }
  };

  const removeParticipant = (index: number) => {
    if (participants.length > 2) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index: number, field: keyof AgentConfig, value: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    
    // ロールが変更された場合、デフォルト名を設定
    if (field === 'role') {
      const defaultNames = {
        writer: 'クリエイティブ・ライター',
        editor: 'ロジカル・エディター',
        proofreader: 'シャープ・プルーフリーダー',
        deputy_editor: 'ストラテジック・デプティ',
      };
      updated[index].name = defaultNames[value as keyof typeof defaultNames] || value;
    }
    
    setParticipants(updated);
  };

  const getAgentColor = (role: string) => {
    const colors = {
      writer: 'text-blue-600',
      editor: 'text-green-600',
      proofreader: 'text-purple-600',
      deputy_editor: 'text-orange-600',
      human: 'text-red-600',
    };
    return colors[role as keyof typeof colors] || 'text-gray-600';
  };

  const getAgentBgColor = (role: string) => {
    const colors = {
      writer: 'bg-blue-50 border-blue-200',
      editor: 'bg-green-50 border-green-200',
      proofreader: 'bg-purple-50 border-purple-200',
      deputy_editor: 'bg-orange-50 border-orange-200',
      human: 'bg-red-50 border-red-200',
    };
    return colors[role as keyof typeof colors] || 'bg-gray-50 border-gray-200';
  };

  const getStatusIcon = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active':
        return <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>;
      case 'thinking':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce"></div>;
      case 'finished':
        return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
      default:
        return <div className="w-3 h-3 bg-gray-300 rounded-full"></div>;
    }
  };

  const getStatusText = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active': return '発言中';
      case 'thinking': return '考え中';
      case 'finished': return '完了';
      default: return '待機中';
    }
  };

  const getAgentAvatar = (role: string) => {
    const avatars = {
      writer: '✍️',
      editor: '📝',
      proofreader: '🔍',
      deputy_editor: '👑',
      human: '👤',
    };
    return avatars[role as keyof typeof avatars] || '🤖';
  };

  const getEmotionEmoji = (tone?: string) => {
    const emojis = {
      positive: '😊',
      concerned: '🤔',
      constructive: '💡',
      neutral: '😐',
      excited: '😄',
      analytical: '🧐',
      critical: '😬',
      supportive: '😌',
    };
    return emojis[tone as keyof typeof emojis] || '😐';
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-3xl font-bold text-secondary-800 mb-5">エージェント会議室</h2>

      {/* エラー表示 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-xl">⚠️</span>
            <span className="text-red-700 font-medium">エラー</span>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
          >
            閉じる
          </button>
        </div>
      )}

      <div className="flex-1 flex gap-6">
        {/* 左側：設定パネル */}
        <div className="w-1/3 space-y-6">
          {/* 議題入力 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">議題設定</h3>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="議論したいテーマを入力してください..."
              className="w-full p-3 border border-gray-300 rounded-md resize-none h-24"
              disabled={activeSession?.status === 'active'}
            />
          </div>

          {/* 参加者設定 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">参加エージェント</h3>
              <button
                onClick={addParticipant}
                disabled={participants.length >= 5 || activeSession?.status === 'active'}
                className="text-primary-600 hover:text-primary-700 disabled:text-gray-400 text-sm"
              >
                🤖+ 追加
              </button>
            </div>
            <div className="text-xs text-gray-500 mb-4">
              最低2人、最大5人まで参加可能
            </div>

            <div className="space-y-3">
              {participants.map((participant, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium">参加者 {index + 1}</span>
                    {participants.length > 2 && (
                      <button
                        onClick={() => removeParticipant(index)}
                        disabled={activeSession?.status === 'active'}
                        className="text-red-500 text-sm hover:text-red-600 disabled:text-gray-400"
                      >
                        削除
                      </button>
                    )}
                  </div>

                  <select
                    value={participant.role}
                    onChange={(e) => updateParticipant(index, 'role', e.target.value)}
                    disabled={activeSession?.status === 'active'}
                    className="w-full p-2 mb-2 border border-gray-300 rounded text-sm"
                  >
                    {AGENT_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={participant.personality}
                    onChange={(e) => updateParticipant(index, 'personality', e.target.value)}
                    disabled={activeSession?.status === 'active'}
                    className="w-full p-2 mb-2 border border-gray-300 rounded text-sm"
                  >
                    {PERSONALITIES.map((personality) => (
                      <option key={personality.value} value={personality.value}>
                        {personality.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={participant.name || ''}
                    onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                    placeholder="エージェント名（任意）"
                    disabled={activeSession?.status === 'active'}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* エージェント状態 */}
          {activeSession && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">エージェント状態</h3>
              <div className="space-y-3">
                {agentStatuses.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                    <div className="text-2xl">{getAgentAvatar(agent.role)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{agent.name || agent.role}</span>
                        {getStatusIcon(agent.status)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {getStatusText(agent.status)}
                        {agent.lastActivity && (
                          <span className="ml-2">
                            ({formatDistanceToNow(new Date(agent.lastActivity), { addSuffix: true, locale: ja })})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {agent.messageCount}発言
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 進捗表示 */}
          {discussionProgress && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">議論進捗</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>ラウンド {discussionProgress.currentRound}/{discussionProgress.maxRounds}</span>
                    <span>{Math.round(discussionProgress.overallProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${discussionProgress.overallProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(discussionProgress.participantProgress).map(([agentId, progress]) => {
                    const agent = participants.find(p => p.role === agentId);
                    return (
                      <div key={agentId} className="flex items-center gap-2">
                        <span className="text-xs w-20 truncate">{agent?.name || agentId}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 w-8">{Math.round(progress)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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
                  onClick={() => {
                    setActiveSession(null);
                    setMessages([]);
                    setAgentStatuses([]);
                    setDiscussionProgress(null);
                    setInterventionHistory([]);
                    setError(null);
                  }}
                  className="w-full py-3 px-4 bg-secondary-600 text-white rounded-md font-medium hover:bg-secondary-700"
                >
                  新しい議論を開始
                </button>
              )}
            </div>
          </div>

          {/* 人間介入パネル */}
          {showInterventionPanel && activeSession && (
            <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-700">人間介入</h3>
                <button
                  onClick={() => setShowInterventionPanel(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              <textarea
                ref={interventionRef}
                value={humanIntervention}
                onChange={(e) => setHumanIntervention(e.target.value)}
                placeholder="議論に対するあなたの意見や方向性を入力してください..."
                className="w-full p-3 border border-red-300 rounded-md resize-none h-20 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleHumanIntervention}
                  disabled={!humanIntervention.trim()}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    !humanIntervention.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  介入する
                </button>
                <button
                  onClick={() => {
                    setHumanIntervention('');
                    setShowInterventionPanel(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  キャンセル
                </button>
              </div>
              {interventionHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">過去の介入</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {interventionHistory.slice(-3).map((intervention) => (
                      <div key={intervention.id} className="text-xs p-2 bg-red-50 rounded">
                        <div className="text-gray-600">
                          {formatDistanceToNow(new Date(intervention.timestamp), { addSuffix: true, locale: ja })}
                        </div>
                        <div className="text-gray-800 mt-1">
                          {intervention.content.substring(0, 50)}{intervention.content.length > 50 ? '...' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右側：議論ログ */}
        <div className="flex-1 bg-white rounded-lg shadow-md flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {activeSession ? activeSession.topic : '議論ログ'}
              </h3>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded"
                  />
                  自動スクロール
                </label>
              </div>
            </div>
            {activeSession && (
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    activeSession.status === 'active'
                      ? 'bg-green-100 text-green-700 animate-pulse'
                      : activeSession.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {activeSession.status === 'active'
                    ? '進行中'
                    : activeSession.status === 'paused'
                      ? '一時停止'
                      : '完了'}
                </span>
                <span>{messages.length} メッセージ</span>
                {discussionProgress && (
                  <span>ラウンド {discussionProgress.currentRound}/{discussionProgress.maxRounds}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                <div className="text-6xl mb-4">🤖</div>
                <div className="text-lg mb-2">
                  {activeSession ? '議論が開始されるのを待っています...' : '議論を開始してください'}
                </div>
                {isLoading && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={message.id} className="animate-fadeIn">
                    <div className={`p-4 rounded-lg border-l-4 ${getAgentBgColor(message.agentRole)}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-2xl">{getAgentAvatar(message.agentRole)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${getAgentColor(message.agentRole)}`}>
                              {message.agentName || message.agentRole}
                            </span>
                            {message.metadata?.confidence && (
                              <span className="text-xs px-2 py-1 bg-gray-200 rounded-full">
                                確信度: {Math.round(message.metadata.confidence * 100)}%
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true, locale: ja })}
                            {message.metadata?.thinkingTime && (
                              <span className="ml-2">(思考時間: {message.metadata.thinkingTime}s)</span>
                            )}
                          </div>
                        </div>
                        {message.metadata?.emotionalTone && (
                          <span className="text-lg">
                            {getEmotionEmoji(message.metadata.emotionalTone)}
                          </span>
                        )}
                      </div>
                      <div className="ml-11">
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        {message.metadata?.replyTo && (
                          <div className="mt-2 text-xs text-gray-500">
                            → {messages.find(m => m.id === message.metadata?.replyTo)?.agentName || '前のメッセージ'}への返信
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {activeSession?.summary && (
            <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">📝</span>
                <h4 className="font-semibold text-gray-700">議論の要約</h4>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{activeSession.summary}</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>総メッセージ数: {messages.length}</span>
                <span>人間介入: {interventionHistory.length}回</span>
                <span>
                  開始時刻: {formatDistanceToNow(new Date(activeSession.startTime), { addSuffix: true, locale: ja })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
