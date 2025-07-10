export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  avatar: string;
}

export interface ConversationTurn {
  id: string;
  speaker: string; // "user" or agent id
  message: string;
  targetAgent?: string;
  responseId?: string;
  timestamp: Date;
}

export interface AgentResponse {
  speaker: string;
  message: string;
  next_speaker: {
    type: "specific" | "random" | "user";
    agent?: string;
  };
}