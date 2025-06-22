/**
 * 依存性注入（DI）コンテナ
 * サービスの依存関係を管理し、シングルトンインスタンスを提供
 */

type ServiceFactory<T> = (deps: any) => T | Promise<T>;
type ServiceClass<T> = new (...args: any[]) => T;

interface ServiceDefinition<T> {
  factory?: ServiceFactory<T>;
  class?: ServiceClass<T>;
  dependencies?: string[];
  singleton?: boolean;
  instance?: T;
}

export class DIContainer {
  private services = new Map<string, ServiceDefinition<any>>();
  private resolving = new Set<string>();

  /**
   * サービスを登録
   */
  register<T>(
    name: string,
    factoryOrClass: ServiceFactory<T> | ServiceClass<T>,
    options: {
      dependencies?: string[];
      singleton?: boolean;
    } = {}
  ): void {
    const definition: ServiceDefinition<T> = {
      singleton: options.singleton !== false, // デフォルトはシングルトン
      dependencies: options.dependencies || [],
    };

    if (typeof factoryOrClass === 'function' && factoryOrClass.prototype) {
      definition.class = factoryOrClass as ServiceClass<T>;
    } else {
      definition.factory = factoryOrClass as ServiceFactory<T>;
    }

    this.services.set(name, definition);
  }

  /**
   * サービスインスタンスを取得
   */
  async get<T>(name: string): Promise<T> {
    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`Service '${name}' not found`);
    }

    // 循環依存チェック
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected: ${Array.from(this.resolving).join(' -> ')} -> ${name}`);
    }

    // シングルトンの場合、既存のインスタンスを返す
    if (definition.singleton && definition.instance) {
      return definition.instance;
    }

    this.resolving.add(name);
    try {
      // 依存関係を解決
      const dependencies = await Promise.all(
        (definition.dependencies || []).map(dep => this.get(dep))
      );

      // 依存関係をオブジェクトに変換
      const deps: any = {};
      if (definition.dependencies) {
        for (let i = 0; i < definition.dependencies.length; i++) {
          const depName = definition.dependencies[i];
          deps[depName] = dependencies[i];
        }
      }

      // インスタンスを作成
      let instance: T;
      if (definition.factory) {
        instance = await definition.factory(deps);
      } else if (definition.class) {
        instance = new definition.class(...dependencies);
      } else {
        throw new Error(`No factory or class defined for service '${name}'`);
      }

      // シングルトンの場合、インスタンスを保存
      if (definition.singleton) {
        definition.instance = instance;
      }

      return instance;
    } finally {
      this.resolving.delete(name);
    }
  }

  /**
   * 同期的にサービスを取得（既に初期化済みの場合のみ）
   */
  getSync<T>(name: string): T {
    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`Service '${name}' not found`);
    }

    if (!definition.instance) {
      throw new Error(`Service '${name}' is not initialized yet`);
    }

    return definition.instance;
  }

  /**
   * サービスが登録されているか確認
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * サービスが初期化されているか確認
   */
  isInitialized(name: string): boolean {
    const definition = this.services.get(name);
    return !!definition?.instance;
  }

  /**
   * 全てのシングルトンサービスを初期化
   */
  async initializeAll(): Promise<void> {
    const singletonServices = Array.from(this.services.entries())
      .filter(([_, def]) => def.singleton)
      .map(([name]) => name);

    await Promise.all(singletonServices.map(name => this.get(name)));
  }

  /**
   * 特定のサービスをリセット
   */
  reset(name: string): void {
    const definition = this.services.get(name);
    if (definition) {
      delete definition.instance;
    }
  }

  /**
   * 全てのサービスをリセット
   */
  resetAll(): void {
    this.services.forEach(definition => {
      delete definition.instance;
    });
  }

  /**
   * サービスを削除
   */
  unregister(name: string): void {
    this.services.delete(name);
  }
}

// シングルトンインスタンス
export const container = new DIContainer();