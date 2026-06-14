export type PermissionLevel = 'read_only' | 'read_write' | 'admin';

export interface SessionPolicy {
  sessionId: string;
  permissionLevel: PermissionLevel;
  allowedTools: string[];
  blockedTools: string[];
  expiresAt?: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
}

export interface SecurityEvent {
  type: 'rate_limit_exceeded' | 'permission_denied' | 'session_policy_updated';
  sessionId?: string;
  ip?: string;
  tool?: string;
  timestamp: number;
}

export class SecurityService {
  private sessionPolicies: Map<string, SessionPolicy> = new Map();
  private ipRateLimits: Map<string, RateLimitState> = new Map();
  private sessionRateLimits: Map<string, RateLimitState> = new Map();
  private defaultIpLimit: RateLimitConfig = { maxRequests: 100, windowMs: 60000 };
  private defaultSessionLimit: RateLimitConfig = { maxRequests: 50, windowMs: 60000 };
  private eventListeners: Set<(event: SecurityEvent) => void> = new Set();

  setSessionPolicy(sessionId: string, policy: Omit<SessionPolicy, 'sessionId'>): void {
    const fullPolicy: SessionPolicy = { ...policy, sessionId };
    this.sessionPolicies.set(sessionId, fullPolicy);
    this.emitEvent('session_policy_updated', { sessionId });
  }

  getSessionPolicy(sessionId: string): SessionPolicy | undefined {
    return this.sessionPolicies.get(sessionId);
  }

  removeSessionPolicy(sessionId: string): void {
    this.sessionPolicies.delete(sessionId);
  }

  hasPermission(sessionId: string, toolName: string): boolean {
    const policy = this.sessionPolicies.get(sessionId);
    if (!policy) {
      return true;
    }

    if (policy.blockedTools.includes(toolName)) {
      this.emitEvent('permission_denied', { sessionId, tool: toolName });
      return false;
    }

    if (policy.allowedTools.length > 0 && !policy.allowedTools.includes(toolName)) {
      this.emitEvent('permission_denied', { sessionId, tool: toolName });
      return false;
    }

    return true;
  }

  checkRateLimitByIp(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const state = this.ipRateLimits.get(ip);
    const config = this.defaultIpLimit;

    if (!state || now >= state.resetTime) {
      this.ipRateLimits.set(ip, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
    }

    if (state.count >= config.maxRequests) {
      this.emitEvent('rate_limit_exceeded', { ip });
      return { allowed: false, remaining: 0, resetTime: state.resetTime };
    }

    state.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - state.count,
      resetTime: state.resetTime,
    };
  }

  checkRateLimitBySession(sessionId: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const state = this.sessionRateLimits.get(sessionId);
    const config = this.defaultSessionLimit;

    if (!state || now >= state.resetTime) {
      this.sessionRateLimits.set(sessionId, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
    }

    if (state.count >= config.maxRequests) {
      this.emitEvent('rate_limit_exceeded', { sessionId });
      return { allowed: false, remaining: 0, resetTime: state.resetTime };
    }

    state.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - state.count,
      resetTime: state.resetTime,
    };
  }

  clearRateLimit(ip?: string, sessionId?: string): void {
    if (ip) {
      this.ipRateLimits.delete(ip);
    }
    if (sessionId) {
      this.sessionRateLimits.delete(sessionId);
    }
  }

  setIpRateLimitConfig(config: RateLimitConfig): void {
    this.defaultIpLimit = config;
  }

  setSessionRateLimitConfig(config: RateLimitConfig): void {
    this.defaultSessionLimit = config;
  }

  getPermissionLevel(sessionId: string): PermissionLevel {
    const policy = this.sessionPolicies.get(sessionId);
    return policy?.permissionLevel || 'read_write';
  }

  getAvailableTools(sessionId: string, allTools: string[]): string[] {
    const policy = this.sessionPolicies.get(sessionId);
    if (!policy) {
      return allTools;
    }

    if (policy.permissionLevel === 'read_only') {
      return allTools.filter((tool) => !tool.includes('create') && !tool.includes('update') && !tool.includes('delete'));
    }

    if (policy.permissionLevel === 'admin') {
      return allTools;
    }

    if (policy.allowedTools.length > 0) {
      return policy.allowedTools;
    }

    if (policy.blockedTools.length > 0) {
      return allTools.filter((tool) => !policy.blockedTools.includes(tool));
    }

    return allTools;
  }

  subscribe(listener: (event: SecurityEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private emitEvent(type: SecurityEvent['type'], data: Omit<SecurityEvent, 'type' | 'timestamp'>): void {
    const event: SecurityEvent = {
      type,
      ...data,
      timestamp: Date.now(),
    };
    this.eventListeners.forEach((listener) => listener(event));
  }

  cleanupExpiredPolicies(): void {
    const now = Date.now();
    for (const [sessionId, policy] of this.sessionPolicies) {
      if (policy.expiresAt && policy.expiresAt < now) {
        this.sessionPolicies.delete(sessionId);
      }
    }
  }

  cleanupExpiredRateLimits(): void {
    const now = Date.now();
    for (const [ip, state] of this.ipRateLimits) {
      if (now >= state.resetTime) {
        this.ipRateLimits.delete(ip);
      }
    }
    for (const [sessionId, state] of this.sessionRateLimits) {
      if (now >= state.resetTime) {
        this.sessionRateLimits.delete(sessionId);
      }
    }
  }
}

export const securityService = new SecurityService();