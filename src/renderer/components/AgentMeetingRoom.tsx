import React, { useState, useEffect, useRef, useCallback } from 'react';

interface AgentConfig {
  role: 'writer' | 'editor' | 'proofreader' | 'deputy_editor';
  personality: 'experimental' | 'traditional' | 'logical' | 'emotional' | 'commercial';
  name?: string;
}

interface Message {
  id: string;
  agentId: string;
  agentRole: string;
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    emotionalTone?: string;
  };
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [topic, setTopic] = useState('');
  const [participants, setParticipants] = useState<AgentConfig[]>([
    { role: 'writer', personality: 'experimental' },
    { role: 'editor', personality: 'logical' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // セッション一覧を取得
    loadSessions();

    // リアルタイムイベントのリスナー設定
    window.electronAPI.agents.onMessage((data) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setMessages(prev => [...prev, data.message]);
      }
    });

    window.electronAPI.agents.onSessionStarted((data) => {
      loadSessions();
    });

    window.electronAPI.agents.onSessionConcluded((data) => {
      if (activeSession && data.sessionId === activeSession.id) {
        setActiveSession(prev => prev ? { ...prev, status: 'concluded', summary: data.summary } : null);
      }
      loadSessions();
    });
  }, [activeSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    try {
      const response = await window.electronAPI.agents.startDiscussion({
        topic,
        agentConfigs: participants,
        maxRounds: 5,
      });

      if (response.success) {
        setActiveSession(response.session);
        setMessages([]);
        // セッションの詳細を取得
        await loadSessionDetails(response.session.id);
      }
    } catch (error) {
      console.error('Failed to start discussion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const response = await window.electronAPI.agents.getSession(sessionId);
      if (response.success) {
        setMessages(response.session.messages || []);
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
  };

  const pauseSession = async () => {
    if (!activeSession) return;

    try {
      await window.electronAPI.agents.pauseSession(activeSession.id);
      setActiveSession(prev => prev ? { ...prev, status: 'paused' } : null);
    } catch (error) {
      console.error('Failed to pause session:', error);
    }
  };

  const resumeSession = async () => {
    if (!activeSession) return;

    try {
      await window.electronAPI.agents.resumeSession(activeSession.id);
      setActiveSession(prev => prev ? { ...prev, status: 'active' } : null);
    } catch (error) {
      console.error('Failed to resume session:', error);
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
    setParticipants(updated);
  };

  const getAgentColor = (role: string) => {
    const colors = {
      writer: 'text-blue-600',
      editor: 'text-green-600',
      proofreader: 'text-purple-600',
      deputy_editor: 'text-orange-600',
    };
    return colors[role as keyof typeof colors] || 'text-gray-600';
  };

  const getEmotionEmoji = (tone?: string) => {
    const emojis = {
      positive: '😊',
      concerned: '🤔',
      constructive: '💡',
      neutral: '😐',
    };
    return emojis[tone as keyof typeof emojis] || '';
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-3xl font-bold text-secondary-800 mb-5">エージェント会議室</h2>
      
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
                className="text-primary-600 hover:text-primary-700 disabled:text-gray-400"
              >
                + 追加
              </button>
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
                    {AGENT_ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  
                  <select
                    value={participant.personality}
                    onChange={(e) => updateParticipant(index, 'personality', e.target.value)}
                    disabled={activeSession?.status === 'active'}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  >
                    {PERSONALITIES.map(personality => (
                      <option key={personality.value} value={personality.value}>
                        {personality.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* コントロールボタン */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="space-y-3">
              {!activeSession && (
                <button
                  onClick={startDiscussion}
                  disabled={!topic.trim() || isLoading}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                    !topic.trim() || isLoading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isLoading ? '準備中...' : '議論を開始'}
                </button>
              )}
              
              {activeSession?.status === 'active' && (
                <button
                  onClick={pauseSession}
                  className="w-full py-3 px-4 bg-yellow-500 text-white rounded-md font-medium hover:bg-yellow-600"
                >
                  一時停止
                </button>
              )}
              
              {activeSession?.status === 'paused' && (
                <button
                  onClick={resumeSession}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700"
                >
                  再開
                </button>
              )}
              
              {activeSession?.status === 'concluded' && (
                <button
                  onClick={() => {
                    setActiveSession(null);
                    setMessages([]);
                  }}
                  className="w-full py-3 px-4 bg-secondary-600 text-white rounded-md font-medium hover:bg-secondary-700"
                >
                  新しい議論を開始
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 右側：議論ログ */}
        <div className="flex-1 bg-white rounded-lg shadow-md flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">
              {activeSession ? activeSession.topic : '議論ログ'}
            </h3>
            {activeSession && (
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  activeSession.status === 'active' ? 'bg-green-100 text-green-700' :
                  activeSession.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {activeSession.status === 'active' ? '進行中' :
                   activeSession.status === 'paused' ? '一時停止' : '完了'}
                </span>
                <span>{activeSession.messageCount} メッセージ</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-20">
                {activeSession ? '議論が開始されるのを待っています...' : '議論を開始してください'}
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <div className={`font-semibold ${getAgentColor(message.agentRole)}`}>
                        [{message.agentRole}]
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
                        {message.metadata?.emotionalTone && (
                          <span className="text-sm text-gray-500 mt-1">
                            {getEmotionEmoji(message.metadata.emotionalTone)}
                          </span>
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
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <h4 className="font-semibold text-gray-700 mb-2">議論の要約</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{activeSession.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}