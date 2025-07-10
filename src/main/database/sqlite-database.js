const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getLogger } = require('../utils/logger');

class SQLiteDatabase {
  constructor() {
    this.db = null;
    this.logger = getLogger();
    this.dbPath = null;
  }

  /**
   * Initialize database connection
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Get user data directory
      const userDataPath = app.getPath('userData');
      const dbDir = path.join(userDataPath, 'database');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.dbPath = path.join(dbDir, 'noveldrive.db');
      this.logger.info(`Opening database at: ${this.dbPath}`);
      
      // Open database connection
      this.db = new Database(this.dbPath, {
        verbose: this.logger.debug.bind(this.logger),
        fileMustExist: false
      });
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Run migrations
      await this.runMigrations();
      
      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   * @returns {Promise<void>}
   */
  async runMigrations() {
    try {
      // Check if migrations table exists
      const migrationsTableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='migrations'
      `).get();
      
      if (!migrationsTableExists) {
        // Create migrations table
        this.db.exec(`
          CREATE TABLE migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
      
      // Get executed migrations
      const executedMigrations = new Set(
        this.db.prepare('SELECT filename FROM migrations').all()
          .map(row => row.filename)
      );
      
      // Load schema.sql if no migrations have been executed
      if (executedMigrations.size === 0) {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema in a transaction
        const transaction = this.db.transaction(() => {
          // Split schema by semicolons and execute each statement
          const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          
          for (const statement of statements) {
            this.db.exec(statement);
          }
          
          // Record migration
          this.db.prepare('INSERT INTO migrations (filename) VALUES (?)').run('schema.sql');
        });
        
        transaction();
        this.logger.info('Initial schema created');
      }
      
      // TODO: Add support for incremental migrations
      
    } catch (error) {
      this.logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Get the database instance
   * @returns {Database}
   */
  getDB() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info('Database closed');
    }
  }

  /**
   * Begin a transaction
   * @param {Function} callback
   * @returns {Function}
   */
  transaction(callback) {
    return () => {
      try {
        this.db.exec('BEGIN TRANSACTION');
        const result = callback();
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    };
  }

  /**
   * Execute a query
   * @param {string} sql
   * @param {Array} params
   * @returns {any}
   */
  query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      
      // Determine query type
      const queryType = sql.trim().toUpperCase().split(' ')[0];
      
      switch (queryType) {
        case 'SELECT':
          return params.length > 0 ? stmt.all(...params) : stmt.all();
        case 'INSERT':
        case 'UPDATE':
        case 'DELETE':
          const result = params.length > 0 ? stmt.run(...params) : stmt.run();
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid
          };
        default:
          return params.length > 0 ? stmt.run(...params) : stmt.run();
      }
    } catch (error) {
      this.logger.error('Query failed:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param {Function} callback
   * @returns {any}
   */
  transaction(callback) {
    const trx = this.db.transaction(callback);
    return trx();
  }

  /**
   * Prepare a statement
   * @param {string} sql
   * @returns {Statement}
   */
  prepare(sql) {
    try {
      return this.db.prepare(sql);
    } catch (error) {
      this.logger.error('Prepare failed:', error);
      throw error;
    }
  }

  /**
   * Get a single row
   * @param {string} sql
   * @param {Array} params
   * @returns {any}
   */
  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return params.length > 0 ? stmt.get(...params) : stmt.get();
    } catch (error) {
      this.logger.error('Get failed:', error);
      throw error;
    }
  }

  /**
   * Get all rows
   * @param {string} sql
   * @param {Array} params
   * @returns {Array}
   */
  all(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      return params.length > 0 ? stmt.all(...params) : stmt.all();
    } catch (error) {
      this.logger.error('All failed:', error);
      throw error;
    }
  }

  /**
   * Run a query (INSERT, UPDATE, DELETE)
   * @param {string} sql
   * @param {Array} params
   * @returns {Object}
   */
  run(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = params.length > 0 ? stmt.run(...params) : stmt.run();
      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      this.logger.error('Run failed:', error);
      throw error;
    }
  }

  /**
   * Prepare a statement for repeated execution
   * @param {string} sql
   * @returns {Statement}
   */
  prepare(sql) {
    return this.db.prepare(sql);
  }
}

// Export singleton instance
const database = new SQLiteDatabase();

// Proxy the database methods to the internal db instance
const handler = {
    get(target, prop) {
        // If property exists on SQLiteDatabase instance, return it
        if (prop in target) {
            return target[prop];
        }
        
        // If db is initialized and property exists on db, return it
        if (target.db && prop in target.db) {
            const value = target.db[prop];
            if (typeof value === 'function') {
                return value.bind(target.db);
            }
            return value;
        }
        
        return undefined;
    }
};

module.exports = new Proxy(database, handler);