export interface Agent {
  id: string;
  name: string;
  title: string; // 二つ名
  systemPrompt: string;
  avatar: string;
  canEdit: boolean; // 編集権限の有無
}

// 差分更新用の型
export interface DiffEdit {
  oldText: string;  // 置換対象のテキスト
  newText: string;  // 置換後のテキスト
}

export interface ConversationTurn {
  id: string;
  speaker: string; // "user" or agent id
  message: string;
  targetAgent?: string;
  timestamp: Date;
  isThinking?: boolean; // 考え中の状態
  documentAction?: {
    type: 'diff' | 'append' | 'request_edit';
    contents?: string[];         // appendの場合
    diffs?: DiffEdit[];          // diffの場合
    target_agent?: string | null;
  };
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
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
    type: 'diff' | 'append' | 'request_edit';
    contents?: string[];    // appendの場合
    diffs?: DiffEdit[];     // diffの場合
    content?: string;       // request_editの場合
    target_agent?: string | null; // request_editの場合、誰に編集を依頼するか
  } | null;
}