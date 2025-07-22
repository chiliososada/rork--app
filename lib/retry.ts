// Generic retry mechanism with exponential backoff
// React Native compatible implementation

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryCondition?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000,    // 10 seconds
  backoffMultiplier: 2,
  retryCondition: (error: any) => {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT') return true;
    if (error?.status >= 500 && error?.status < 600) return true;
    if (error?.message?.includes('network') || error?.message?.includes('timeout')) return true;
    return false;
  }
};

/**
 * Generic retry wrapper with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry configuration
 * @returns Promise that resolves with the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is the last attempt
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Don't retry if the error doesn't match retry condition
      if (!config.retryCondition(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );
      
      console.log(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms delay:`, (error as Error).message || error);
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // All retries exhausted, throw the last error
  throw lastError;
}

/**
 * Network-specific retry wrapper with appropriate defaults
 */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, 'retryCondition'> = {}
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 2,
    initialDelay: 1000,
    maxDelay: 5000,
    ...options,
    retryCondition: (error: any) => {
      // Network-specific retry conditions
      if (error?.code === 'PGRST116') return false; // PostgreSQL constraint violation - don't retry
      if (error?.code === '23505') return false;    // Unique constraint violation - don't retry
      if (error?.status === 401 || error?.status === 403) return false; // Auth errors - don't retry
      if (error?.status === 404) return false;      // Not found - don't retry
      
      // Retry on network/server errors
      return DEFAULT_OPTIONS.retryCondition(error);
    }
  });
}

/**
 * Database-specific retry wrapper
 */
export async function withDatabaseRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, 'retryCondition'> = {}
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 2000,
    ...options,
    retryCondition: (error: any) => {
      // Database-specific retry conditions
      if (error?.code === 'PGRST116') return false; // PostgreSQL constraint violation
      if (error?.code === '23505') return false;    // Unique constraint violation
      if (error?.message?.includes('duplicate key')) return false;
      
      // Retry on connection/timeout errors
      if (error?.code === 'PGRST301') return true;  // Connection timeout
      if (error?.message?.includes('connection')) return true;
      if (error?.message?.includes('timeout')) return true;
      
      return false;
    }
  });
}

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Network status detection (React Native compatible)
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('fetch') ||
    code.includes('network') ||
    error.name === 'NetworkError' ||
    error.name === 'TimeoutError'
  );
}

/**
 * Check if retry is worth attempting based on error type
 */
export function shouldRetry(error: any): boolean {
  return DEFAULT_OPTIONS.retryCondition(error);
}