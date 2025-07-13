import { ConversationTurn } from '../types';

// セッション（作品）の型定義
export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  documentContent: string;
  conversation: ConversationTurn[];
  activeAgentIds: string[];
  metadata?: {
    totalTokens?: number;
    characterCount?: number;
    [key: string]: unknown;
  };
}

// ドキュメントのバージョン履歴
export interface DocumentVersion {
  id: string;
  sessionId: string;
  content: string;
  timestamp: Date;
  editedBy: string; // agent id or 'user'
  editAction?: {
    type: 'append' | 'diff' | 'manual';
    details?: unknown;
  };
}

// データベースのスキーマ
export interface NovelDriveDB {
  sessions: Session;
  documentVersions: DocumentVersion;
}