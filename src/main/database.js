const path = require('path');
const fs = require('fs');

// Mock database implementation for testing
// Will be replaced with better-sqlite3 after dependency installation
class Database {
  constructor() {
    this.data = {
      counter: 0,
      items: []
    };
    this.dbPath = path.join(__dirname, '../../data/noveldrive.json');
    this.ensureDataDirectory();
    this.load();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  load() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load database:', error);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  incrementCounter() {
    this.data.counter++;
    this.save();
    return this.data.counter;
  }

  getCounter() {
    return this.data.counter;
  }

  addItem(item) {
    const newItem = {
      id: Date.now(),
      text: item,
      createdAt: new Date().toISOString()
    };
    this.data.items.push(newItem);
    this.save();
    return newItem;
  }

  getItems() {
    return this.data.items;
  }

  close() {
    // Placeholder for SQLite3 connection close
  }
}

module.exports = Database;