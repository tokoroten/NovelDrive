declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;

      // 設定関連
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };

      // DuckDB関連
      database: {
        query: (sql: string, params?: any[]) => Promise<any>;
        execute: (sql: string, params?: any[]) => Promise<any>;
      };

      // 日本語処理関連
      tokenizer: {
        tokenize: (text: string) => Promise<string[]>;
      };

      // ナレッジ管理
      knowledge: {
        save: (knowledge: any) => Promise<any>;
      };

      // ファイル操作
      file: {
        read: (path: string) => Promise<string>;
        write: (path: string, content: string) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
      };

      // AI関連
      ai: {
        chat: (messages: any[], options?: any) => Promise<string>;
        embed: (text: string) => Promise<number[] | null>;
        generateImage: (prompt: string, options?: any) => Promise<string>;
        extractInspiration: (text: string, type: string) => Promise<any>;
        extractContent: (html: string, url: string) => Promise<any>;
        createThread: (metadata?: any) => Promise<string>;
        addMessage: (threadId: string, content: string, role?: string) => Promise<string>;
        createAssistant: (
          name: string,
          instructions: string,
          model?: string,
          temperature?: number
        ) => Promise<string>;
        runAssistant: (
          threadId: string,
          assistantId: string,
          instructions?: string
        ) => Promise<any>;
        getThreadMessages: (threadId: string) => Promise<any>;
        deleteThread: (threadId: string) => Promise<void>;
      };

      // 検索関連
      search: {
        serendipity: (query: string, options?: any) => Promise<any>;
        hybrid: (query: string, options?: any) => Promise<any>;
        related: (itemId: string, options?: any) => Promise<any>;
      };

      // Webクローラー関連
      crawler: {
        crawl: (url: string, depth: number, options?: any) => Promise<any>;
      };

      // Anything Box関連
      anythingBox: {
        process: (input: any) => Promise<any>;
        history: (options?: any) => Promise<any>;
      };

      // エージェントシステム関連
      agents: {
        create: (options: any) => Promise<any>;
        startDiscussion: (options: any) => Promise<any>;
        pauseSession: (sessionId: string) => Promise<any>;
        resumeSession: (sessionId: string) => Promise<any>;
        getSession: (sessionId: string) => Promise<any>;
        getAllSessions: () => Promise<any>;
        getDiscussionHistory: (options?: any) => Promise<any>;
        requestWritingSuggestions: (context: any) => Promise<any>;
        onMessage: (callback: (data: any) => void) => void;
        onSessionStarted: (callback: (data: any) => void) => void;
        onSessionConcluded: (callback: (data: any) => void) => void;
      };

      // プロット管理関連
      plots: {
        create: (data: any) => Promise<any>;
        fork: (plotId: string, modifications: any) => Promise<any>;
        get: (plotId: string) => Promise<any>;
        history: (projectId: string) => Promise<any>;
        updateStatus: (plotId: string, status: string) => Promise<any>;
      };

      // チャプター管理関連
      chapters: {
        create: (chapter: any) => Promise<any>;
        update: (id: string, updates: any) => Promise<any>;
        delete: (id: string) => Promise<any>;
        get: (id: string) => Promise<any>;
        listByPlot: (plotId: string) => Promise<any[]>;
      };
    };
  }
}

export {};
