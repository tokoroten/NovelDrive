// OpenAI Responses API用の型定義

export interface ResponsesAPIRequest {
  model: string;
  input: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, any>;
    strict?: boolean;
  }>;
  tool_choice?: {
    type: 'function';
    name: string;
  } | 'auto' | 'required' | 'none';
}

export interface FunctionCall {
  id: string;
  call_id: string;
  type: 'function_call';
  name: string;
  arguments: string;
}

export interface ResponsesAPIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  output: FunctionCall[];
  output_text?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}