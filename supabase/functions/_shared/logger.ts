/**
 * Structured logging utility for Edge Functions
 * Provides consistent logging format with timestamp, function name, operation, duration, and log level
 */

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogEntry {
  timestamp: string
  functionName: string
  operation: string
  level: LogLevel
  duration?: number
  result?: string
  details?: Record<string, any>
  error?: string
}

/**
 * Structured logger class for consistent logging across Edge Functions
 */
export class Logger {
  private functionName: string

  constructor(functionName: string) {
    this.functionName = functionName
  }

  /**
   * Log an info message
   */
  info(operation: string, details?: Record<string, any>): void {
    this.log(LogLevel.INFO, operation, undefined, 'success', details)
  }

  /**
   * Log a warning message
   */
  warn(operation: string, details?: Record<string, any>, error?: string): void {
    this.log(LogLevel.WARN, operation, undefined, 'warning', details, error)
  }

  /**
   * Log an error message
   */
  error(operation: string, error: string, details?: Record<string, any>): void {
    this.log(LogLevel.ERROR, operation, undefined, 'failure', details, error)
  }

  /**
   * Log an operation with timing
   */
  async logOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    details?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now()

    try {
      this.log(LogLevel.INFO, operation, undefined, 'started', details)
      const result = await fn()
      const duration = Date.now() - startTime
      this.log(LogLevel.INFO, operation, duration, 'success', details)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.log(LogLevel.ERROR, operation, duration, 'failure', details, error.message)
      throw error
    }
  }

  /**
   * Internal logging method
   */
  private log(
    level: LogLevel,
    operation: string,
    duration?: number,
    result?: string,
    details?: Record<string, any>,
    error?: string
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      functionName: this.functionName,
      operation,
      level,
      ...(duration !== undefined && { duration }),
      ...(result && { result }),
      ...(details && { details }),
      ...(error && { error })
    }

    // Output to console in structured format
    console.log(JSON.stringify(logEntry))
  }
}

/**
 * Create a logger instance for a specific function
 */
export function createLogger(functionName: string): Logger {
  return new Logger(functionName)
}