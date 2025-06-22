/**
 * OpenAI Completion サービス
 */

import OpenAI from 'openai';
import { ICompletionService } from './interfaces';
import { retry } from '../core/async/retry';

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export class OpenAICompletionService implements ICompletionService {
  private openai: OpenAI;
  private defaultModel = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async complete(
    messages: Array<{ role: string; content: string }>,
    options: CompletionOptions = {}
  ): Promise<string> {
    return retry(async () => {
      const response = await this.openai.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: messages as any,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 1,
        frequency_penalty: options.frequencyPenalty ?? 0,
        presence_penalty: options.presencePenalty ?? 0,
        stop: options.stop
      });

      return response.choices[0]?.message?.content || '';
    }, {
      maxAttempts: 3,
      initialDelay: 1000,
      shouldRetry: (error) => {
        const message = error?.message || '';
        return message.includes('rate_limit') || 
               message.includes('timeout') ||
               message.includes('network');
      }
    });
  }

  async stream(
    messages: Array<{ role: string; content: string }>,
    options: CompletionOptions = {},
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const stream = await this.openai.chat.completions.create({
      model: options.model || this.defaultModel,
      messages: messages as any,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
      stop: options.stop,
      stream: true
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    return fullContent;
  }

  setModel(model: string): void {
    this.defaultModel = model;
  }

  getModel(): string {
    return this.defaultModel;
  }
}