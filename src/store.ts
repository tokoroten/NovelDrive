import { create } from 'zustand';
import { ConversationTurn } from './types';
import { defaultActiveAgents } from './agents';

interface AppState {
  // 会話関連
  conversation: ConversationTurn[];
  setConversation: (conversation: ConversationTurn[]) => void;
  addConversationTurn: (turn: ConversationTurn) => void;
  updateConversation: (updater: (prev: ConversationTurn[]) => ConversationTurn[]) => void;

  // エージェント関連
  activeAgentIds: string[];
  setActiveAgentIds: (ids: string[]) => void;
  toggleAgent: (agentId: string) => void;

  // ドキュメント関連
  documentContent: string;
  setDocumentContent: (content: string) => void;

  // UI状態
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  waitingForUser: boolean;
  setWaitingForUser: (waiting: boolean) => void;
  userTimeoutSeconds: number;
  setUserTimeoutSeconds: (seconds: number) => void;
  observerMode: boolean;
  setObserverMode: (mode: boolean) => void;
  agentDelay: number;
  setAgentDelay: (delay: number) => void;
  thinkingAgentId: string | null;
  setThinkingAgentId: (id: string | null) => void;
  queueLength: number;
  setQueueLength: (length: number) => void;
  showAgentManager: boolean;
  setShowAgentManager: (show: boolean) => void;

  // ユーザー入力
  userInput: string;
  setUserInput: (input: string) => void;
  targetAgent: string;
  setTargetAgent: (agent: string) => void;
}

// LocalStorageから初期値を読み込む関数
const loadFromLocalStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  const saved = localStorage.getItem(key);
  if (!saved) return defaultValue;
  
  try {
    return JSON.parse(saved);
  } catch {
    return defaultValue;
  }
};

// LocalStorageに保存する関数
const saveToLocalStorage = <T>(key: string, value: T) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Zustandストアの作成
export const useAppStore = create<AppState>((set) => ({
  // 会話関連
  conversation: [],
  setConversation: (conversation) => set({ conversation }),
  addConversationTurn: (turn) => set((state) => ({ 
    conversation: [...state.conversation, turn] 
  })),
  updateConversation: (updater) => set((state) => ({ 
    conversation: updater(state.conversation) 
  })),

  // エージェント関連
  activeAgentIds: (() => {
    const saved = loadFromLocalStorage<string[]>('noveldrive-active-agents', defaultActiveAgents);
    // 保存されたエージェントIDが有効かチェック
    const validIds = saved.filter((id: string) => {
      const allAgents = [
        { id: 'hoshi_shinichi' },
        { id: 'editor' },
        { id: 'critic' },
        { id: 'poet' },
        { id: 'philosopher' },
        { id: 'worldbuilder' },
        { id: 'psychologist' },
        { id: 'reader' },
        { id: 'murakami' },
        { id: 'poe' },
        { id: 'borges' }
      ];
      return allAgents.some(agent => agent.id === id);
    });
    return validIds.length > 0 ? validIds : defaultActiveAgents;
  })(),
  setActiveAgentIds: (ids) => {
    saveToLocalStorage('noveldrive-active-agents', ids);
    set({ activeAgentIds: ids });
  },
  toggleAgent: (agentId) => set((state) => {
    const newIds = state.activeAgentIds.includes(agentId)
      ? state.activeAgentIds.length > 1 
        ? state.activeAgentIds.filter(id => id !== agentId)
        : state.activeAgentIds
      : [...state.activeAgentIds, agentId];
    
    saveToLocalStorage('noveldrive-active-agents', newIds);
    return { activeAgentIds: newIds };
  }),

  // ドキュメント関連
  documentContent: loadFromLocalStorage(
    'noveldrive-document', 
    '# 小説のタイトル\n\n第1章\n\nここに物語を書き始めてください...'
  ),
  setDocumentContent: (content) => {
    saveToLocalStorage('noveldrive-document', content);
    set({ documentContent: content });
  },

  // UI状態
  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),
  waitingForUser: false,
  setWaitingForUser: (waiting) => set({ waitingForUser: waiting }),
  userTimeoutSeconds: 30,
  setUserTimeoutSeconds: (seconds) => set({ userTimeoutSeconds: seconds }),
  observerMode: false,
  setObserverMode: (mode) => set({ observerMode: mode }),
  agentDelay: 0,
  setAgentDelay: (delay) => set({ agentDelay: delay }),
  thinkingAgentId: null,
  setThinkingAgentId: (id) => set({ thinkingAgentId: id }),
  queueLength: 0,
  setQueueLength: (length) => set({ queueLength: length }),
  showAgentManager: false,
  setShowAgentManager: (show) => set({ showAgentManager: show }),

  // ユーザー入力
  userInput: '',
  setUserInput: (input) => set({ userInput: input }),
  targetAgent: 'random',
  setTargetAgent: (agent) => set({ targetAgent: agent }),
}));