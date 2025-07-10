import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('OpenAI API key is not set. Please set VITE_OPENAI_API_KEY in your .env file.');
}

export const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true // ブラウザからの直接使用を許可
});