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
  private history: AgentMessage[] = [];
  private depth: number = 0;
  private config: AgentBusConfig;
  private agentRegistry: Map<string, (payload: unknown) => Promise<AgentResult>>;

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
