/**
 * Base Repository class that provides common CRUD operations
 */
class BaseRepository {
  constructor(db, tableName) {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Find a record by ID
   * @param {number} id
   * @returns {Object|null}
   */
  findById(id) {
    try {
      if (this.db.prepare) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
        return stmt.get(id);
      }
      return null;
    } catch (error) {
      console.error(`Error finding ${this.tableName} by id:`, error);
      throw error;
    }
  }

  /**
   * Find all records
   * @param {Object} options - { limit, offset, orderBy }
   * @returns {Array}
   */
  findAll(options = {}) {
    try {
      const { limit = 100, offset = 0, orderBy = 'created_at DESC' } = options;
      
      if (this.db.prepare) {
        const stmt = this.db.prepare(`
          SELECT * FROM ${this.tableName}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `);
        return stmt.all(limit, offset);
      }
      return [];
    } catch (error) {
      console.error(`Error finding all ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find records by a specific field
   * @param {string} field
   * @param {any} value
   * @returns {Array}
   */
  findBy(field, value) {
    try {
      if (this.db.prepare) {
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${field} = ?`);
        return stmt.all(value);
      }
      return [];
    } catch (error) {
      console.error(`Error finding ${this.tableName} by ${field}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data
   * @returns {Object} The created record with ID
   */
  create(data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map(() => '?').join(', ');

      if (this.db.prepare) {
        const stmt = this.db.prepare(`
          INSERT INTO ${this.tableName} (${fields.join(', ')})
          VALUES (${placeholders})
        `);
        
        const result = stmt.run(...values);
        return this.findById(result.lastInsertRowid);
      }
      
      // Fallback for mock database
      return { id: Date.now(), ...data };
    } catch (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a record
   * @param {number} id
   * @param {Object} data
   * @returns {Object|null} The updated record
   */
  update(id, data) {
    try {
      // Add updated_at timestamp if the table has it
      const updateData = { ...data, updated_at: new Date().toISOString() };
      
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map(field => `${field} = ?`).join(', ');

      if (this.db.prepare) {
        const stmt = this.db.prepare(`
          UPDATE ${this.tableName}
          SET ${setClause}
          WHERE id = ?
        `);
        
        stmt.run(...values, id);
        return this.findById(id);
      }
      
      return null;
    } catch (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   * @param {number} id
   * @returns {boolean}
   */
  delete(id) {
    try {
      if (this.db.prepare) {
        const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
        const result = stmt.run(id);
        return result.changes > 0;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Count records
   * @param {Object} where - Optional where conditions
   * @returns {number}
   */
  count(where = {}) {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const conditions = [];
      const values = [];

      Object.entries(where).forEach(([field, value]) => {
        conditions.push(`${field} = ?`);
        values.push(value);
      });

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (this.db.prepare) {
        const stmt = this.db.prepare(query);
        const result = values.length > 0 ? stmt.get(...values) : stmt.get();
        return result.count;
      }
      return 0;
    } catch (error) {
      console.error(`Error counting ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Execute a custom query
   * @param {string} query
   * @param {Array} params
   * @returns {Array}
   */
  query(query, params = []) {
    try {
      if (this.db.prepare) {
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
      }
      return [];
    } catch (error) {
      console.error('Error executing custom query:', error);
      throw error;
    }
  }

  /**
   * Begin a transaction
   * @param {Function} callback
   * @returns {any}
   */
  transaction(callback) {
    if (this.db.transaction) {
      return this.db.transaction(callback)();
    }
    // Fallback for databases without transaction support
    return callback();
  }
}

module.exports = BaseRepository;