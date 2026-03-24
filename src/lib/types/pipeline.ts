/**
 * Tipos compartidos para el pipeline de agentes IA del dashboard.
 * Consumidos por usePipelineStream, LiveLogsPanel, LiveSynthesisPanel,
 * ProviderStatusPanel y ProcessFlowPanel.
 */

/**
 * Entrada de log generada por eventos SSE del pipeline de agentes.
 * Consumida por `LiveLogsPanel` para mostrar actividad en tiempo real.
 *
 * @property id - Identificador único (UUID) de la entrada
 * @property timestamp - Epoch en milisegundos del evento
 * @property type - Tipo de evento SSE que originó la entrada
 * @property agentId - ID del agente (ej: `auditor`, `mapper`). Opcional para eventos de tipo `error`
 * @property agentName - Nombre display del agente (ej: `Juli`). Opcional para eventos de tipo `error`
 * @property message - Descripción legible del evento
 * @property metadata - Datos adicionales según el tipo de evento
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'agent-start' | 'agent-complete' | 'agent-communication' | 'error';
  agentId?: string;
  agentName?: string;
  message: string;
  metadata?: {
    /** Tokens consumidos por el agente (solo en `agent-complete`) */
    tokensUsed?: number;
    /** Latencia en milisegundos (solo en `agent-complete`) */
    latencyMs?: number;
    /** Resultado de la ejecución (solo en `agent-complete`) */
    success?: boolean;
    /** Agente origen de la comunicación (solo en `agent-communication`) */
    fromAgent?: string;
    /** Agente destino de la comunicación (solo en `agent-communication`) */
    toAgent?: string;
    /** Tipo de consulta inter-agente (solo en `agent-communication`) */
    queryType?: string;
  };
}

/**
 * Resultado de síntesis generado al completar el pipeline de agentes.
 * Consumido por `LiveSynthesisPanel` para mostrar el resumen consolidado.
 * Se construye incrementalmente con eventos `agent-complete` y se finaliza con `pipeline-complete`.
 *
 * @property summary - Resumen narrativo del análisis generado por el agente Writer
 * @property riskLevel - Nivel de riesgo global determinado por el análisis
 * @property findings - Lista de hallazgos con descripción y severidad
 * @property recommendations - Recomendaciones priorizadas para el usuario
 * @property contributingAgents - Agentes que participaron en el resultado
 * @property completedAt - Epoch en milisegundos de finalización del pipeline
 */
export interface SynthesisResult {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  findings: Array<{ description: string; severity: string }>;
  recommendations: string[];
  contributingAgents: Array<{ id: string; name: string; emoji: string }>;
  completedAt: number;
}

/**
 * Resumen de un proveedor de IA para el `ProviderStatusPanel` del dashboard.
 * Datos obtenidos de la tabla `ai_providers` en Supabase.
 *
 * @property id - UUID del proveedor
 * @property displayName - Nombre visible configurado por el usuario
 * @property providerType - Tipo de proveedor: `openai`, `anthropic`, `groq`, `google`, `openrouter`
 * @property isActive - Si el proveedor está habilitado para uso
 * @property lastTestSuccess - Resultado del último test de conectividad (`null` si nunca se ha testeado)
 */
export interface ProviderSummary {
  id: string;
  displayName: string;
  providerType: string;
  isActive: boolean;
  lastTestSuccess: boolean | null;
}

/**
 * Paso del flujo de proceso de nómina (carga → mapeo → validación → corrección).
 * Consumido por `ProcessFlowPanel` para visualizar el pipeline con agentes asignados.
 *
 * @property id - Identificador del paso (`upload`, `mapping`, `validation`, `report`)
 * @property title - Título localizado del paso
 * @property description - Descripción breve del paso
 * @property agents - Agentes IA asignados al paso (puede haber múltiples en validación)
 * @property status - Estado actual del paso en el pipeline
 * @property href - Ruta de navegación al hacer clic (ej: `/upload`, `/reconcile`)
 */
export interface ProcessStep {
  id: string;
  title: string;
  description: string;
  agents: Array<{ id: string; name: string; emoji: string; role: string }>;
  status: 'pending' | 'active' | 'completed';
  href: string;
}

/**
 * Estado interno del hook `usePipelineStream`.
 * Centraliza la conexión SSE y distribuye datos reactivamente a los paneles del dashboard.
 *
 * @property isConnected - Si la conexión SSE está activa
 * @property isRunning - Si el pipeline está en ejecución
 * @property logs - Entradas de log acumuladas (máximo 500, FIFO)
 * @property synthesis - Resultado de síntesis consolidado (`null` si no hay análisis completado)
 * @property activeStep - Índice del paso activo en el flujo (0-3)
 * @property activeAgentId - ID del agente actualmente en ejecución
 * @property error - Mensaje de error si la conexión o el pipeline falló
 */
export interface PipelineStreamState {
  isConnected: boolean;
  isRunning: boolean;
  logs: LogEntry[];
  synthesis: SynthesisResult | null;
  activeStep: number;
  activeAgentId: string | null;
  error: string | null;
}

/**
 * Valor de retorno del hook `usePipelineStream`.
 * Extiende el estado con acciones para controlar el pipeline.
 *
 * @property clearLogs - Elimina todas las entradas de log del estado
 * @property startPipeline - Inicia la ejecución del pipeline conectándose al endpoint SSE `/api/ai/orchestrate`
 */
export interface UsePipelineStreamReturn extends PipelineStreamState {
  /** Elimina todas las entradas de log del estado. */
  clearLogs: () => void;
  /**
   * Inicia la ejecución del pipeline de agentes IA.
   * @param messages - Historial de mensajes de la conversación
   * @param context - Contexto adicional opcional (ej: datos de nómina, país)
   */
  startPipeline: (
    messages: Array<{ role: string; content: string }>,
    context?: Record<string, unknown>
  ) => void;
}
