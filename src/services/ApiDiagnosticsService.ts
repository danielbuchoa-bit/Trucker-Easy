/**
 * API Diagnostics Service - P0-1 Fix
 * 
 * Tracks all API calls with:
 * - Request count per endpoint per minute
 * - Status codes and latency
 * - Retry-After handling
 * - Circuit breaker state
 */

export interface ApiRequest {
  id: string;
  endpoint: string;
  timestamp: number;
  latencyMs: number;
  statusCode: number;
  payloadSize: number;
  responseSize: number;
  success: boolean;
  error?: string;
  retryAfter?: number;
  cached?: boolean;
  provider?: 'nextbillion' | 'here' | 'unknown';
}

export interface CircuitBreakerState {
  isOpen: boolean;
  openedAt: number | null;
  failureCount: number;
  successCount: number;
  lastFailure: number | null;
  cooldownMs: number;
}

export interface ApiStats {
  requestsPerMinute: number;
  successRate: number;
  avgLatencyMs: number;
  errorCounts: Record<number, number>;
  last429At: number | null;
  rateLimitedRequests: number;
  cacheHitRate: number;
}

const MAX_LOG_SIZE = 100;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const RATE_LIMIT_THRESHOLD = 0.20; // 20% 429s triggers circuit breaker
const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000; // 60 seconds

class ApiDiagnosticsService {
  private requestLog: ApiRequest[] = [];
  private circuitBreaker: CircuitBreakerState = {
    isOpen: false,
    openedAt: null,
    failureCount: 0,
    successCount: 0,
    lastFailure: null,
    cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
  };
  private listeners: Set<(stats: ApiStats) => void> = new Set();
  private lastRetryAfter: number | null = null;

  /**
   * Log an API request
   */
  logRequest(request: Omit<ApiRequest, 'id'>): void {
    const entry: ApiRequest = {
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    // Add to log (FIFO)
    this.requestLog.unshift(entry);
    if (this.requestLog.length > MAX_LOG_SIZE) {
      this.requestLog.pop();
    }

    // Update circuit breaker
    this.updateCircuitBreaker(entry);

    // Store Retry-After if present
    if (entry.retryAfter) {
      this.lastRetryAfter = Date.now() + entry.retryAfter * 1000;
    }

    // Notify listeners
    const stats = this.getStats();
    this.listeners.forEach(listener => listener(stats));

    // Log to console in dev
    const emoji = entry.success ? '✅' : '❌';
    console.log(
      `[ApiDiag] ${emoji} ${entry.endpoint} | ${entry.statusCode} | ${entry.latencyMs}ms | ${entry.provider || 'unknown'}${entry.cached ? ' (cached)' : ''}`
    );
  }

  /**
   * Check if circuit breaker allows requests
   */
  canMakeRequest(): { allowed: boolean; reason?: string; waitMs?: number } {
    // Check if circuit is open
    if (this.circuitBreaker.isOpen) {
      const elapsed = Date.now() - (this.circuitBreaker.openedAt || 0);
      const remaining = this.circuitBreaker.cooldownMs - elapsed;

      if (remaining > 0) {
        return {
          allowed: false,
          reason: 'Circuit breaker open - too many 429 errors',
          waitMs: remaining,
        };
      } else {
        // Cooldown expired, close circuit breaker
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.openedAt = null;
        this.circuitBreaker.failureCount = 0;
        console.log('[ApiDiag] Circuit breaker closed - cooldown expired');
      }
    }

    // Check Retry-After
    if (this.lastRetryAfter && Date.now() < this.lastRetryAfter) {
      const waitMs = this.lastRetryAfter - Date.now();
      return {
        allowed: false,
        reason: 'Respecting Retry-After header',
        waitMs,
      };
    }

    return { allowed: true };
  }

  /**
   * Get exponential backoff delay for retries
   */
  getBackoffDelay(attemptNumber: number): number {
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s, max 30s
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
    // Add jitter (±20%)
    const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Get current API statistics
   */
  getStats(): ApiStats {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestLog.filter(r => r.timestamp > oneMinuteAgo);

    const successfulRequests = recentRequests.filter(r => r.success);
    const cachedRequests = recentRequests.filter(r => r.cached);
    const rateLimitedRequests = this.requestLog.filter(r => r.statusCode === 429);

    const errorCounts: Record<number, number> = {};
    recentRequests.forEach(r => {
      if (!r.success) {
        errorCounts[r.statusCode] = (errorCounts[r.statusCode] || 0) + 1;
      }
    });

    const avgLatency = recentRequests.length > 0
      ? recentRequests.reduce((sum, r) => sum + r.latencyMs, 0) / recentRequests.length
      : 0;

    const last429 = rateLimitedRequests[0];

    return {
      requestsPerMinute: recentRequests.length,
      successRate: recentRequests.length > 0 
        ? successfulRequests.length / recentRequests.length 
        : 1,
      avgLatencyMs: Math.round(avgLatency),
      errorCounts,
      last429At: last429?.timestamp || null,
      rateLimitedRequests: rateLimitedRequests.length,
      cacheHitRate: recentRequests.length > 0
        ? cachedRequests.length / recentRequests.length
        : 0,
    };
  }

  /**
   * Get full request log
   */
  getRequestLog(): ApiRequest[] {
    return [...this.requestLog];
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Subscribe to stats updates
   */
  subscribe(listener: (stats: ApiStats) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.requestLog = [];
    this.circuitBreaker = {
      isOpen: false,
      openedAt: null,
      failureCount: 0,
      successCount: 0,
      lastFailure: null,
      cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
    };
    this.lastRetryAfter = null;
    console.log('[ApiDiag] Cleared all logs and reset circuit breaker');
  }

  /**
   * Update circuit breaker based on request result
   */
  private updateCircuitBreaker(request: ApiRequest): void {
    if (request.statusCode === 429) {
      this.circuitBreaker.failureCount++;
      this.circuitBreaker.lastFailure = Date.now();

      // Check rate limit threshold
      const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
      const recentRequests = this.requestLog.filter(r => r.timestamp > windowStart);
      const recentRateLimits = recentRequests.filter(r => r.statusCode === 429);

      if (recentRequests.length >= 5) { // Minimum sample size
        const rateLimitRate = recentRateLimits.length / recentRequests.length;

        if (rateLimitRate > RATE_LIMIT_THRESHOLD && !this.circuitBreaker.isOpen) {
          this.circuitBreaker.isOpen = true;
          this.circuitBreaker.openedAt = Date.now();
          console.warn(`[ApiDiag] Circuit breaker OPENED - ${Math.round(rateLimitRate * 100)}% rate limits in ${RATE_LIMIT_WINDOW_MS / 1000}s window`);
        }
      }
    } else if (request.success) {
      this.circuitBreaker.successCount++;
    }
  }
}

// Singleton instance
export const apiDiagnostics = new ApiDiagnosticsService();
export default apiDiagnostics;
