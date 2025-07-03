// Export all repositories
const BaseRepository = require('./base-repository');
const ProjectRepository = require('./project-repository');
const KnowledgeRepository = require('./knowledge-repository');
const CharacterRepository = require('./character-repository');

// Repository factory
class RepositoryFactory {
  constructor(db) {
    this.db = db;
    this._repositories = {};
  }

  get projects() {
    if (!this._repositories.projects) {
      this._repositories.projects = new ProjectRepository(this.db);
    }
    return this._repositories.projects;
  }

  get knowledge() {
    if (!this._repositories.knowledge) {
      this._repositories.knowledge = new KnowledgeRepository(this.db);
    }
    return this._repositories.knowledge;
  }

  get characters() {
    if (!this._repositories.characters) {
      this._repositories.characters = new CharacterRepository(this.db);
    }
    return this._repositories.characters;
  }

  // Add more repositories as needed
  // get plots() { ... }
  // get chapters() { ... }
  // get discussions() { ... }
}

module.exports = {
  BaseRepository,
  ProjectRepository,
  KnowledgeRepository,
  CharacterRepository,
  RepositoryFactory
};