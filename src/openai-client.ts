import OpenAI from 'openai';
import { ResponsesAPIRequest, ResponsesAPIResponse } from './responses-api-types';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OpenAI API key is not set. Please set VITE_OPENAI_API_KEY in your .env file.');
}

// OpenAIクライアントを初期化
const openaiClient = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true // ブラウザからの直接使用を許可
});

// Responses APIをサポートする拡張クライアント
export const openai = Object.assign(openaiClient, {
  responses: {
    create: async (params: ResponsesAPIRequest): Promise<ResponsesAPIResponse> => {
      try {
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(params)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Responses API error:', error);
        throw error;
      }
    }
  }
});