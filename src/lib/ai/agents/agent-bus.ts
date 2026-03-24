import type { AgentResult } from '@/lib/ai/types';

// ── Types ───────────────────────────────────────────────────────────

export interface AgentMessage {
  fromAgent: string;
  toAgent: string;
  queryType: string;
  payload: unknown;
  timestamp: Date;
}

export interface AgentBusConfig {
  maxDepth: number;        // max nested calls to prevent cycles (default: 5)
  timeout: number;         // timeout per inter-agent request in ms (default: 30000)
  sessionId: string;       // groups communications for one orchestration
}

// ── Agent Bus ───────────────────────────────────────────────────────

export class AgentBus {
  protected history: AgentMessage[] = [];
  protected depth: number = 0;
  protected config: AgentBusConfig;
  protected agentRegistry: Map<string, (payload: unknown) => Promise<AgentResult>>;

  constructor(config: AgentBusConfig) {
    this.config = config;
    this.agentRegistry = new Map();
  }

  /** Register an agent handler */
  register(agentName: string, handler: (payload: unknown) => Promise<AgentResult>): void {
    this.agentRegistry.set(agentName, handler);
  }

  /** Send a message to another agent */
  async send(message: Omit<AgentMessage, 'timestamp'>): Promise<AgentResult> {
    // 1. Check depth limit (prevent cycles)
    if (this.depth >= this.config.maxDepth) {
      return {
        agentName: message.toAgent,
        success: false,
        data: { error: 'Max depth exceeded - possible cycle detected' },
        tokensUsed: 0,
        providerUsed: '',
        latencyMs: 0,
      };
    }

    // 2. Record message in history
    const fullMessage: AgentMessage = { ...message, timestamp: new Date() };
    this.history.push(fullMessage);

    // 3. Route to target agent
    const handler = this.agentRegistry.get(message.toAgent);
    if (!handler) {
      return {
        agentName: message.toAgent,
        success: false,
        data: { error: `Agent ${message.toAgent} not found` },
        tokensUsed: 0,
        providerUsed: '',
        latencyMs: 0,
      };
    }

    // 4. Execute with depth tracking and timeout
    this.depth++;
    const start = Date.now();
    try {
      const result = await Promise.race([
        handler(message.payload),
        new Promise<AgentResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Agent ${message.toAgent} timed out after ${this.config.timeout}ms`)), this.config.timeout),
        ),
      ]);
      return result;
    } catch (error) {
      return {
        agentName: message.toAgent,
        success: false,
        data: { error: error instanceof Error ? error.message : 'Unknown error during inter-agent call' },
        tokensUsed: 0,
        providerUsed: '',
        latencyMs: Date.now() - start,
      };
    } finally {
      this.depth--;
    }
  }

  /** Get communication history */
  getHistory(): AgentMessage[] {
    return [...this.history];
  }

  /** Get session ID */
  getSessionId(): string {
    return this.config.sessionId;
  }

  /** Get current nesting depth */
  getDepth(): number {
    return this.depth;
  }

  /** Check if an agent is registered */
  hasAgent(agentName: string): boolean {
    return this.agentRegistry.has(agentName);
  }
}

// ── AgentBus V2 Types ───────────────────────────────────────────────

export interface AgentBusV2Config extends AgentBusConfig {
  onMessage?: (message: AgentMessage) => void;
}

export interface CrossValidationRequest {
  fromAgent: string;
  toAgent: string;
  dataToValidate: unknown;
  validationType: 'numeric-check' | 'report-data-check' | 'correction-verify';
}

export interface CrossValidationResult {
  isConsistent: boolean;
  discrepancies?: string[];
}

// ── AgentBus V2 ─────────────────────────────────────────────────────

export class AgentBusV2 extends AgentBus {
  private onMessage?: (message: AgentMessage) => void;

  constructor(config: AgentBusV2Config) {
    super(config);
    this.onMessage = config.onMessage;
  }

  /** Send a message and emit an event via the onMessage callback */
  async sendWithEvent(message: Omit<AgentMessage, 'timestamp'>): Promise<AgentResult> {
    const fullMessage: AgentMessage = { ...message, timestamp: new Date() };

    // Emit the message event before routing
    if (this.onMessage) {
      this.onMessage(fullMessage);
    }

    // Delegate to the parent send which handles depth, timeout, history, and routing
    return this.send(message);
  }

  /** Request cross-validation between two agents */
  async requestCrossValidation(request: CrossValidationRequest): Promise<CrossValidationResult> {
    const result = await this.sendWithEvent({
      fromAgent: request.fromAgent,
      toAgent: request.toAgent,
      queryType: `cross-validation:${request.validationType}`,
      payload: request.dataToValidate,
    });

    if (!result.success) {
      return {
        isConsistent: false,
        discrepancies: [
          result.data && typeof result.data === 'object' && 'error' in result.data
            ? String((result.data as Record<string, unknown>).error)
            : 'Cross-validation request failed',
        ],
      };
    }

    // The target agent's handler is expected to return CrossValidationResult-shaped data
    const data = result.data as Record<string, unknown> | undefined;
    if (data && typeof data.isConsistent === 'boolean') {
      return {
        isConsistent: data.isConsistent,
        discrepancies: Array.isArray(data.discrepancies)
          ? data.discrepancies.map(String)
          : undefined,
      };
    }

    // Fallback: treat a successful response with no structured data as consistent
    return { isConsistent: true };
  }
}
