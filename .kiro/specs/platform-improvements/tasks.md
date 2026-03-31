# Tareas de Implementación — NominaSmart Platform Improvements

## Eje 1: Rendimiento y Escalabilidad

- [x] 1. Virtual Scrolling para Tablas de Nómina
  - [x] 1.1 Extender `useVirtualScroll` en `src/lib/performance/virtual-scroll.ts` para soportar alturas de fila variables (`itemHeight: number | ((index: number) => number)`)
  - [x] 1.2 Reducir umbral de virtualización de 100 a 50 filas (`VIRTUAL_SCROLL_THRESHOLD = 50`)
  - [x] 1.3 Implementar preservación de estado de selección/edición en filas recicladas (mapa de estado por índice)
  - [x] 1.4 Implementar recálculo de filas visibles al aplicar filtro y scroll automático al primer resultado
  - [x] 1.5 Implementar columnas sticky (fijas) para identificación de empleado durante scroll horizontal
  - [x] 1.6 Implementar fallback a paginación tradicional (50 filas/página) cuando `IntersectionObserver` no está disponible
  - [x] 1.7 Escribir tests PBT para Propiedades 1, 2, 3, 4 (filas visibles, preservación de estado, filtro, alturas variables)

- [x] 2. Caché de Reglas Normativas de 2 Niveles
  - [x] 2.1 Crear clase `TwoLevelCache` en `src/lib/cache/` que envuelva `RedisCacheLayer` con un Map L1 en memoria
  - [x] 2.2 Implementar evicción LRU en L1 con límite de 200 entradas
  - [x] 2.3 Implementar TTL diferenciado por estado de regla: 3600s (active), 300s (pending_review/draft)
  - [x] 2.4 Implementar invalidación inmediata de cache al actualizar regla (L1 + L2)
  - [x] 2.5 Implementar degradación graceful: operar solo con L1 si Redis no está disponible
  - [x] 2.6 Implementar métricas de hit rate, miss rate y latencia por nivel de cache
  - [x] 2.7 Integrar `TwoLevelCache` en los endpoints de reglas normativas (`src/app/api/rules/`)
  - [x] 2.8 Escribir tests PBT para Propiedades 5, 6, 7, 8, 9, 10 (round-trip, TTL, invalidación, L1/L2, métricas, LRU)

- [x] 3. Web Workers para Cómputos Pesados
  - [x] 3.1 Crear `WorkerManager` en `src/lib/workers/` con interfaz unificada para ejecutar, cancelar y recibir progreso de Workers
  - [x] 3.2 Extender `excel-parser.worker.ts` para reportar progreso parcial cada 500ms
  - [x] 3.3 Crear `anomaly-detect.worker.ts` para ejecutar detección de anomalías en Worker cuando >50 empleados
  - [x] 3.4 Crear `forecast-calc.worker.ts` para ejecutar cálculos de forecasting en Worker cuando >3 periodos
  - [x] 3.5 Implementar cancelación de Workers con timeout de 1 segundo y `terminate()`
  - [x] 3.6 Implementar fallback a ejecución en hilo principal cuando Workers no están soportados
  - [x] 3.7 Crear componente `WorkerProgress` con barra de progreso, porcentaje y botón de cancelar

## Eje 2: Testing y Calidad de Código

- [x] 4. Property-Based Testing con fast-check
  - [x] 4.1 Crear `src/lib/ai/rule-engine.pbt.test.ts` — PBT para determinismo del rule-engine (Propiedad 11)
  - [x] 4.2 Crear `src/lib/ai/plan-serializer.pbt.test.ts` — PBT round-trip de serialización (Propiedad 12)
  - [x] 4.3 Crear `src/lib/ai/encryption.pbt.test.ts` — PBT round-trip de cifrado (Propiedad 13)
  - [x] 4.4 Crear `src/lib/ai/model-selector.pbt.test.ts` — PBT optimalidad de selección (Propiedad 14)
  - [x] 4.5 Crear `src/lib/payroll/format-detector.pbt.test.ts` — PBT detección de formato (Propiedad 15)
  - [x] 4.6 Configurar cada test PBT con mínimo 100 iteraciones y tag `Feature: platform-improvements, Property N`

- [x] 5. Tests End-to-End con Playwright
  - [x] 5.1 Instalar Playwright y configurar `playwright.config.ts` con Chromium + Firefox
  - [x] 5.2 Crear fixtures de datos de prueba aislados en `e2e/fixtures/`
  - [x] 5.3 Crear test E2E para flujo de login (exitoso, fallido, redirect a ruta protegida)
  - [x] 5.4 Crear test E2E para pipeline de carga de nómina (4 pasos: carga, mapeo, verificación, guardado)
  - [x] 5.5 Crear test E2E para visualización de reportes (métricas, exportación Excel, historial)
  - [x] 5.6 Crear test E2E para chat con agentes IA (envío, streaming, acciones rápidas)
  - [x] 5.7 Crear test E2E para gestión de reglas normativas
  - [x] 5.8 Agregar script `npm run test:e2e` en `package.json`

## Eje 3: Experiencia de Usuario y Accesibilidad

- [x] 6. Manejo de Errores Consistente en API
  - [x] 6.1 Crear interfaz `ApiErrorResponse` y función `createApiError()` en `src/lib/api/guard.ts`
  - [x] 6.2 Crear wrapper `withApiHandler()` que captura excepciones, genera `X-Request-Id` UUID v4 y retorna formato estándar
  - [x] 6.3 Implementar manejo de errores Zod (400 VALIDATION_ERROR con detalles de campos)
  - [x] 6.4 Implementar respuestas 401 UNAUTHORIZED, 403 FORBIDDEN y 429 RATE_LIMITED con formato estándar
  - [x] 6.5 Migrar endpoints existentes para usar `withApiHandler()` y `createApiError()`
  - [x] 6.6 Escribir tests PBT para Propiedades 16, 17, 18, 19 (formato estándar, X-Request-Id, 500 sin stack, Zod 400)

- [x] 7. Motor de Temas (Claro/Oscuro/Auto)
  - [x] 7.1 Definir tokens semánticos CSS custom properties para tema claro y oscuro en `src/app/globals.css`
  - [x] 7.2 Crear `ThemeProvider` y hook `useTheme()` en `src/lib/` con soporte para light/dark/auto
  - [x] 7.3 Implementar persistencia en localStorage (`nominasmart-theme`) con aplicación antes del primer render (anti-FOUC)
  - [x] 7.4 Implementar detección de `prefers-color-scheme` para modo auto con listener de cambios en tiempo real
  - [x] 7.5 Crear componente `ThemeToggle` con iconos sol/luna/monitor para el header
  - [x] 7.6 Generar tema claro como inversión semántica del Obsidian Ledger existente
  - [x] 7.7 Escribir tests PBT para Propiedades 20, 21 (persistence round-trip, tokens definidos)

- [x] 8. Dashboards Personalizables
  - [x] 8.1 Crear sistema de grilla responsiva con drag-and-drop para widgets (1/2/3-4 columnas por breakpoint)
  - [x] 8.2 Implementar catálogo de 8 widgets: métricas, tendencia riesgo, anomalías, forecast, actividad, proveedores IA, action items, salud sistema
  - [x] 8.3 Implementar persistencia de layout en `user_profiles.dashboard_layout` (JSONB) con esquema Zod
  - [x] 8.4 Crear 3 layouts predefinidos por rol: ejecutivo, analista, administrador
  - [x] 8.5 Implementar botón de restaurar layout predeterminado por rol
  - [x] 8.6 Implementar aislamiento de errores por widget (error boundary individual con opción de reintentar)
  - [x] 8.7 Escribir tests PBT para Propiedades 22, 23 (layout round-trip, error isolation)

## Eje 4: Integración de Funcionalidades Avanzadas

- [x] 9. Colaboración en Tiempo Real
  - [x] 9.1 Crear componentes `PresenceIndicator` y `CollaborationBanner` que consuman `collaboration-engine.ts`
  - [x] 9.2 Implementar UI de resolución de conflictos (`ConflictDialog`) con opción de revertir
  - [x] 9.3 Implementar límite de 10 usuarios simultáneos por planilla con mensaje de rechazo
  - [x] 9.4 Implementar reconexión automática con sincronización de cambios pendientes (ventana de 5 min)
  - [x] 9.5 Escribir tests PBT para Propiedades 24, 25, 26 (last-write-wins, reconexión, límite 10)

- [x] 10. Anotaciones y Comentarios sobre Hallazgos
  - [x] 10.1 Crear componentes `AnnotationBadge`, `AnnotationThread` y `AnnotationForm` con soporte de menciones
  - [x] 10.2 Integrar anotaciones en PayrollEditor (celdas) y Página Reconcile (hallazgos, action items)
  - [x] 10.3 Implementar hilos de respuesta con `parent_id` y resolución de anotaciones sin eliminación
  - [x] 10.4 Integrar con `notification-service.ts` para notificaciones de menciones (@usuario)
  - [x] 10.5 Escribir tests PBT para Propiedades 27, 28, 29, 30 (CRUD, hilos, resolución, badge count)

- [x] 11. Integración de Detección de Anomalías en Pipeline
  - [x] 11.1 Modificar pipeline de auditoría para invocar Anomaly Detector automáticamente después del paso 3
  - [x] 11.2 Integrar resultados de anomalías en el reporte de validación junto a las 14 verificaciones
  - [x] 11.3 Crear widget de anomalías para dashboard con clasificación por confianza y categoría
  - [x] 11.4 Implementar comparación con 6 periodos anteriores y fallback a benchmarks de industria
  - [x] 11.5 Implementar generación de explicaciones en lenguaje natural para cada anomalía
  - [x] 11.6 Escribir tests PBT para Propiedades 31, 32 (comparación histórica, explicaciones)

- [x] 12. Integración de NLQ en Chat de IA
  - [x] 12.1 Modificar Sidebar IA para clasificar intención y delegar consultas de datos al NLQ Engine
  - [x] 12.2 Implementar renderizado enriquecido de respuestas NLQ (tablas, métricas, gráficos inline)
  - [x] 12.3 Implementar clarificación de consultas ambiguas con botones seleccionables
  - [x] 12.4 Implementar filtrado RBAC en respuestas NLQ y mostrar fuentes de datos
  - [x] 12.5 Crear acción rápida "Consultar datos" con sugerencias de consultas frecuentes
  - [x] 12.6 Escribir tests PBT para Propiedades 33, 34 (RBAC, fuentes de datos)

- [x] 13. Exposición de Forecasting en UI
  - [x] 13.1 Crear widget de forecast para dashboard con gráfico de líneas y bandas de confianza
  - [x] 13.2 Implementar recálculo automático de proyecciones al cargar nuevos datos
  - [x] 13.3 Crear sección de forecast en Página Reports con parámetros ajustables
  - [x] 13.4 Implementar alerta de notificación cuando incremento de costos > 15%
  - [x] 13.5 Escribir tests PBT para Propiedades 35, 36 (factores de forecast, alerta >15%)

## Eje 5: Capacidades Enterprise

- [x] 14. Integración de SSO/SAML/OIDC en UI
  - [x] 14.1 Crear sección "Autenticación SSO" en Settings con formulario de configuración de IdP
  - [x] 14.2 Implementar botón "Iniciar sesión con SSO corporativo" en Página Login (condicional)
  - [x] 14.3 Implementar mapeo de atributos IdP a perfil NominaSmart y JIT provisioning
  - [x] 14.4 Implementar timeout de 10s para IdP con fallback a login email/contraseña
  - [x] 14.5 Implementar test de conexión SSO y visualización de estado (activo/inactivo/error)
  - [x] 14.6 Escribir tests PBT para Propiedades 37, 38 (mapeo atributos, JIT provisioning)

- [x] 15. Integración de Workspaces Multi-Equipo en UI
  - [x] 15.1 Crear componente `WorkspaceSelector` en el header con cambio de workspace sin cerrar sesión
  - [x] 15.2 Crear sección "Workspaces" en Settings con CRUD de workspaces y gestión de miembros
  - [x] 15.3 Implementar filtrado de datos por `workspace_id` en dashboard, planillas, reportes y acciones
  - [x] 15.4 Implementar invitación de usuarios a workspace con email
  - [x] 15.5 Escribir tests PBT para Propiedades 39, 40 (filtrado por workspace, RLS isolation)

- [x] 16. Integración de Webhooks en UI
  - [x] 16.1 Crear sección "Webhooks" en Settings con CRUD, activación/desactivación y límite de 10 por workspace
  - [x] 16.2 Implementar formulario de creación con selección de eventos y generación automática de secreto HMAC
  - [x] 16.3 Implementar test de webhook y log de entregas recientes con opción de reenvío
  - [x] 16.4 Implementar retry con backoff exponencial (30s, 60s, 120s, máx 5 intentos)
  - [x] 16.5 Escribir tests PBT para Propiedades 41, 42, 43, 44, 45 (HMAC, log, firma, retry, límite)

- [x] 17. Operaciones Masivas (Bulk) en UI
  - [x] 17.1 Implementar selección múltiple con checkboxes en Página Reports y Página Reconcile
  - [x] 17.2 Crear barra de acciones masivas con operaciones: exportar, eliminar, re-auditar, cambiar estado, asignar
  - [x] 17.3 Implementar barra de progreso con porcentaje, registros procesados y tiempo estimado
  - [x] 17.4 Implementar manejo de fallos parciales: completar exitosos, reportar fallidos, ofrecer reintento
  - [x] 17.5 Implementar confirmación explícita para operaciones destructivas (campo de texto de confirmación)
  - [x] 17.6 Escribir tests PBT para Propiedad 46 (manejo de fallos parciales)

## Eje 6: Experiencia de Desarrollador

- [x] 18. Documentación OpenAPI/Swagger Interactiva
  - [x] 18.1 Configurar Swagger UI o Scalar en `/api/docs` con autenticación requerida
  - [x] 18.2 Extender `generateOpenApiSpec()` para documentar todos los endpoints v1 con descripciones, parámetros, bodies, respuestas y ejemplos
  - [x] 18.3 Incluir documentación de autenticación (Bearer token, API key) y esquemas de error estándar
  - [x] 18.4 Escribir tests PBT para Propiedades 47, 48 (Zod→OpenAPI, completitud de endpoints)

- [x] 19. SDK para Integraciones Programáticas
  - [x] 19.1 Extender `nominasmart-client.ts` con métodos tipados para todas las operaciones principales
  - [x] 19.2 Generar tipos TypeScript del SDK a partir de esquemas Zod existentes
  - [x] 19.3 Implementar manejo automático de autenticación (token storage, refresh, retry 401 con backoff)
  - [x] 19.4 Agregar JSDoc completo a cada método público (descripción, params, return, ejemplo)
  - [x] 19.5 Implementar configuración de base URL, timeout y headers personalizados
  - [x] 19.6 Crear página de documentación del SDK en la sección de desarrolladores
  - [x] 19.7 Escribir tests PBT para Propiedades 49, 50 (tipos Zod, configuración SDK)

- [x] 20. Storybook para Biblioteca de Componentes
  - [x] 20.1 Instalar y configurar Storybook 8+ con React 19, Tailwind CSS 4 y Obsidian Ledger
  - [x] 20.2 Crear stories para 15 componentes base: Button, Input, Select, Dialog, Card, Table, Tabs, Toast, Badge, Avatar, Tooltip, DropdownMenu, ProgressBar, Skeleton, Sidebar
  - [x] 20.3 Crear stories para 4 componentes compuestos: PayrollTable, AISidebar, DashboardWidget, RuleEditor
  - [x] 20.4 Configurar renderizado dual (tema claro + oscuro) para todas las stories
  - [x] 20.5 Crear sección de Design Tokens (colores, tipografía, espaciado, sombras)
  - [x] 20.6 Agregar script `npm run storybook` en `package.json`
  - [x] 20.7 Escribir tests PBT para Propiedades 51 (renderizado dual de temas)

## Eje 7: Monitoreo y Observabilidad

- [x] 21. Dashboard de Health Check y Monitoreo
  - [x] 21.1 Crear página admin "Salud del Sistema" que consume `/api/v1/health` con auto-refresh cada 30s
  - [x] 21.2 Mostrar estado por servicio: Supabase, Redis, 5 proveedores IA, Firecrawl, Resend, disco
  - [x] 21.3 Implementar notificaciones críticas para admins al cambiar estado de servicio (healthy→degraded/down)
  - [x] 21.4 Implementar historial de incidentes de últimas 24h y métricas agregadas (uptime, latencia, incidentes)
  - [x] 21.5 Integrar verificaciones de salud con MetricsCollector para análisis histórico
  - [x] 21.6 Escribir tests PBT para Propiedades 52, 53, 54, 55 (detalles servicio, notificaciones, métricas, MetricsCollector)

- [x] 22. Integración de Error Tracking con Sentry
  - [x] 22.1 Instalar y configurar Sentry SDK para cliente (React) y servidor (Next.js API routes)
  - [x] 22.2 Configurar source maps para stack traces con código TypeScript original
  - [x] 22.3 Implementar filtrado de PII antes de enviar eventos (API keys, tokens, datos de nómina)
  - [x] 22.4 Configurar captura de contexto: breadcrumbs, usuario, URL, navegador, versión, tags
  - [x] 22.5 Configurar alertas automáticas (>10 errores/min, nuevo tipo de error)
  - [x] 22.6 Configurar captura de Web Vitals (LCP, FID, CLS) para páginas principales
  - [x] 22.7 Escribir tests PBT para Propiedades 56, 57 (evento completo, filtrado PII)

- [x] 23. Distributed Tracing para Solicitudes API
  - [x] 23.1 Crear middleware de tracing que genera trace ID UUID v4 y lo propaga via `X-Request-Id`
  - [x] 23.2 Implementar creación de spans para operaciones críticas (auth, validación, DB, IA, serialización, webhooks)
  - [x] 23.3 Implementar spans hijos para orquestación multi-agente (nombre, duración, tokens, resultado)
  - [x] 23.4 Incluir trace ID en todos los logs generados durante procesamiento de solicitudes
  - [x] 23.5 Crear vista "Traces Recientes" en Health Dashboard (últimas 50 solicitudes con detalle expandible)
  - [x] 23.6 Integrar con Sentry Performance para visualización de traces
  - [x] 23.7 Escribir tests PBT para Propiedades 58, 59, 60 (trace ID único, logs, spans)
