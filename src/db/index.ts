import Dexie, { Table } from 'dexie';
import { Session, DocumentVersion } from './schema';

class NovelDriveDatabase extends Dexie {
  sessions!: Table<Session>;
  documentVersions!: Table<DocumentVersion>;

  constructor() {
    super('NovelDriveDB');
    
    this.version(1).stores({
      sessions: 'id, createdAt, updatedAt, title',
      documentVersions: 'id, sessionId, timestamp',
    });
  }
}

// データベースのインスタンスを作成
export const db = new NovelDriveDatabase();

// 現在のセッションを管理するサービス
class SessionService {
  private currentSessionId: string | null = null;

  // 新しいセッションを作成
  async createSession(title?: string): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      title: title || `新しい作品 ${new Date().toLocaleDateString('ja-JP')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      documentContent: '',
      conversation: [],
      activeAgentIds: [],
    };

    await db.sessions.add(session);
    this.currentSessionId = session.id;
    return session;
  }

  // セッションを取得
  async getSession(id: string): Promise<Session | undefined> {
    return await db.sessions.get(id);
  }

  // すべてのセッションを取得（最新順）
  async getAllSessions(): Promise<Session[]> {
    return await db.sessions.orderBy('updatedAt').reverse().toArray();
  }

  // セッションを更新
  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    await db.sessions.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  // 現在のセッションIDを取得
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  // 現在のセッションIDを設定
  setCurrentSessionId(id: string | null): void {
    this.currentSessionId = id;
  }

  // セッションを削除
  async deleteSession(id: string): Promise<void> {
    // 関連するドキュメントバージョンも削除
    await db.documentVersions.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
    
    if (this.currentSessionId === id) {
      this.currentSessionId = null;
    }
  }

  // ドキュメントバージョンを保存
  async saveDocumentVersion(
    sessionId: string,
    content: string,
    editedBy: string,
    editAction?: DocumentVersion['editAction']
  ): Promise<void> {
    const version: DocumentVersion = {
      id: crypto.randomUUID(),
      sessionId,
      content,
      timestamp: new Date(),
      editedBy,
      editAction,
    };

    await db.documentVersions.add(version);
  }

  // セッションのドキュメントバージョン履歴を取得
  async getDocumentVersions(sessionId: string): Promise<DocumentVersion[]> {
    return await db.documentVersions
      .where('sessionId')
      .equals(sessionId)
      .sortBy('timestamp');
  }

  // 特定のバージョンを復元
  async restoreDocumentVersion(sessionId: string, versionId: string): Promise<void> {
    const version = await db.documentVersions.get(versionId);
    if (!version || version.sessionId !== sessionId) {
      throw new Error('Version not found or does not belong to this session');
    }

    await this.updateSession(sessionId, {
      documentContent: version.content,
    });

    // 復元アクションとして新しいバージョンを保存
    await this.saveDocumentVersion(
      sessionId,
      version.content,
      'user',
      { type: 'manual', details: { restoredFromVersion: versionId } }
    );
  }
}

export const sessionService = new SessionService();