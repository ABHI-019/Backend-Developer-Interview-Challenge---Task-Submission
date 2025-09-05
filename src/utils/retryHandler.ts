export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;  // in milliseconds
  maxDelay: number;   // in milliseconds
}

export class RetryHandler {
  constructor(private config: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,  // 1 second
    maxDelay: 30000   // 30 seconds
  }) {}

  async withRetry<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.config.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.config.baseDelay * Math.pow(2, retryCount),
        this.config.maxDelay
      );

      // Add some jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      const finalDelay = delay + jitter;

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, finalDelay));

      // Recursive retry with incremented count
      return this.withRetry(operation, retryCount + 1);
    }
  }
}
