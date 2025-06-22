import OpenAI from 'openai';
import { ipcMain } from 'electron';
import dotenv from 'dotenv';
import { getApiUsageLogger, ApiUsageLog } from './api-usage-logger';
import { initializePlotGenerationWorkflow } from './service-initializer';
import { getDatabase } from '../database';

// Load environment variables
dotenv.config();

let openai: OpenAI | null = null;

// Auto-initialize from environment if available
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * OpenAI APIクライアントを初期化
 */
export function initializeOpenAI(apiKey: string): void {
  if (!apiKey) {
    console.warn('OpenAI API key not provided');
    return;
  }

  openai = new OpenAI({
    apiKey: apiKey,
  });

  // OpenAIが初期化されたら、依存するサービスを初期化
  tryInitializeDependentServices();
}

/**
 * OpenAIに依存するサービスの初期化を試行
 */
function tryInitializeDependentServices(): void {
  if (!openai) return;

  try {
    const db = getDatabase();
    const apiLogger = getApiUsageLogger();
    
    if (db && apiLogger) {
      const conn = db.connect();
      initializePlotGenerationWorkflow(openai, conn, apiLogger);
    }
  } catch (error) {
    console.error('Failed to initialize dependent services:', error);
  }
}

/**
 * APIキーを更新
 */
export function updateApiKey(apiKey: string): void {
  initializeOpenAI(apiKey);
}

/**
 * OpenAIクライアントのインスタンスを取得
 */
export function getOpenAI(): OpenAI | null {
  return openai;
}

/**
 * テキストからベクトル埋め込みを生成
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  const startTime = Date.now();
  const logger = getApiUsageLogger();
  const model = 'text-embedding-3-small';
  
  const logData: ApiUsageLog = {
    apiType: 'embedding',
    provider: 'openai',
    model,
    operation: 'generateEmbedding',
    status: 'success',
    requestData: { text: text.substring(0, 100) } // 最初の100文字のみログに記録
  };

  try {
    const response = await openai.embeddings.create({
      model,
      input: text,
    });

    // トークン数を計算（概算）
    const inputTokens = Math.ceil(text.length / 4);
    
    logData.inputTokens = inputTokens;
    logData.totalTokens = inputTokens;
    logData.durationMs = Date.now() - startTime;
    logData.responseData = { 
      dimensions: response.data[0].embedding.length,
      model: response.model,
      usage: response.usage
    };
    
    // 使用状況をログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API usage:', err)
    );

    return response.data[0].embedding;
  } catch (error) {
    logData.status = 'error';
    logData.errorMessage = error instanceof Error ? error.message : String(error);
    logData.durationMs = Date.now() - startTime;
    
    // エラーをログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API error:', err)
    );
    
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * チャット完了を生成
 */
export async function generateChatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  const startTime = Date.now();
  const logger = getApiUsageLogger();
  const model = options?.model || 'gpt-4-turbo-preview';
  
  const logData: ApiUsageLog = {
    apiType: 'chat',
    provider: 'openai',
    model,
    operation: 'generateChatCompletion',
    status: 'success',
    requestData: {
      messageCount: messages.length,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens,
      topP: options?.topP ?? 1.0
    }
  };

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP ?? 1.0,
    });

    // トークン使用量を記録
    if (response.usage) {
      logData.inputTokens = response.usage.prompt_tokens;
      logData.outputTokens = response.usage.completion_tokens;
      logData.totalTokens = response.usage.total_tokens;
    }
    
    logData.durationMs = Date.now() - startTime;
    logData.responseData = {
      model: response.model,
      finishReason: response.choices[0].finish_reason,
      usage: response.usage
    };
    
    // 使用状況をログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API usage:', err)
    );

    return response.choices[0].message.content || '';
  } catch (error) {
    logData.status = 'error';
    logData.errorMessage = error instanceof Error ? error.message : String(error);
    logData.durationMs = Date.now() - startTime;
    
    // エラーをログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API error:', err)
    );
    
    console.error('Failed to generate chat completion:', error);
    throw error;
  }
}

/**
 * HTMLからメインコンテンツを抽出
 */
export async function extractMainContent(
  html: string,
  url: string
): Promise<{
  title: string;
  content: string;
  summary: string;
  metadata: Record<string, unknown>;
}> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  const systemPrompt = `あなたはWebページの内容を分析し、メインコンテンツを抽出する専門家です。
HTMLから以下を抽出してください：
1. ページのメインタイトル
2. 本文コンテンツ（ヘッダー、フッター、ナビゲーション、広告を除く）
3. 200文字程度の要約
4. メタデータ（著者、公開日、カテゴリなど）

レスポンスは必ず以下のJSON形式で返してください：
{
  "title": "ページタイトル",
  "content": "メインコンテンツのテキスト",
  "summary": "200文字程度の要約",
  "metadata": {
    "author": "著者名",
    "publishedDate": "公開日",
    "category": "カテゴリ",
    "tags": ["タグ1", "タグ2"]
  }
}`;

  try {
    const response = await generateChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `URL: ${url}\n\nHTML:\n${html.slice(0, 50000)}` },
      ],
      {
        temperature: 0.3,
        model: 'gpt-4-turbo-preview',
      }
    );

    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to extract main content:', error);
    // フォールバック処理
    return {
      title: 'Unknown',
      content: html.replace(/<[^>]*>/g, '').slice(0, 5000),
      summary: '',
      metadata: { url },
    };
  }
}

/**
 * 画像を生成
 */
export async function generateImage(
  prompt: string,
  options?: {
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
  }
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  const startTime = Date.now();
  const logger = getApiUsageLogger();
  const model = 'dall-e-3';
  const size = options?.size || '1024x1024';
  const quality = options?.quality || 'standard';
  
  const logData: ApiUsageLog = {
    apiType: 'image',
    provider: 'openai',
    model,
    operation: 'generateImage',
    status: 'success',
    requestData: {
      prompt: prompt.substring(0, 100), // 最初の100文字のみログに記録
      size,
      quality,
      style: options?.style || 'vivid'
    },
    metadata: { size, quality }
  };

  try {
    const response = await openai.images.generate({
      model,
      prompt: prompt,
      n: 1,
      size,
      quality,
      style: options?.style || 'vivid',
    });

    logData.durationMs = Date.now() - startTime;
    logData.responseData = {
      revised_prompt: response.data?.[0]?.revised_prompt,
      hasUrl: !!response.data?.[0]?.url
    };
    
    // 使用状況をログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API usage:', err)
    );

    return response.data?.[0]?.url || '';
  } catch (error) {
    logData.status = 'error';
    logData.errorMessage = error instanceof Error ? error.message : String(error);
    logData.durationMs = Date.now() - startTime;
    
    // エラーをログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API error:', err)
    );
    
    console.error('Failed to generate image:', error);
    throw error;
  }
}

/**
 * テキストからインスピレーションを抽出
 */
export async function extractInspiration(
  text: string,
  type: string
): Promise<{
  keywords: string[];
  themes: string[];
  emotions: string[];
  plotSeeds: string[];
  characters: Array<{ name: string; role: string; description: string }>;
  scenes: string[];
}> {
  const systemPrompt = `あなたは創造的な小説家のアシスタントです。
与えられたテキストから小説創作のインスピレーションを抽出してください。
テキストのタイプは「${type}」です。

以下のJSON形式で回答してください：
{
  "keywords": ["重要なキーワード"],
  "themes": ["物語のテーマになりそうな要素"],
  "emotions": ["感情や雰囲気"],
  "plotSeeds": ["プロットのアイデア"],
  "characters": [
    {"name": "キャラクター名", "role": "役割", "description": "簡単な説明"}
  ],
  "scenes": ["印象的なシーンのアイデア"]
}`;

  try {
    const response = await generateChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      {
        temperature: 0.8,
        model: 'gpt-4-turbo-preview',
      }
    );

    return JSON.parse(response);
  } catch (error) {
    console.error('Failed to extract inspiration:', error);
    return {
      keywords: [],
      themes: [],
      emotions: [],
      plotSeeds: [],
      characters: [],
      scenes: [],
    };
  }
}

/**
 * スレッドを作成
 */
export async function createThread(metadata?: Record<string, any>): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  const startTime = Date.now();
  const logger = getApiUsageLogger();
  
  const logData: ApiUsageLog = {
    apiType: 'thread',
    provider: 'openai',
    operation: 'createThread',
    status: 'success',
    requestData: { metadata }
  };

  try {
    const thread = await openai.beta.threads.create({
      metadata,
    });
    
    logData.durationMs = Date.now() - startTime;
    logData.responseData = { threadId: thread.id };
    
    // 使用状況をログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API usage:', err)
    );
    
    return thread.id;
  } catch (error) {
    logData.status = 'error';
    logData.errorMessage = error instanceof Error ? error.message : String(error);
    logData.durationMs = Date.now() - startTime;
    
    // エラーをログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API error:', err)
    );
    
    console.error('Failed to create thread:', error);
    throw error;
  }
}

/**
 * スレッドにメッセージを追加
 */
export async function addMessageToThread(
  threadId: string,
  content: string,
  role: 'user' | 'assistant' = 'user'
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  try {
    const message = await openai.beta.threads.messages.create(threadId, {
      role,
      content,
    });
    return message.id;
  } catch (error) {
    console.error('Failed to add message to thread:', error);
    throw error;
  }
}

/**
 * アシスタントを作成
 */
export async function createAssistant(
  name: string,
  instructions: string,
  model: string = 'gpt-4-turbo-preview',
  temperature: number = 0.7
): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  try {
    const assistant = await openai.beta.assistants.create({
      name,
      instructions,
      model,
      temperature,
    });
    return assistant.id;
  } catch (error) {
    console.error('Failed to create assistant:', error);
    throw error;
  }
}

/**
 * スレッドでアシスタントを実行
 */
export async function runAssistant(
  threadId: string,
  assistantId: string,
  instructions?: string
): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  const startTime = Date.now();
  const logger = getApiUsageLogger();
  
  const logData: ApiUsageLog = {
    apiType: 'assistant',
    provider: 'openai',
    operation: 'runAssistant',
    status: 'success',
    requestData: { threadId, assistantId, hasInstructions: !!instructions }
  };

  try {
    // Runを作成
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      instructions,
    });

    // Runの完了を待つ
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

      if (runStatus.status === 'failed') {
        throw new Error(`Assistant run failed: ${runStatus.last_error?.message}`);
      }
    }

    // メッセージを取得
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // 使用状況を記録（Assistants APIはトークン使用量を提供する場合がある）
    if (runStatus.usage) {
      logData.inputTokens = runStatus.usage.prompt_tokens;
      logData.outputTokens = runStatus.usage.completion_tokens;
      logData.totalTokens = runStatus.usage.total_tokens;
    }
    
    logData.durationMs = Date.now() - startTime;
    logData.responseData = {
      runId: run.id,
      status: runStatus.status,
      messageCount: messages.data.length,
      usage: runStatus.usage
    };
    
    // 使用状況をログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API usage:', err)
    );
    
    return messages.data;
  } catch (error) {
    logData.status = 'error';
    logData.errorMessage = error instanceof Error ? error.message : String(error);
    logData.durationMs = Date.now() - startTime;
    
    // エラーをログに記録
    await logger.log(logData).catch(err => 
      console.error('Failed to log API error:', err)
    );
    
    console.error('Failed to run assistant:', error);
    throw error;
  }
}

/**
 * スレッドのメッセージを取得
 */
export async function getThreadMessages(
  threadId: string
): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  try {
    const messages = await openai.beta.threads.messages.list(threadId);
    return messages.data;
  } catch (error) {
    console.error('Failed to get thread messages:', error);
    throw error;
  }
}

/**
 * スレッドを削除
 */
export async function deleteThread(threadId: string): Promise<void> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }

  try {
    await openai.beta.threads.del(threadId);
  } catch (error) {
    console.error('Failed to delete thread:', error);
    throw error;
  }
}

/**
 * IPCハンドラーの設定
 */
export function setupOpenAIHandlers(): void {
  // 埋め込み生成
  ipcMain.handle('ai:embed', async (_, text: string) => {
    return generateEmbedding(text);
  });

  // チャット
  ipcMain.handle('ai:chat', async (_, messages: any[], options?: any) => {
    return generateChatCompletion(messages, options);
  });

  // 画像生成
  ipcMain.handle('ai:generateImage', async (_, prompt: string, options?: any) => {
    return generateImage(prompt, options);
  });

  // インスピレーション抽出
  ipcMain.handle('ai:extractInspiration', async (_, text: string, type: string) => {
    return extractInspiration(text, type);
  });

  // HTMLコンテンツ抽出
  ipcMain.handle('ai:extractContent', async (_, html: string, url: string) => {
    return extractMainContent(html, url);
  });

  // Thread API関連
  ipcMain.handle('ai:createThread', async (_, metadata?: Record<string, any>) => {
    return createThread(metadata);
  });

  ipcMain.handle(
    'ai:addMessage',
    async (_, threadId: string, content: string, role?: 'user' | 'assistant') => {
      return addMessageToThread(threadId, content, role);
    }
  );

  ipcMain.handle(
    'ai:createAssistant',
    async (_, name: string, instructions: string, model?: string, temperature?: number) => {
      return createAssistant(name, instructions, model, temperature);
    }
  );

  ipcMain.handle(
    'ai:runAssistant',
    async (_, threadId: string, assistantId: string, instructions?: string) => {
      return runAssistant(threadId, assistantId, instructions);
    }
  );

  ipcMain.handle('ai:getThreadMessages', async (_, threadId: string) => {
    return getThreadMessages(threadId);
  });

  ipcMain.handle('ai:deleteThread', async (_, threadId: string) => {
    return deleteThread(threadId);
  });
}
