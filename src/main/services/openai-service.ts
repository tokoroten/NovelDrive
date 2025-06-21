import OpenAI from 'openai';
import { ipcMain } from 'electron';

let openai: OpenAI | null = null;

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
}

/**
 * APIキーを更新
 */
export function updateApiKey(apiKey: string): void {
  initializeOpenAI(apiKey);
}

/**
 * テキストからベクトル埋め込みを生成
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
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
  
  try {
    const response = await openai.chat.completions.create({
      model: options?.model || 'gpt-4-turbo-preview',
      messages: messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      top_p: options?.topP ?? 1.0,
    });
    
    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Failed to generate chat completion:', error);
    throw error;
  }
}

/**
 * HTMLからメインコンテンツを抽出
 */
export async function extractMainContent(html: string, url: string): Promise<{
  title: string;
  content: string;
  summary: string;
  metadata: Record<string, any>;
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
        { role: 'user', content: `URL: ${url}\n\nHTML:\n${html.slice(0, 50000)}` }
      ],
      {
        temperature: 0.3,
        model: 'gpt-4-turbo-preview'
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
      metadata: { url }
    };
  }
}

/**
 * 画像を生成
 */
export async function generateImage(prompt: string, options?: {
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
}): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client not initialized. Please set API key in settings.');
  }
  
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: options?.size || '1024x1024',
      quality: options?.quality || 'standard',
      style: options?.style || 'vivid',
    });
    
    return response.data?.[0]?.url || '';
  } catch (error) {
    console.error('Failed to generate image:', error);
    throw error;
  }
}

/**
 * テキストからインスピレーションを抽出
 */
export async function extractInspiration(text: string, type: string): Promise<{
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
        { role: 'user', content: text }
      ],
      {
        temperature: 0.8,
        model: 'gpt-4-turbo-preview'
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
      scenes: []
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
  
  try {
    const thread = await openai.beta.threads.create({
      metadata,
    });
    return thread.id;
  } catch (error) {
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
  
  try {
    // Runを作成
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
      instructions,
    });
    
    // Runの完了を待つ
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      
      if (runStatus.status === 'failed') {
        throw new Error(`Assistant run failed: ${runStatus.last_error?.message}`);
      }
    }
    
    // メッセージを取得
    const messages = await openai.beta.threads.messages.list(threadId);
    return messages.data;
  } catch (error) {
    console.error('Failed to run assistant:', error);
    throw error;
  }
}

/**
 * スレッドのメッセージを取得
 */
export async function getThreadMessages(threadId: string): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
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
  
  ipcMain.handle('ai:addMessage', async (_, threadId: string, content: string, role?: 'user' | 'assistant') => {
    return addMessageToThread(threadId, content, role);
  });
  
  ipcMain.handle('ai:createAssistant', async (_, name: string, instructions: string, model?: string, temperature?: number) => {
    return createAssistant(name, instructions, model, temperature);
  });
  
  ipcMain.handle('ai:runAssistant', async (_, threadId: string, assistantId: string, instructions?: string) => {
    return runAssistant(threadId, assistantId, instructions);
  });
  
  ipcMain.handle('ai:getThreadMessages', async (_, threadId: string) => {
    return getThreadMessages(threadId);
  });
  
  ipcMain.handle('ai:deleteThread', async (_, threadId: string) => {
    return deleteThread(threadId);
  });
}