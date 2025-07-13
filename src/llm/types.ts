// LLMプロバイダーの共通インターフェース
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMFunctionCall {
  name: string;
  arguments: string;
}

export interface LLMResponse {
  output: Array<{
    type: 'function_call';
    arguments: string;
  }>;
  output_text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Tool定義の型
export interface LLMTool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties?: boolean;
  };
  strict?: boolean;
}

export interface LLMProvider {
  // プロバイダー名
  name: string;
  
  // APIキーが設定されているか確認
  isConfigured(): boolean;
  
  // Function Callingを使った応答生成
  createResponse(
    messages: LLMMessage[],
    tools: LLMTool[],
    toolChoice: { type: 'function'; name: string } | { type: 'none' }
  ): Promise<LLMResponse>;
}