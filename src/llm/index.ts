import { LLMProvider } from './types';
import { OpenAIProvider } from './openai-provider';
import { ClaudeProvider } from './claude-provider';
import { useAppStore } from '../store';

// プロバイダーのインスタンスを管理
const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
};

// 現在のプロバイダーを取得
export function getCurrentProvider(): LLMProvider {
  const provider = useAppStore.getState().llmProvider;
  return providers[provider] || providers.openai;
}

// プロバイダーが設定されているか確認
export function isProviderConfigured(): boolean {
  return getCurrentProvider().isConfigured();
}