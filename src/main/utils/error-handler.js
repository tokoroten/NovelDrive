const { getLogger } = require('./logger');

/**
 * Custom error classes for NovelDrive
 */
class NovelDriveError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode || 500;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class DatabaseError extends NovelDriveError {
  constructor(message, originalError) {
    super(message, 'DATABASE_ERROR', 500);
    this.originalError = originalError;
  }
}

class ValidationError extends NovelDriveError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR', 400);
    this.field = field;
  }
}

class NotFoundError extends NovelDriveError {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.resource = resource;
    this.resourceId = id;
  }
}

class AIServiceError extends NovelDriveError {
  constructor(message, service, originalError) {
    super(message, 'AI_SERVICE_ERROR', 503);
    this.service = service;
    this.originalError = originalError;
  }
}

class FileSystemError extends NovelDriveError {
  constructor(message, operation, path) {
    super(message, 'FILE_SYSTEM_ERROR', 500);
    this.operation = operation;
    this.path = path;
  }
}

/**
 * Global error handler for the application
 */
class ErrorHandler {
  constructor() {
    this.logger = getLogger();
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Handle errors and return formatted response
   * @param {Error} error
   * @param {string} context
   * @returns {Object}
   */
  handle(error, context = '') {
    // Log the error
    this.logger.logError(error, context);

    // Determine error type and format response
    if (error instanceof NovelDriveError) {
      return this.formatKnownError(error);
    }

    // Handle specific third-party errors
    if (error.code === 'SQLITE_ERROR') {
      return this.formatDatabaseError(error);
    }

    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return this.formatProgrammingError(error);
    }

    // Default unknown error
    return this.formatUnknownError(error);
  }

  formatKnownError(error) {
    const response = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: error.timestamp
      }
    };

    if (this.isDevelopment) {
      response.error.stack = error.stack;
      if (error.originalError) {
        response.error.originalError = {
          message: error.originalError.message,
          stack: error.originalError.stack
        };
      }
    }

    return response;
  }

  formatDatabaseError(error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
        detail: this.isDevelopment ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    };
  }

  formatProgrammingError(error) {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        type: error.name,
        detail: this.isDevelopment ? error.message : undefined,
        stack: this.isDevelopment ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    };
  }

  formatUnknownError(error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        detail: this.isDevelopment ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Wrap an async function with error handling
   * @param {Function} fn
   * @param {string} context
   * @returns {Function}
   */
  wrapAsync(fn, context) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return this.handle(error, context);
      }
    };
  }

  /**
   * Wrap IPC handlers with error handling
   * @param {Function} handler
   * @param {string} channel
   * @returns {Function}
   */
  wrapIPCHandler(handler, channel) {
    return async (event, ...args) => {
      const timer = this.logger.startTimer(`IPC:${channel}`);
      
      try {
        this.logger.debug(`IPC handler called: ${channel}`, { args });
        const result = await handler(event, ...args);
        timer.end('completed successfully');
        return { success: true, data: result };
      } catch (error) {
        timer.end('failed with error');
        const errorResponse = this.handle(error, `IPC:${channel}`);
        
        // For IPC, we want to return the error response, not throw
        return errorResponse;
      }
    };
  }

  /**
   * Setup global error handlers for the process
   */
  setupGlobalHandlers() {
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error);
      
      // Give the logger time to write
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }
}

// Create singleton instance
let errorHandlerInstance = null;

function getErrorHandler() {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler();
  }
  return errorHandlerInstance;
}

module.exports = {
  // Error classes
  NovelDriveError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  AIServiceError,
  FileSystemError,
  
  // Error handler
  ErrorHandler,
  getErrorHandler
};