export interface Agent {
  id: string;
  name: string;
  title: string; // 二つ名
  systemPrompt: string;
  avatar: string;
  canEdit: boolean; // 編集権限の有無
}

export interface ConversationTurn {
  id: string;
  speaker: string; // "user" or agent id
  message: string;
  targetAgent?: string;
  timestamp: Date;
  isThinking?: boolean; // 考え中の状態
  documentAction?: {
    type: 'edit' | 'append' | 'request_edit';
    content?: string;
    target_agent?: string;
  };
}

export interface AgentResponse {
  speaker: string;
  message: string;
  next_speaker: {
    type: 'specific' | 'random' | 'user';
    agent: string | null;
  };
  document_action: {
    type: 'edit' | 'append' | 'request_edit';
    content: string | null;
    target_agent: string | null; // request_editの場合、誰に編集を依頼するか
  } | null;
}