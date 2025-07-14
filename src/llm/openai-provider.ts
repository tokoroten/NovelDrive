import { LLMProvider, LLMMessage, LLMResponse, LLMTool } from './types';
import { useAppStore } from '../store';

export class OpenAIProvider implements LLMProvider {
  name = 'OpenAI';
  
  private getApiKey(): string | null {
    return useAppStore.getState().openAIApiKey;
  }
  
  private getModel(): string {
    return useAppStore.getState().llmModel;
  }
  
  isConfigured(): boolean {
    return !!this.getApiKey();
  }
  
  async createResponse(
    messages: LLMMessage[],
    tools: LLMTool[],
    toolChoice: { type: 'function'; name: string } | { type: 'none' }
  ): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }
    
    const model = this.getModel();
    console.log('🔍 OpenAIProvider - Using model:', model);
    console.log('🔍 OpenAIProvider - Current store model:', useAppStore.getState().llmModel);
    
    // OpenAI APIを直接呼び出す（openaiライブラリが古いため）
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(toolChoice.type === 'function' ? {
          tools: tools.map(tool => ({
            type: 'function',
            function: tool
          })),
          tool_choice: {
            type: 'function',
            function: { name: toolChoice.name }
          },
        } : {}),
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ OpenAI API Error - Request model:', model);
      console.error('❌ OpenAI API Error - Response:', error);
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    // レスポンスを共通フォーマットに変換
    const toolCalls = data.choices[0].message.tool_calls;
    const output = toolCalls ? toolCalls.map((call: { function: { arguments: string } }) => ({
      type: 'function_call' as const,
      arguments: call.function.arguments,
    })) : [];
    
    return {
      output,
      output_text: data.choices[0].message.content,
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined,
    };
  }
}