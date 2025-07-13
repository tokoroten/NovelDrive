import { LLMProvider, LLMMessage, LLMResponse, LLMTool } from './types';
import { useAppStore } from '../store';

export class ClaudeProvider implements LLMProvider {
  name = 'Claude';
  
  private getApiKey(): string | null {
    return useAppStore.getState().claudeApiKey;
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
    toolChoice: { type: 'function'; name: string }
  ): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Claude APIキーが設定されていません');
    }
    
    const model = this.getModel();
    
    // メッセージをClaude形式に変換
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');
    
    // Claude用のツール定義に変換
    const claudeTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessage?.content,
        messages: userMessages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        ...(toolChoice.type === 'function' ? {
          tools: claudeTools,
          tool_choice: {
            type: 'tool',
            name: toolChoice.name,
          },
        } : {}),
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Claude API Error: ${error.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    // レスポンスを共通フォーマットに変換
    const toolUse = data.content.find((c: { type: string }) => c.type === 'tool_use') as { input: unknown } | undefined;
    const output = toolUse ? [{
      type: 'function_call' as const,
      arguments: JSON.stringify(toolUse.input),
    }] : [];
    
    const textContent = data.content.find((c: { type: string }) => c.type === 'text') as { text: string } | undefined;
    
    return {
      output,
      output_text: textContent?.text,
      usage: data.usage ? {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  }
}