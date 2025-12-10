/**
 * Centralized logging service for the application
 * Provides consistent logging with different levels and production filtering
 */

import { isProduction, isDevelopment } from './env';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // In production, only log warnings and errors
    this.minLevel = isProduction() ? LogLevel.WARN : LogLevel.DEBUG;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.minLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorContext = {
        ...context,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: isDevelopment() ? error.stack : undefined,
        } : error,
      };
      console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));

      // In production, you could send errors to a monitoring service
      // Example: Sentry.captureException(error);
    }
  }

  /**
   * Log API calls for debugging
   */
  api(method: string, url: string, status?: number, duration?: number): void {
    const context: LogContext = { method, url };
    if (status) context.status = status;
    if (duration) context.duration = `${duration}ms`;
    
    if (status && status >= 400) {
      this.error('API call failed', undefined, context);
    } else {
      this.debug('API call', context);
    }
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    const perfContext = { ...context, duration: `${duration}ms` };
    
    if (duration > 1000) {
      this.warn(`Slow operation: ${operation}`, perfContext);
    } else {
      this.debug(`Performance: ${operation}`, perfContext);
    }
  }

  /**
   * Create a scoped logger with a prefix
   */
  scope(prefix: string): ScopedLogger {
    return new ScopedLogger(this, prefix);
  }
}

/**
 * Scoped logger that adds a prefix to all messages
 */
class ScopedLogger {
  constructor(private logger: Logger, private prefix: string) {}

  private addPrefix(message: string): string {
    return `[${this.prefix}] ${message}`;
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.addPrefix(message), context);
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.addPrefix(message), context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.addPrefix(message), context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.logger.error(this.addPrefix(message), error, context);
  }

  api(method: string, url: string, status?: number, duration?: number): void {
    this.logger.api(method, url, status, duration);
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    this.logger.performance(operation, duration, context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error | unknown, context?: LogContext) => 
    logger.error(message, error, context),
  api: (method: string, url: string, status?: number, duration?: number) => 
    logger.api(method, url, status, duration),
  performance: (operation: string, duration: number, context?: LogContext) => 
    logger.performance(operation, duration, context),
  scope: (prefix: string) => logger.scope(prefix),
};
