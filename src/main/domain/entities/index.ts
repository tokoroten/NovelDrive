/**
 * ドメインエンティティ定義
 * ビジネスロジックの中核となるエンティティ
 */

/**
 * 知識エンティティ
 */
export class Knowledge {
  constructor(
    public readonly id: string,
    public title: string,
    public content: string,
    public type: KnowledgeType,
    public projectId: string | null,
    public embedding: number[] | null,
    public metadata: Record<string, any>,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  update(updates: Partial<Pick<Knowledge, 'title' | 'content' | 'type' | 'metadata'>>) {
    if (updates.title !== undefined) this.title = updates.title;
    if (updates.content !== undefined) this.content = updates.content;
    if (updates.type !== undefined) this.type = updates.type;
    if (updates.metadata !== undefined) this.metadata = { ...this.metadata, ...updates.metadata };
    this.updatedAt = new Date();
  }

  setEmbedding(embedding: number[]) {
    this.embedding = embedding;
    this.updatedAt = new Date();
  }
}

export type KnowledgeType = 'note' | 'article' | 'social' | 'inspiration' | 'character' | 'world';

/**
 * プロットエンティティ
 */
export class Plot {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public version: string,
    public parentVersion: string | null,
    public title: string,
    public synopsis: string,
    public structure: PlotStructure,
    public status: PlotStatus,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public readonly createdBy: string
  ) {}

  updateStatus(status: PlotStatus) {
    this.status = status;
    this.updatedAt = new Date();
  }

  updateContent(updates: Partial<Pick<Plot, 'title' | 'synopsis' | 'structure'>>) {
    if (updates.title !== undefined) this.title = updates.title;
    if (updates.synopsis !== undefined) this.synopsis = updates.synopsis;
    if (updates.structure !== undefined) this.structure = updates.structure;
    this.updatedAt = new Date();
  }
}

export type PlotStatus = 'draft' | 'reviewing' | 'approved' | 'rejected';

export interface PlotStructure {
  acts: Act[];
  totalChapters: number;
  estimatedLength: number;
  genre: string;
  themes: string[];
  mainConflict: string;
  resolution: string;
}

export interface Act {
  actNumber: number;
  title: string;
  chapters: Chapter[];
  purpose: string;
  keyEvents: string[];
}

export interface Chapter {
  chapterNumber: number;
  title: string;
  summary: string;
  scenes: Scene[];
  characters: string[];
  estimatedLength: number;
  emotionalTone: EmotionalTone;
}

export interface Scene {
  sceneNumber: number;
  location: string;
  time: string;
  description: string;
  dialoguePlaceholders?: DialoguePlaceholder[];
}

export interface DialoguePlaceholder {
  character: string;
  intention: string;
  context?: string;
}

export type EmotionalTone = 'positive' | 'negative' | 'neutral' | 'mixed';

/**
 * プロジェクトエンティティ
 */
export class Project {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string,
    public genre: string,
    public targetAudience: string,
    public writingStyle: string,
    public themes: string[],
    public metadata: Record<string, any>,
    public status: string,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  update(updates: Partial<Pick<Project, 'name' | 'description' | 'genre' | 'targetAudience' | 'writingStyle' | 'themes' | 'metadata' | 'status'>>) {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.description !== undefined) this.description = updates.description;
    if (updates.genre !== undefined) this.genre = updates.genre;
    if (updates.targetAudience !== undefined) this.targetAudience = updates.targetAudience;
    if (updates.writingStyle !== undefined) this.writingStyle = updates.writingStyle;
    if (updates.themes !== undefined) this.themes = updates.themes;
    if (updates.metadata !== undefined) this.metadata = updates.metadata;
    if (updates.status !== undefined) this.status = updates.status;
    this.updatedAt = new Date();
  }
}

/**
 * キャラクターエンティティ
 */
export class Character {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public name: string,
    public role: string,
    public age: number | null,
    public gender: string | null,
    public personality: Record<string, any>,
    public background: string,
    public appearance: Record<string, any>,
    public relationships: CharacterRelationship[],
    public metadata: Record<string, any>,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  updateProfile(updates: Partial<Pick<Character, 'name' | 'role' | 'age' | 'gender' | 'personality' | 'background' | 'appearance' | 'metadata'>>) {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.role !== undefined) this.role = updates.role;
    if (updates.age !== undefined) this.age = updates.age;
    if (updates.gender !== undefined) this.gender = updates.gender;
    if (updates.personality !== undefined) this.personality = updates.personality;
    if (updates.background !== undefined) this.background = updates.background;
    if (updates.appearance !== undefined) this.appearance = updates.appearance;
    if (updates.metadata !== undefined) this.metadata = updates.metadata;
    this.updatedAt = new Date();
  }

  addRelationship(relationship: CharacterRelationship) {
    this.relationships.push(relationship);
    this.updatedAt = new Date();
  }
}

export interface CharacterRelationship {
  characterId: string;
  type: string;
  description: string;
}

/**
 * 世界設定エンティティ
 */
export class WorldSetting {
  constructor(
    public readonly id: string,
    public readonly projectId: string,
    public name: string,
    public category: string,
    public description: string,
    public rules: string[],
    public metadata: Record<string, any>,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  update(updates: Partial<Pick<WorldSetting, 'name' | 'description' | 'category' | 'rules' | 'metadata'>>) {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.description !== undefined) this.description = updates.description;
    if (updates.category !== undefined) this.category = updates.category;
    if (updates.rules !== undefined) this.rules = updates.rules;
    if (updates.metadata !== undefined) this.metadata = updates.metadata;
    this.updatedAt = new Date();
  }

  addRule(rule: string) {
    this.rules.push(rule);
    this.updatedAt = new Date();
  }
}