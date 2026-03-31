/**
 * NLQ Intent Classifier
 *
 * Classifies user messages in the AI sidebar to determine whether
 * they are data queries (delegated to NLQ Engine) or general chat
 * (handled by the orchestrator).
 *
 * Requirements: 12.1
 */

/** Possible intent types for a user message */
export type IntentType = 'data_query' | 'general_chat';

/** Result of intent classification */
export interface IntentClassification {
  intent: IntentType;
  confidence: number; // 0-1
  extractedQuery?: string; // cleaned query for NLQ engine
}

/**
 * Keywords and patterns that indicate a data query intent.
 * Covers Spanish and English common payroll/data questions.
 */
const DATA_QUERY_PATTERNS: RegExp[] = [
  /\b(cuánto|cuanto|cuántos|cuantos|total|suma|promedio|media)\b/i,
  /\b(comparar?|comparación|diferencia entre)\b/i,
  /\b(nómina|nomina|planilla|salario|sueldo|pago)\b/i,
  /\b(empleado|trabajador|colaborador)\b/i,
  /\b(periodo|mes|año|trimestre|semestre)\b/i,
  /\b(costo|gasto|presupuesto|monto)\b/i,
  /\b(hallazgo|anomalía|anomalia|riesgo|error)\b/i,
  /\b(reporte|informe|estadística|estadistica|métrica|metrica)\b/i,
  /\b(mayor|menor|máximo|maximo|mínimo|minimo|top|ranking)\b/i,
  /\b(how much|how many|total|average|compare|payroll|salary)\b/i,
  /\b(consultar datos|consulta de datos|dame los datos)\b/i,
  /\b(desglose|distribución|distribucion|porcentaje)\b/i,
];

/**
 * Patterns that indicate general chat (not data queries).
 * These override data query patterns when matched.
 */
const GENERAL_CHAT_PATTERNS: RegExp[] = [
  /\b(crear?|crea|actualizar?|eliminar?|modificar?)\s+(regla|reglas)\b/i,
  /\b(explica|explicar?|qué es|que es|cómo funciona|como funciona)\b/i,
  /\b(ayuda|help|hola|hello|gracias|thanks)\b/i,
  /\b(configura|configurar?|ajustar?|cambiar?)\b/i,
];

/**
 * Classifies a user message as either a data query or general chat.
 *
 * Uses pattern matching with weighted scoring. Data query patterns
 * increase the score, general chat patterns decrease it.
 *
 * @param message - The user's message text
 * @returns Classification result with intent type and confidence
 */
export function classifyIntent(message: string): IntentClassification {
  const text = message.trim().toLowerCase();
  if (!text) {
    return { intent: 'general_chat', confidence: 1.0 };
  }

  let dataScore = 0;
  let generalScore = 0;

  for (const pattern of DATA_QUERY_PATTERNS) {
    if (pattern.test(text)) dataScore++;
  }

  for (const pattern of GENERAL_CHAT_PATTERNS) {
    if (pattern.test(text)) generalScore++;
  }

  // Question marks boost data query likelihood
  if (text.includes('?')) dataScore += 0.5;

  const totalPatterns = DATA_QUERY_PATTERNS.length + GENERAL_CHAT_PATTERNS.length;
  const rawScore = (dataScore - generalScore) / Math.max(totalPatterns * 0.3, 1);
  const confidence = Math.min(1, Math.max(0, 0.5 + rawScore * 0.5));

  const intent: IntentType = dataScore > generalScore ? 'data_query' : 'general_chat';

  return {
    intent,
    confidence,
    extractedQuery: intent === 'data_query' ? message.trim() : undefined,
  };
}

/** Suggested frequent NLQ queries for the quick action panel */
export const NLQ_SUGGESTED_QUERIES = [
  '¿Cuál es el costo total de nómina del último periodo?',
  '¿Cuántos hallazgos de riesgo alto hay?',
  'Comparar costos de nómina entre los últimos 3 meses',
  '¿Cuáles son los empleados con mayor riesgo?',
  'Desglose de aportes por concepto',
] as const;
