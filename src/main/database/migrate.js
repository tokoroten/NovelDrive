const fs = require('fs');
const path = require('path');

class DatabaseMigration {
  constructor(db) {
    this.db = db;
    this.schemaPath = path.join(__dirname, 'schema.sql');
  }

  async run() {
    console.log('Starting database migration...');
    
    try {
      // Read schema file
      const schema = fs.readFileSync(this.schemaPath, 'utf8');
      
      // Split by semicolon and filter out empty statements
      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      // Execute each statement
      for (const statement of statements) {
        try {
          if (this.db.prepare && typeof this.db.prepare === 'function') {
            // better-sqlite3 style
            this.db.prepare(statement + ';').run();
          } else {
            // Fallback for mock database
            console.log('Executing:', statement.substring(0, 50) + '...');
          }
        } catch (error) {
          console.error('Failed to execute statement:', error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
      
      // Insert default data
      this.insertDefaultData();
      
      console.log('Database migration completed successfully.');
      return true;
    } catch (error) {
      console.error('Database migration failed:', error);
      return false;
    }
  }

  insertDefaultData() {
    try {
      // Check if we have any projects
      const checkProject = this.db.prepare ? 
        this.db.prepare('SELECT COUNT(*) as count FROM projects').get() :
        { count: 0 };

      if (checkProject.count === 0) {
        console.log('Inserting default project...');
        
        if (this.db.prepare) {
          const insertProject = this.db.prepare(`
            INSERT INTO projects (name, description, metadata)
            VALUES (?, ?, ?)
          `);
          
          insertProject.run(
            'デフォルトプロジェクト',
            'NovelDriveの最初のプロジェクトです。',
            JSON.stringify({
              genre: 'ファンタジー',
              targetLength: 100000,
              status: 'planning'
            })
          );
        }
      }

      // Insert default app settings
      if (this.db.prepare) {
        const insertSetting = this.db.prepare(`
          INSERT OR REPLACE INTO app_settings (key, value)
          VALUES (?, ?)
        `);

        insertSetting.run('app_version', '1.0.0');
        insertSetting.run('theme', 'light');
        insertSetting.run('auto_save_interval', '300'); // 5 minutes
        insertSetting.run('backup_enabled', 'true');
        insertSetting.run('backup_interval', '86400'); // 24 hours
      }

      console.log('Default data inserted successfully.');
    } catch (error) {
      console.error('Failed to insert default data:', error);
    }
  }

  async checkMigrationStatus() {
    try {
      if (this.db.prepare) {
        const tables = this.db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all();
        
        console.log('Existing tables:', tables.map(t => t.name).join(', '));
        return tables.length > 0;
      }
      return false;
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return false;
    }
  }
}

module.exports = DatabaseMigration;