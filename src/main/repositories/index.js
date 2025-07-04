// Export all repositories
const BaseRepository = require('./base-repository');
const ProjectRepository = require('./project-repository');
const KnowledgeRepository = require('./knowledge-repository');
const CharacterRepository = require('./character-repository');
const PlotRepository = require('./plot-repository');
const ProjectKnowledgeRepository = require('./project-knowledge-repository');
const SettingsRepository = require('./settings-repository');

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

  get plots() {
    if (!this._repositories.plots) {
      this._repositories.plots = new PlotRepository(this.db);
    }
    return this._repositories.plots;
  }

  get projectKnowledge() {
    if (!this._repositories.projectKnowledge) {
      this._repositories.projectKnowledge = new ProjectKnowledgeRepository(this.db);
    }
    return this._repositories.projectKnowledge;
  }

  get settings() {
    if (!this._repositories.settings) {
      this._repositories.settings = new SettingsRepository(this.db);
    }
    return this._repositories.settings;
  }

  // Add more repositories as needed
  // get chapters() { ... }
  // get discussions() { ... }
}

module.exports = {
  BaseRepository,
  ProjectRepository,
  KnowledgeRepository,
  CharacterRepository,
  PlotRepository,
  ProjectKnowledgeRepository,
  SettingsRepository,
  RepositoryFactory
};