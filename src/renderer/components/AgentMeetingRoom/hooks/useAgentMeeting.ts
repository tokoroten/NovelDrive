/**
 * エージェント会議室のカスタムフック
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Session,
  Message,
  AgentConfig,
  AgentStatus,
  DiscussionProgress,
  HumanIntervention
} from '../types';

export function useAgentMeeting() {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
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

  // セッション一覧を取得
  const loadSessions = useCallback(async () => {
    try {
      const response = await window.electronAPI.agents.getAllSessions();
      setSessions(response.data || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, []);

  // 初期化
  useEffect(() => {
    loadSessions();

    // リアルタイムイベントのリスナー設定
    const listeners = setupEventListeners();
    
    // クリーンアップ
    return () => {
      listeners.forEach(listener => listener());
    };
  }, [loadSessions]);

  // イベントリスナーの設定
  const setupEventListeners = () => {
    const listeners: (() => void)[] = [];

    if (window.electronAPI?.on) {
      // 新しいメッセージ
      const messageListener = window.electronAPI.on('agent:message', (data: any) => {
        if (data.sessionId === activeSession?.id) {
          setMessages(prev => [...prev, data.message]);
          updateAgentStatus(data.agentId, 'active');
        }
      });
      listeners.push(() => window.electronAPI.off?.('agent:message', messageListener));

      // エージェントステータス更新
      const statusListener = window.electronAPI.on('agent:status', (data: any) => {
        if (data.sessionId === activeSession?.id) {
          updateAgentStatus(data.agentId, data.status);
        }
      });
      listeners.push(() => window.electronAPI.off?.('agent:status', statusListener));

      // 進捗更新
      const progressListener = window.electronAPI.on('discussion:progress', (data: any) => {
        if (data.sessionId === activeSession?.id) {
          setDiscussionProgress(data.progress);
        }
      });
      listeners.push(() => window.electronAPI.off?.('discussion:progress', progressListener));
    }

    return listeners;
  };

  // エージェントステータスの更新
  const updateAgentStatus = (agentId: string, status: AgentStatus['status']) => {
    setAgentStatuses(prev => {
      const existing = prev.find(s => s.id === agentId);
      if (existing) {
        return prev.map(s => s.id === agentId ? { ...s, status } : s);
      }
      return prev;
    });
  };

  // ディスカッションの開始
  const startDiscussion = async () => {
    if (!topic.trim() || participants.length < 2) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await window.electronAPI.discussion.create({
        topic,
        agentConfigs: participants,
        maxRounds: 10
      });

      if (response.success) {
        const sessionData = response.data;
        const session: Session = {
          id: sessionData.id,
          topic: sessionData.topic,
          status: 'active',
          messageCount: 0,
          startTime: new Date().toISOString()
        };
        
        setActiveSession(session);
        setMessages([]);
        
        // エージェントステータスの初期化
        const initialStatuses: AgentStatus[] = participants.map(p => ({
          id: p.role,
          role: p.role,
          name: p.name,
          status: 'idle',
          messageCount: 0
        }));
        setAgentStatuses(initialStatuses);
        
        // 進捗の初期化
        setDiscussionProgress({
          currentRound: 1,
          maxRounds: 10,
          completedRounds: 0,
          participantProgress: Object.fromEntries(
            participants.map(p => [p.role, 0])
          ),
          overallProgress: 0
        });
      }
    } catch (error) {
      setError('議論の開始に失敗しました');
      console.error('Failed to start discussion:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // セッションの一時停止
  const pauseSession = () => {
    if (activeSession) {
      setActiveSession({ ...activeSession, status: 'paused' });
    }
  };

  // セッションの再開
  const resumeSession = () => {
    if (activeSession) {
      setActiveSession({ ...activeSession, status: 'active' });
    }
  };

  // セッションの終了
  const endSession = async () => {
    if (!activeSession) return;
    
    try {
      await window.electronAPI.discussion.end(activeSession.id);
      setActiveSession({ 
        ...activeSession, 
        status: 'concluded',
        endTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  // 人間の介入を送信
  const sendHumanIntervention = async () => {
    if (!activeSession || !humanIntervention.trim()) return;
    
    try {
      const response = await window.electronAPI.discussion.sendHumanMessage(
        activeSession.id,
        humanIntervention
      );
      
      if (response.success) {
        const intervention: HumanIntervention = {
          id: Date.now().toString(),
          content: humanIntervention,
          timestamp: new Date().toLocaleString('ja-JP'),
          impact: 'medium'
        };
        
        setInterventionHistory(prev => [...prev, intervention]);
        setHumanIntervention('');
        setShowInterventionPanel(false);
      }
    } catch (error) {
      console.error('Failed to send intervention:', error);
    }
  };

  // エージェントの追加
  const addParticipant = () => {
    if (participants.length < 4 && !activeSession) {
      setParticipants([
        ...participants,
        { role: 'proofreader', personality: 'traditional' }
      ]);
    }
  };

  // エージェントの削除
  const removeParticipant = (index: number) => {
    if (participants.length > 2 && !activeSession) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  // エージェントの更新
  const updateParticipant = (index: number, field: keyof AgentConfig, value: string) => {
    if (!activeSession) {
      setParticipants(participants.map((p, i) => 
        i === index ? { ...p, [field]: value } : p
      ));
    }
  };

  return {
    // State
    activeSession,
    sessions,
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
    
    // Actions
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
    loadSessions,
  };
}