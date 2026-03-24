# Plan de Implementación: Rediseño del Dashboard

## Visión General

Implementación incremental del rediseño del dashboard de NominaSmart. Cada tarea construye sobre la anterior, comenzando con el hook de estado SSE centralizado, luego los paneles nuevos, la simplificación del sidebar, y finalmente la integración en el layout del dashboard.

## Tareas

- [x] 1. Crear el hook `usePipelineStream` y tipos compartidos
  - [x] 1.1 Crear archivo `src/lib/types/pipeline.ts` con las interfaces `LogEntry`, `SynthesisResult`, `ProviderSummary`, `ProcessStep` y `PipelineStreamState` según el diseño
    - Definir todos los tipos exportados que serán consumidos por los paneles
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.4_
  - [x] 1.2 Crear hook `src/hooks/usePipelineStream.ts` que encapsule la lógica SSE
    - Extraer la lógica de `parseSSEChunk` y `executeSSEStream` del `AiSidebar` actual
    - Implementar `startPipeline`, `clearLogs`, gestión de estado reactivo
    - Implementar reconexión con backoff exponencial (1s, 2s, 4s, máx 3 intentos)
    - Mapear eventos SSE (`agent-start`, `agent-complete`, `agent-communication`, `pipeline-complete`, `error`) a `LogEntry` y `SynthesisResult`
    - Limitar logs a 500 entradas (FIFO)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 7.1, 7.2, 7.3, 7.4, 7.5_
  - [x] 1.3 Escribir property test para mapeo de eventos SSE a LogEntry
    - **Property 5: Eventos SSE producen entradas de log correctas**
    - **Validates: Requirements 3.1, 3.2, 3.3, 7.1, 7.2, 7.4**
  - [x] 1.4 Escribir property test para backoff exponencial
    - **Property 12: Reconexión SSE usa backoff exponencial**
    - **Validates: Requirements 7.5**
  - [x] 1.5 Escribir property test para síntesis desde pipeline-complete
    - **Property 6: Pipeline completado produce síntesis completa**
    - **Validates: Requirements 4.1, 4.4, 7.3**
  - [x] 1.6 Escribir property test para acumulación incremental de síntesis
    - **Property 7: Resultados parciales actualizan síntesis incrementalmente**
    - **Validates: Requirements 4.2**

- [x] 2. Checkpoint — Verificar que el hook y tests pasan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Crear `ProviderStatusPanel`
  - [x] 3.1 Crear componente `src/components/ui/ProviderStatusPanel.tsx`
    - Renderizar resumen: total de proveedores y activos
    - Estado vacío con CTA prominente cuando no hay proveedores
    - Lista compacta de proveedores con nombre, tipo, estado activo/inactivo
    - Alerta visual para proveedores con `lastTestSuccess === false`
    - Enlace a `/settings/providers` para configuración completa
    - Usar tokens de diseño Obsidian Ledger (`colors`, `spacing`, `elevation`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 3.2 Escribir property test para conteo de proveedores
    - **Property 1: Conteo de proveedores coincide con datos de entrada**
    - **Validates: Requirements 1.1**
  - [x] 3.3 Escribir property test para renderizado completo de proveedores
    - **Property 2: Renderizado completo de información de proveedores**
    - **Validates: Requirements 1.4**
  - [x] 3.4 Escribir property test para alertas de test fallido
    - **Property 3: Alerta visual para proveedores con test fallido**
    - **Validates: Requirements 1.5**

- [x] 4. Crear `ProcessFlowPanel`
  - [x] 4.1 Crear componente `src/components/ui/ProcessFlowPanel.tsx`
    - Renderizar 4 pasos (carga, mapeo, validación, corrección) con estados visuales
    - Mostrar avatares de agentes asignados a cada paso usando `AgentAvatar`
    - Mostrar nombre y emoji de cada agente debajo del paso
    - Soportar múltiples agentes por paso (validación: Juli + Wil + Luni)
    - Indicador de check para pasos completados
    - Animación de progreso y avatar animado para paso activo
    - Navegación al hacer clic en pasos completados (href a `/upload`, `/reconcile`)
    - Reutilizar lógica de `GuidedFlow.tsx` como base
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 4.2 Escribir property test para agentes visibles en cada paso
    - **Property 4: Agentes visibles en cada paso del flujo de proceso**
    - **Validates: Requirements 2.2, 2.5, 2.6**

- [x] 5. Crear `LiveLogsPanel`
  - [x] 5.1 Crear componente `src/components/ui/LiveLogsPanel.tsx`
    - Renderizar lista de `LogEntry` con timestamp formateado, avatar del agente, mensaje
    - Diferenciar visualmente tipos de entrada (agent-start, agent-complete, agent-communication, error)
    - Mostrar metadata (tokens, latencia) para entradas de tipo `agent-complete`
    - Mostrar agentes origen/destino para entradas de tipo `agent-communication`
    - Auto-scroll hacia la entrada más reciente
    - Botón de limpiar logs
    - Usar tokens de diseño Obsidian Ledger
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6_
  - [x] 5.2 Escribir unit tests para LiveLogsPanel
    - Test renderizado con 0 logs (estado vacío)
    - Test renderizado con N logs de diferentes tipos
    - Test botón limpiar
    - _Requirements: 3.1, 3.6_

- [x] 6. Crear `LiveSynthesisPanel`
  - [x] 6.1 Crear componente `src/components/ui/LiveSynthesisPanel.tsx`
    - Estado vacío cuando `synthesis` es null
    - Renderizar resumen, nivel de riesgo, hallazgos, recomendaciones
    - Mostrar agentes contribuyentes con avatares y nombres
    - Indicador de carga durante ejecución (`isRunning`)
    - Usar tokens de diseño Obsidian Ledger
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 6.2 Escribir unit tests para LiveSynthesisPanel
    - Test estado vacío (synthesis null)
    - Test renderizado completo con datos de síntesis
    - Test indicador de carga
    - _Requirements: 4.1, 4.3_

- [x] 7. Checkpoint — Verificar que todos los paneles nuevos compilan y tests pasan
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Simplificar `AiSidebar`
  - [x] 8.1 Modificar `src/components/ui/AiSidebar.tsx`
    - Eliminar renderizado de `agentResults` chips (tokens, latencia) del bloque de mensaje
    - Eliminar sección de `busHistory` (comunicación inter-agente) del sidebar
    - Reducir `SUGGESTIONS` de 6 a 3 elementos
    - Eliminar renderizado de `streamingText` incremental
    - Simplificar indicador de typing a solo avatar + nombre del agente activo
    - Agregar enlace "Ver detalles en logs" en cada respuesta del asistente
    - Mantener la funcionalidad de envío de mensajes y persistencia en localStorage
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 8.2 Escribir property test para ausencia de detalles técnicos en sidebar
    - **Property 8: Sidebar no renderiza detalles técnicos**
    - **Validates: Requirements 6.3**

- [x] 9. Integrar todo en `DashboardClient`
  - [x] 9.1 Modificar `src/app/[locale]/dashboard/page.tsx` para obtener datos de proveedores
    - Agregar query a tabla `ai_providers` para obtener resumen de proveedores
    - Pasar `providers` como prop a `DashboardClient`
    - _Requirements: 1.1_
  - [x] 9.2 Modificar `src/components/ui/DashboardClient.tsx` con el nuevo layout
    - Importar y renderizar `ProviderStatusPanel`, `ProcessFlowPanel`, `LiveLogsPanel`, `LiveSynthesisPanel`
    - Integrar `usePipelineStream` hook para conectar logs y síntesis
    - Organizar en grid responsivo: 1 columna en mobile, 2 columnas en desktop para logs/síntesis y proveedores/flujo
    - Mantener secciones existentes (hero, métricas, filtros, charts, findings, companies)
    - Reemplazar `AgentTeamSection` por `ProcessFlowPanel` (más informativo)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10. Agregar claves de traducción i18n
  - [x] 10.1 Agregar claves de traducción en `messages/es.json`, `messages/en.json`, `messages/pt.json`
    - Claves para ProviderStatusPanel: títulos, estados, CTA
    - Claves para ProcessFlowPanel: nombres de pasos, descripciones
    - Claves para LiveLogsPanel: títulos, botón limpiar, tipos de entrada
    - Claves para LiveSynthesisPanel: títulos, estados vacíos, etiquetas
    - _Requirements: 5.5_
  - [x] 10.2 Escribir property test para existencia de claves de traducción
    - **Property 11: Claves de traducción existen para los tres idiomas**
    - **Validates: Requirements 5.5**

- [x] 11. Checkpoint final — Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Todas las tareas son obligatorias, incluyendo tests.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Los checkpoints aseguran validación incremental.
- Los property tests validan propiedades universales de correctitud.
- Los unit tests validan ejemplos específicos y edge cases.
