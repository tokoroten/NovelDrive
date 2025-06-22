/**
 * AIテキスト生成サービス
 * 文章生成に関する機能を提供
 */

import { ICompletionService } from './interfaces';

export interface TextGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  style?: string;
  tone?: string;
  constraints?: string[];
}

export class AITextGenerator {
  constructor(private completionService: ICompletionService) {}

  /**
   * 文章を生成
   */
  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(options);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    return this.completionService.complete(messages, {
      temperature: options.temperature ?? 0.8,
      maxTokens: options.maxTokens ?? 2000
    });
  }

  /**
   * 文章を改善
   */
  async improveText(
    originalText: string,
    instructions: string,
    options: TextGenerationOptions = {}
  ): Promise<string> {
    const prompt = `以下の文章を、指示に従って改善してください。

【元の文章】
${originalText}

【改善指示】
${instructions}

改善した文章のみを出力してください。`;

    return this.generateText(prompt, options);
  }

  /**
   * 文章を要約
   */
  async summarizeText(
    text: string,
    maxLength?: number,
    options: TextGenerationOptions = {}
  ): Promise<string> {
    const lengthInstruction = maxLength 
      ? `${maxLength}文字以内で` 
      : '簡潔に';

    const prompt = `以下の文章を${lengthInstruction}要約してください。

【文章】
${text}

要約のみを出力してください。`;

    return this.generateText(prompt, {
      ...options,
      temperature: options.temperature ?? 0.3
    });
  }

  /**
   * アイデアを展開
   */
  async expandIdea(
    idea: string,
    direction?: string,
    options: TextGenerationOptions = {}
  ): Promise<string> {
    const prompt = `以下のアイデアを${direction || '創造的に'}展開してください。

【アイデア】
${idea}

展開した内容を詳細に説明してください。`;

    return this.generateText(prompt, {
      ...options,
      temperature: options.temperature ?? 0.9
    });
  }

  /**
   * システムプロンプトを構築
   */
  private buildSystemPrompt(options: TextGenerationOptions): string {
    let prompt = 'あなたは創造的な文章生成アシスタントです。';

    if (options.style) {
      prompt += `\n文体: ${options.style}`;
    }

    if (options.tone) {
      prompt += `\nトーン: ${options.tone}`;
    }

    if (options.constraints && options.constraints.length > 0) {
      prompt += '\n\n制約条件:';
      options.constraints.forEach(constraint => {
        prompt += `\n- ${constraint}`;
      });
    }

    return prompt;
  }
}