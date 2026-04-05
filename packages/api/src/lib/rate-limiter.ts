export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  reason?: "rpm" | "tpm" | "rpd";
};

/**
 * Simple in-memory limiter for single-user development scenarios.
 * Limits are intentionally global and process-local.
 */
export class InMemoryGeminiRateLimiter {
  private readonly requestTimestamps: number[] = [];
  private readonly tokenEvents: Array<{ at: number; tokens: number }> = [];
  private readonly dailyCounters = new Map<string, number>();

  constructor(
    private readonly maxRequestsPerMinute: number,
    private readonly maxTokensPerMinute: number,
    private readonly maxRequestsPerDay: number
  ) {}

  /**
   * Rough token estimate: this is intentionally conservative and local-only.
   */
  estimateTokens(text: string): number {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return 1;
    }

    // Approximation commonly used for quick guardrails.
    return Math.max(1, Math.ceil(trimmed.length / 4));
  }

  checkAndRecord(estimatedInputTokens: number): RateLimitResult {
    const now = Date.now();
    const minuteWindowMs = 60_000;
    const minTimestamp = now - minuteWindowMs;
    const dayKey = new Date(now).toISOString().slice(0, 10);

    // Sliding window cleanup for RPM
    while (
      this.requestTimestamps.length > 0 &&
      this.requestTimestamps[0] < minTimestamp
    ) {
      this.requestTimestamps.shift();
    }

    // Sliding window cleanup for TPM
    while (this.tokenEvents.length > 0 && this.tokenEvents[0].at < minTimestamp) {
      this.tokenEvents.shift();
    }

    // Keep only today in RPD counters map
    for (const key of this.dailyCounters.keys()) {
      if (key !== dayKey) {
        this.dailyCounters.delete(key);
      }
    }

    // Enforce RPM
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldest = this.requestTimestamps[0];
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((oldest + minuteWindowMs - now) / 1000)
        ),
        reason: "rpm",
      };
    }

    // Enforce TPM (based on estimated input tokens)
    const usedTokensInMinute = this.tokenEvents.reduce(
      (acc, event) => acc + event.tokens,
      0
    );
    if (usedTokensInMinute + estimatedInputTokens > this.maxTokensPerMinute) {
      const oldestTokenEvent = this.tokenEvents[0];
      return {
        allowed: false,
        retryAfterSeconds: oldestTokenEvent
          ? Math.max(
              1,
              Math.ceil((oldestTokenEvent.at + minuteWindowMs - now) / 1000)
            )
          : 60,
        reason: "tpm",
      };
    }

    // Enforce RPD
    const requestsToday = this.dailyCounters.get(dayKey) ?? 0;
    if (requestsToday >= this.maxRequestsPerDay) {
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(24, 0, 0, 0);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((tomorrow.getTime() - now) / 1000)
        ),
        reason: "rpd",
      };
    }

    // Record usage if accepted
    this.requestTimestamps.push(now);
    this.tokenEvents.push({ at: now, tokens: estimatedInputTokens });
    this.dailyCounters.set(dayKey, requestsToday + 1);

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  recordOutputTokens(outputTokens: number): void {
    if (!Number.isFinite(outputTokens) || outputTokens <= 0) {
      return;
    }

    this.tokenEvents.push({ at: Date.now(), tokens: outputTokens });
  }
}

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const chatRateLimiter = new InMemoryGeminiRateLimiter(
  parsePositiveInt(process.env.GEMINI_MAX_RPM, 10),
  parsePositiveInt(process.env.GEMINI_MAX_TPM, 100_000),
  parsePositiveInt(process.env.GEMINI_MAX_RPD, 200)
);
