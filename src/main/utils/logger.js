const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Simple logger implementation for NovelDrive
 */
class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || 'info';
    this.logToFile = options.logToFile !== false;
    this.logDir = options.logDir || path.join(__dirname, '../../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    if (this.logToFile) {
      this.ensureLogDirectory();
      this.logFilePath = path.join(this.logDir, `noveldrive-${this.getDateString()}.log`);
    }
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  formatMessage(level, message, ...args) {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return util.inspect(arg, { depth: 3, colors: false });
      }
      return arg;
    }).join(' ');

    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${formattedArgs}`.trim();
  }

  writeToFile(message) {
    if (!this.logToFile) return;

    try {
      // Check file size and rotate if necessary
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size > this.maxFileSize) {
          this.rotateLogFile();
        }
      }

      fs.appendFileSync(this.logFilePath, message + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  rotateLogFile() {
    const timestamp = new Date().getTime();
    const rotatedPath = path.join(this.logDir, `noveldrive-${this.getDateString()}-${timestamp}.log`);
    
    try {
      fs.renameSync(this.logFilePath, rotatedPath);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  log(level, message, ...args) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);
    
    // Console output with colors
    const consoleColors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m'  // Gray
    };
    const resetColor = '\x1b[0m';
    
    console.log(`${consoleColors[level]}${formattedMessage}${resetColor}`);
    
    // File output
    this.writeToFile(formattedMessage);
  }

  error(message, ...args) {
    this.log('error', message, ...args);
  }

  warn(message, ...args) {
    this.log('warn', message, ...args);
  }

  info(message, ...args) {
    this.log('info', message, ...args);
  }

  debug(message, ...args) {
    this.log('debug', message, ...args);
  }

  // Special method for logging errors with stack traces
  logError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: this.getTimestamp()
    };

    this.error(`Error occurred${context ? ' in ' + context : ''}:`, errorInfo);
  }

  // Method for logging API calls
  logApiCall(apiType, endpoint, params, response, duration) {
    const apiLog = {
      apiType,
      endpoint,
      params: this.sanitizeApiParams(params),
      responseStatus: response?.status || 'unknown',
      duration: `${duration}ms`,
      timestamp: this.getTimestamp()
    };

    this.info('API Call:', apiLog);
  }

  // Sanitize sensitive information from API parameters
  sanitizeApiParams(params) {
    if (!params) return params;
    
    const sanitized = { ...params };
    const sensitiveKeys = ['api_key', 'apiKey', 'token', 'secret', 'password'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  // Method for performance logging
  startTimer(label) {
    const startTime = process.hrtime.bigint();
    return {
      end: (message) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        this.debug(`${label}: ${message} (${duration.toFixed(2)}ms)`);
        return duration;
      }
    };
  }
}

// Create a singleton instance
let loggerInstance = null;

function createLogger(options) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }
  return loggerInstance;
}

function getLogger() {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

module.exports = {
  Logger,
  createLogger,
  getLogger
};