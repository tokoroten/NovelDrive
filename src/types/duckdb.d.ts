declare module 'duckdb' {
  export interface DatabaseOptions {
    [key: string]: any;
  }

  export class Database {
    constructor(path?: string, mode?: number, callback?: (err: Error | null) => void);
    constructor(path?: string, callback?: (err: Error | null) => void);

    connect(): Connection;
    close(callback?: (err: Error | null) => void): void;
    serialize(callback?: () => void): void;
    parallelize(callback?: () => void): void;
    run(sql: string, params?: any, callback?: (err: Error | null) => void): this;
    get(sql: string, params?: any, callback?: (err: Error | null, row: any) => void): this;
    all(sql: string, params?: any, callback?: (err: Error | null, rows: any[]) => void): this;
    each(
      sql: string,
      params?: any,
      callback?: (err: Error | null, row: any) => void,
      complete?: (err: Error | null, count: number) => void
    ): this;
    prepare(sql: string, params?: any, callback?: (err: Error | null) => void): Statement;
  }

  export class Connection {
    run(sql: string, callback?: (err: Error | null) => void): void;
    run(sql: string, params: any, callback?: (err: Error | null) => void): void;

    all(sql: string, callback?: (err: Error | null, rows: any[]) => void): void;
    all(sql: string, params: any, callback?: (err: Error | null, rows: any[]) => void): void;

    each(sql: string, callback?: (err: Error | null, row: any) => void): void;
    each(sql: string, params: any, callback?: (err: Error | null, row: any) => void): void;

    prepare(sql: string): Statement;
    close(callback?: (err: Error | null) => void): void;
  }

  export class Statement {
    bind(params: any, callback?: (err: Error | null) => void): this;
    run(callback?: (err: Error | null) => void): this;
    run(params: any, callback?: (err: Error | null) => void): this;
    get(callback?: (err: Error | null, row: any) => void): this;
    get(params: any, callback?: (err: Error | null, row: any) => void): this;
    all(callback?: (err: Error | null, rows: any[]) => void): this;
    all(params: any, callback?: (err: Error | null, rows: any[]) => void): this;
    each(callback?: (err: Error | null, row: any) => void): this;
    each(params: any, callback?: (err: Error | null, row: any) => void): this;
    finalize(callback?: (err: Error | null) => void): void;
  }
}
