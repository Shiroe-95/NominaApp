# Plan de Implementación: Platform Premium Upgrade

## Visión General

Implementación incremental del rediseño visual premium y la mejora de inteligencia de agentes IA para NominaSmart. Cada tarea construye sobre las anteriores, priorizando la infraestructura central antes de los componentes visuales.

## Tareas

- [x] 1. Crear sistema de diseño premium con tokens centralizados
  - [x] 1.1 Crear `src/lib/design-tokens.ts` con escala tipográfica (6 niveles), paleta semántica, escala de espaciado (múltiplos de 4px) y niveles de elevación (4 niveles)
    - Exportar constantes tipadas para typography, colors, spacing, elevation
    - Agregar variables CSS custom properties en `src/app/globals.css`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [-]* 1.2 Escribir test de propiedad para tokens de espaciado
    - **Property 1: Los valores de espaciado son múltiplos de 4**
    - **Validates: Requirements 1.3**
  - [x] 1.3 Crear funciones utilitarias de tendencia y agregación para dashboard
    - Implementar `calculateTrend(current, previous)` que retorna dirección y porcentaje
    - Implementar `aggregateFindingsBySeverity(findings)` que agrupa hallazgos
    - _Requirements: 4.1, 4.3_
  - [ ]* 1.4 Escribir tests de propiedad para cálculo de tendencia y agregación de severidad
    - **Property 5: El cálculo de indicadores de tendencia es correcto**
    - **Validates: Requirements 4.1**
    - **Property 6: La distribución de hallazgos por severidad es consistente**
    - **Validates: Requirements 4.3**

- [x] 2. Implementar serialización de planes de ejecución
  - [x] 2.1 Crear `src/lib/ai/plan-serializer.ts` con funciones `serializePlan` y `deserializePlan`
    - Definir tipos `DynamicPlan` y `PlanAdaptation`
    - Serializar a JSON con todos los pasos, dependencias y adaptaciones
    - Deserializar reconstruyendo el plan completo
    - _Requirements: 13.1, 13.2, 13.3_
  - [ ]* 2.2 Escribir test de propiedad para ida y vuelta de serialización
    - **Property 26: Ida y vuelta de serialización de planes de ejecución**
    - **Validates: Requirements 13.3**

- [x] 3. Checkpoint - Verificar que los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 4. Mejorar AgentBus con comunicación proactiva y validación cruzada
  - [x] 4.1 Extender `src/lib/ai/agents/agent-bus.ts` con AgentBusV2
    - Agregar callback `onMessage` para emisión de eventos de streaming
    - Implementar método `sendWithEvent` que emite evento al enviar mensaje
    - Implementar método `requestCrossValidation` para validación cruzada entre agentes
    - Mantener compatibilidad con la interfaz actual de AgentBus
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 4.2 Escribir tests de propiedad para AgentBus v2
    - **Property 14: El AgentBus enruta mensajes entre cualquier par de agentes registrados**
    - **Validates: Requirements 8.1, 8.2, 8.3**
    - **Property 15: El AgentBus registra todas las comunicaciones con campos requeridos**
    - **Validates: Requirements 8.4**
    - **Property 16: Timeout del AgentBus retorna error sin bloquear**
    - **Validates: Requirements 8.5**
    - **Property 17: El AgentBus previene ciclos a profundidad máxima 5**
    - **Validates: Requirements 8.6**

- [x] 5. Implementar clasificador contextual de intención
  - [x] 5.1 Crear `src/lib/ai/agents/intent-classifier.ts` con clasificación contextual
    - Extraer lógica de clasificación de `master.ts` a módulo separado
    - Considerar últimos 5 mensajes del historial conversacional
    - Incluir campo de confianza (0-1) en el resultado
    - Priorizar intenciones de auditoría/corrección cuando hay datos de nómina
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 5.2 Escribir tests de propiedad para clasificador contextual
    - **Property 7: El clasificador usa como máximo 5 mensajes del historial**
    - **Validates: Requirements 6.1**
    - **Property 8: La confianza de clasificación está entre 0 y 1**
    - **Validates: Requirements 6.2**
    - **Property 9: Confianza baja dispara solicitud de clarificación**
    - **Validates: Requirements 6.3**

- [x] 6. Implementar planificador dinámico adaptativo
  - [x] 6.1 Crear `src/lib/ai/agents/dynamic-planner.ts` con planificación adaptativa
    - Implementar `buildDynamicPlan(intent, context)` que genera plan inicial
    - Implementar `evaluateAndAdapt(plan, stepResult, stepIndex)` que adapta el plan según resultados
    - Agregar corrector automáticamente cuando hay hallazgos de severidad alta
    - Agregar experto en nómina cuando hay hallazgos no determinísticos
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 6.2 Escribir tests de propiedad para planificador dinámico
    - **Property 10: Hallazgos de alta severidad agregan el corrector al plan**
    - **Validates: Requirements 7.2**
    - **Property 11: Hallazgos no determinísticos agregan el experto al plan**
    - **Validates: Requirements 7.3**
    - **Property 12: Fallo de un agente preserva resultados de los demás**
    - **Validates: Requirements 7.4, 12.1**
    - **Property 13: Adaptación del plan emite evento de notificación**
    - **Validates: Requirements 7.5**

- [x] 7. Checkpoint - Verificar que los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 8. Implementar validación cruzada entre agentes
  - [x] 8.1 Crear `src/lib/ai/agents/cross-validator.ts` con lógica de validación cruzada
    - Implementar validación de correcciones del corrector por el auditor
    - Implementar validación de datos numéricos en reportes del redactor
    - Generar advertencias cuando se detectan inconsistencias
    - _Requirements: 9.1, 9.2, 9.3_
  - [ ]* 8.2 Escribir tests de propiedad para validación cruzada
    - **Property 18: Validación cruzada de correcciones por el auditor**
    - **Validates: Requirements 9.1**
    - **Property 19: Validación cruzada de datos numéricos en reportes**
    - **Validates: Requirements 9.2**
    - **Property 20: Inconsistencias generan advertencia visible**
    - **Validates: Requirements 9.3**

- [x] 9. Implementar motor de streaming y mejorar endpoint de orquestación
  - [x] 9.1 Crear `src/lib/ai/streaming.ts` con PipelineStreamEmitter
    - Implementar emisión de eventos SSE (agent-start, agent-complete, agent-communication, plan-updated, pipeline-complete, error)
    - Integrar con AgentBus v2 para emitir eventos de comunicación inter-agente
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 9.2 Refactorizar `src/app/api/ai/orchestrate/route.ts` para usar streaming SSE
    - Cambiar de respuesta JSON a streaming SSE
    - Integrar clasificador contextual, planificador dinámico y motor de streaming
    - Implementar manejo robusto de errores con preservación de resultados parciales
    - _Requirements: 11.1, 12.1, 12.2, 12.3, 12.4_
  - [ ]* 9.3 Escribir tests de propiedad para motor de streaming y manejo de errores
    - **Property 24: Eventos de streaming corresponden a fases del ciclo de vida**
    - **Validates: Requirements 11.2, 11.3, 11.4**
    - **Property 25: Errores se registran con contexto completo**
    - **Validates: Requirements 12.3**

- [x] 10. Integrar Master Agent v2 con todos los módulos nuevos
  - [x] 10.1 Refactorizar `src/lib/ai/agents/master.ts` para usar los nuevos módulos
    - Reemplazar `classifyRequestType` y `classifyIntentFromMessages` con el clasificador contextual
    - Reemplazar `buildPlan` con el planificador dinámico
    - Usar AgentBus v2 con callbacks de streaming
    - Integrar validación cruzada en el flujo post-ejecución
    - Mantener compatibilidad con el flujo existente
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 8.1, 9.1, 9.2, 9.3_

- [x] 11. Checkpoint - Verificar que los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 12. Mejorar detección de formato y mapeo universal de nómina
  - [x] 12.1 Crear `src/lib/payroll/format-detector.ts` con detección automática de formato
    - Detectar CSV (con delimitador), XLSX y JSON por extensión y contenido
    - Retornar tipo de formato y metadatos (delimitador, encoding)
    - _Requirements: 10.1_
  - [x] 12.2 Mejorar `src/lib/ai/agents/mapper.ts` para mapeo universal
    - Presentar 3 opciones cuando la confianza de mapeo es ≤ 0.7
    - Crear campos personalizados para columnas no reconocidas
    - _Requirements: 10.3, 10.5_
  - [ ]* 12.3 Escribir tests de propiedad para detección de formato y mapeo
    - **Property 21: Detección automática de formato de archivo**
    - **Validates: Requirements 10.1**
    - **Property 22: Mapeo de baja confianza presenta 3 opciones**
    - **Validates: Requirements 10.3**
    - **Property 23: Columnas no reconocidas generan campos personalizados**
    - **Validates: Requirements 10.5**

- [x] 13. Mejorar componentes visuales del pipeline y sidebar
  - [x] 13.1 Actualizar `src/components/ui/AgentPipeline.tsx` con tokens de diseño premium
    - Reemplazar valores hardcodeados con tokens del sistema de diseño
    - Agregar soporte para recibir eventos de streaming y actualizar estado en tiempo real
    - Agregar animación de conexión entre agentes durante comunicación inter-agente
    - Agregar indicador visual de adaptación dinámica del plan
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 13.2 Actualizar `src/components/ui/AiSidebar.tsx` con streaming SSE y UX mejorada
    - Reemplazar fetch simple con conexión SSE usando EventSource
    - Agregar indicador de escritura que muestra agente activo con avatar
    - Implementar renderizado incremental de contenido durante streaming
    - Agregar reconexión automática si se pierde la conexión
    - Reemplazar valores hardcodeados con tokens del sistema de diseño
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 13.3 Escribir tests de propiedad para pipeline y sidebar
    - **Property 2: La agregación de resumen del pipeline es correcta**
    - **Validates: Requirements 2.4**
    - **Property 3: El pipeline maneja entre 1 y 7 pasos sin error**
    - **Validates: Requirements 2.5**
    - **Property 4: Ida y vuelta de persistencia del historial de chat**
    - **Validates: Requirements 3.5**

- [x] 14. Mejorar dashboard y componentes de métricas
  - [x] 14.1 Actualizar componentes de dashboard con tokens de diseño premium
    - Actualizar `DashboardMetrics.tsx` con tarjetas de métricas mejoradas e indicadores de tendencia
    - Actualizar `DashboardCharts.tsx` con paleta semántica del sistema de diseño
    - Actualizar `DashboardHealth.tsx` y `DashboardTrends.tsx` con tokens premium
    - Agregar tooltips informativos en elementos de gráficos
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 15. Implementar micro-interacciones y animaciones
  - [x] 15.1 Agregar animaciones y transiciones al sistema de diseño
    - Definir clases de transición para hover/focus (< 150ms) en `globals.css`
    - Definir animaciones de cambio de estado (200-400ms)
    - Implementar micro-interacciones de confirmación para acciones exitosas
    - Implementar esqueletos de carga (skeletons) para estados de carga
    - Aplicar variantes responsivas para pantallas < 768px
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 1.5_

- [x] 16. Checkpoint final - Verificar que todos los tests pasan
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan propiedades universales de correctitud
- Los tests unitarios validan ejemplos específicos y casos borde
