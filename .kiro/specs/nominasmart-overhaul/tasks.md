# Plan de Implementación: NominaSmart Overhaul

## Visión General

Revisión integral de NominaSmart — plataforma de auditoría de nómina multi-país con 7 agentes IA. El plan se enfoca en corregir, completar y mejorar el código existente (Next.js 16, React 19, Supabase, Tailwind CSS 4, Vitest + fast-check). Cada tarea construye sobre la anterior de forma incremental.

## Tareas

- [x] 1. Corregir RBAC en Middleware, API Guards y Sidebar
  - [x] 1.1 Refactorizar middleware Edge para verificar rol del usuario contra mapa de permisos por ruta, redirigir a `/login?redirectTo=...` si no autenticado, y retornar 403 si el rol no tiene acceso
    - Actualizar `src/middleware.ts` con lógica RBAC: admin → todas las rutas, analyst → todo excepto `/admin/*`, client → solo `/dashboard` y `/reports`
    - Asegurar que `redirectTo` preserve la URL original en el query param
    - _Requisitos: 1.3, 1.4, 1.7, 16.7_

  - [x] 1.2 Completar funciones de API guard (`requireAuth`, `requireAuthWithRole`, `requireAdmin`, `requireAnalystOrAdmin`) con validación de sesión Supabase y retorno de HTTP 401/403
    - Verificar que `requireAuth()` retorne 401 sin sesión válida
    - Verificar que los guards de rol retornen 403 si el rol no coincide
    - _Requisitos: 16.1, 16.7_

  - [x] 1.3 Implementar sanitización de inputs en API guard: `isValidUuid`, `sanitizeString`, `sanitizeEmail` con validación Zod
    - Agregar funciones de sanitización en `src/lib/api/guard.ts` o archivo dedicado
    - _Requisitos: 16.6_

  - [ ]* 1.4 Escribir property tests para RBAC, autenticación y sanitización
    - **Propiedad 1: Permisos RBAC por rol y ruta** — fast-check genera combinaciones rol×ruta y verifica acceso correcto
    - **Valida: Requisitos 1.3, 1.4, 16.7**
    - **Propiedad 33: Autenticación requerida en rutas protegidas** — sin sesión → 401
    - **Valida: Requisitos 16.1**
    - **Propiedad 32: Sanitización de inputs** — UUID, string, email
    - **Valida: Requisitos 16.6**

  - [x] 1.5 Actualizar Sidebar para filtrar enlaces según rol del usuario y mostrar flujo guiado de 3 pasos con indicadores de progreso reales
    - Modificar `src/components/layout/Sidebar.tsx` para ocultar rutas no autorizadas según rol
    - Implementar indicadores de progreso que reflejen estado real del pipeline
    - Actualizar paso activo en <100ms al cambiar de página
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.6 Escribir property test para índice de flujo guiado
    - **Propiedad 3: Cálculo de índice de flujo guiado** — `getFlowIndex` retorna 0 (fuera), 1 (upload), 2 (reconcile), 3 (reports)
    - **Valida: Requisitos 1.1**

  - [x] 1.7 Implementar redirect post-login a `redirectTo` o `/dashboard` por defecto
    - Modificar `src/app/auth/callback/route.ts` para leer `redirectTo` del query y redirigir
    - _Requisitos: 1.7, 1.8_

  - [ ]* 1.8 Escribir property test para redirect de autenticación
    - **Propiedad 2: Redirect de autenticación preserva URL destino** — URL de redirección contiene `redirectTo`
    - **Valida: Requisitos 1.7, 1.8**

- [x] 2. Checkpoint — Verificar que RBAC y navegación funcionan correctamente
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 3. Corregir Rate Limiting y seguridad de API
  - [x] 3.1 Implementar rate limiting por endpoint con presets configurables (auth: 10/min, AI: 20/min, chat: 30/min, admin: 30/min, read: 60/min, write: 40/min, cron: 5/min)
    - Actualizar `src/lib/api/rate-limit.ts` con ventanas de tiempo y contadores
    - Retornar HTTP 429 con header `Retry-After` cuando se excede el límite
    - _Requisitos: 16.2, 16.3_

  - [ ]* 3.2 Escribir property test para rate limiting
    - **Propiedad 31: Rate limiting por endpoint** — requests excedentes reciben 429 con Retry-After
    - **Valida: Requisitos 16.2, 16.3**

- [x] 4. Corregir Dashboard Ejecutivo
  - [x] 4.1 Refactorizar `DashboardClient` para carga paralela de datos (planillas, empresas, proveedores) con `Promise.all` y manejo resiliente de errores
    - Modificar componentes en `src/app/[locale]/admin/` o ruta correspondiente del dashboard
    - Renderizar con datos vacíos si alguna carga falla, sin errores no controlados
    - _Requisitos: 2.1, 2.6, 2.7, 24.1_

  - [x] 4.2 Implementar métricas principales (total planillas, certificables, fallas críticas, score riesgo promedio) en tarjetas con tendencias
    - Actualizar `DashboardMetrics` con cálculos correctos
    - _Requisitos: 2.1_

  - [x] 4.3 Implementar gráficos de tendencia de riesgo con Recharts (últimas 30 planillas) y panel de salud de proveedores IA
    - Actualizar `DashboardTrends` y `DashboardHealth`
    - _Requisitos: 2.2, 2.4_

  - [x] 4.4 Implementar filtrado por `company_id` para rol client y estado vacío con enlace a carga
    - Asegurar que queries filtren por company_id cuando rol es client
    - Mostrar `EmptyState` con enlace a `/upload` cuando no hay planillas
    - _Requisitos: 2.3, 2.5_

  - [ ]* 4.5 Escribir property test para filtrado por company_id y resiliencia del dashboard
    - **Propiedad 4: Filtrado de datos por company_id para rol client** — todos los registros pertenecen al company_id del usuario
    - **Valida: Requisitos 2.3**
    - **Propiedad 5: Dashboard resiliente a errores de carga** — renderiza sin excepciones ante cualquier combinación de éxito/error
    - **Valida: Requisitos 2.7**

- [x] 5. Corregir Pipeline de Carga y Procesamiento de Nómina (Upload)
  - [x] 5.1 Refactorizar `UploadPage` con Stepper de 4 pasos secuenciales y estado de pipeline (`PipelineState`)
    - Implementar flujo: (1) Carga + selección hojas, (2) Mapeo con Gyoru, (3) Verificación normativa, (4) Corrección + exportación
    - Mostrar resumen de resultados por paso y progreso acumulado
    - _Requisitos: 3.1, 3.14_

  - [x] 5.2 Corregir `UploadZone` para parseo de Excel/CSV con XLSX, detección de hojas, extracción de headers y detección automática de periodo
    - Parsear archivo, detectar hojas disponibles, extraer headers
    - Escanear primeras 20 filas buscando nombres de meses en español y años 2020-2030
    - Permitir crear empresa nueva sin salir del flujo
    - _Requisitos: 3.2, 3.3, 3.8_

  - [ ]* 5.3 Escribir property test para detección de periodo
    - **Propiedad 6: Detección automática de periodo en archivo** — extrae mes y año correctamente de las primeras 20 filas
    - **Valida: Requisitos 3.3**

  - [x] 5.4 Implementar carga dinámica de reglas normativas desde `/api/rules` con fallback a `FALLBACK_RULES` para CO y MX
    - Recargar reglas al cambiar país, actualizar año al más reciente disponible
    - _Requisitos: 3.6, 3.7_

  - [ ]* 5.5 Escribir property test para carga de reglas con fallback
    - **Propiedad 8: Carga de reglas con fallback** — si API falla, usa FALLBACK_RULES con al menos CO y MX
    - **Valida: Requisitos 3.6**

  - [x] 5.6 Implementar paso 3 (verificación): evaluar certificación verificando campos obligatorios y cálculos requeridos mapeados
    - Calcular cobertura de campos obligatorios según regla normativa activa
    - Certificación = true solo si cobertura es 100%
    - Mostrar faltantes de forma explícita
    - _Requisitos: 3.5, 3.9_

  - [ ]* 5.7 Escribir property test para cobertura de campos y certificación
    - **Propiedad 7: Cobertura de campos obligatorios y certificación** — cobertura = % campos presentes, certificación solo si 100%
    - **Valida: Requisitos 3.5, 3.9**

  - [x] 5.8 Implementar paso 4 (corrección): parsear matrices, ejecutar validación matemática local (14 checks) y validación IA en paralelo
    - Invocar `/api/ai/validation` en paralelo con validación local
    - Implementar `PayrollEditor` con corrección individual de celdas y registro de correcciones
    - _Requisitos: 3.10, 3.11_

  - [ ]* 5.9 Escribir property test para registro de correcciones
    - **Propiedad 9: Registro de correcciones en planilla** — cada corrección tiene hoja, fila, columna, valor anterior ≠ valor nuevo
    - **Valida: Requisitos 3.11, 6.5**

  - [x] 5.10 Implementar persistencia de planilla: guardar risk_report, math_validation_report, ai_validation_report, concept_summary, corrections, sheet_metadata
    - Mostrar indicador de éxito y ID de planilla guardada
    - Permitir ver y eliminar planillas recientes desde la página de carga
    - _Requisitos: 3.12, 3.13, 3.15_

- [x] 6. Checkpoint — Verificar pipeline de carga end-to-end
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 7. Corregir Mapeo Inteligente de Campos (Gyoru)
  - [x] 7.1 Refactorizar `MappingAI` para invocar `/api/ai/mapping` (Gyoru), proponer mapeo con categorías válidas y permitir edición manual
    - Cada campo mapeado debe tener categoría: identity, salary_base, non_salary, ibc, contribution, contract, informational
    - Campos obligatorios sin correspondencia se crean con status "created"
    - Permitir revisar, aceptar o modificar cada mapeo antes de confirmar
    - Fallback a mapeo manual si endpoint falla
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 7.2 Escribir property test para mapeo de campos
    - **Propiedad 10: Mapeo de campos produce relaciones válidas con categorías** — categorías válidas del enum, campos obligatorios sin match tienen status "created"
    - **Valida: Requisitos 4.1, 4.2, 4.3**

- [x] 8. Corregir Auditoría y Verificaciones Matemáticas (Juli)
  - [x] 8.1 Refactorizar el motor de auditoría para ejecutar las 14 verificaciones matemáticas con porcentajes y valores de referencia dinámicos desde `country_year_rules`
    - Cada hallazgo debe contener: ID verificación, etiqueta, filas pasadas, filas falladas, muestras
    - Reportar dependencias faltantes con sugerencias de potentialMatches
    - Generar reporte de validación con totales
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 8.2 Escribir property tests para verificaciones del auditor y dependencias faltantes
    - **Propiedad 11: Verificaciones matemáticas del auditor** — ejecuta verificaciones aplicables, hallazgos con estructura correcta
    - **Valida: Requisitos 5.1, 5.3**
    - **Propiedad 12: Dependencias faltantes reportadas con sugerencias** — reporta faltantes con potentialMatches
    - **Valida: Requisitos 5.4**

  - [x] 8.3 Implementar cálculo de score de riesgo por empleado: `high × 40 + medium × 20 + low × 10`
    - Solicitar auto-correcciones proactivas a Wil vía AgentBus tras completar auditoría
    - _Requisitos: 5.5, 5.7_

  - [ ]* 8.4 Escribir property test para score de riesgo
    - **Propiedad 13: Score de riesgo por empleado** — score = suma ponderada por severidad
    - **Valida: Requisitos 5.5**

- [x] 9. Corregir Correcciones Determinísticas (Wil)
  - [x] 9.1 Refactorizar el agente corrector para producir correcciones con fórmulas normativas explícitas usando `buildCorrectionFormulas(countryRules)`
    - Para hallazgos corregibles: fórmula normativa + valor esperado calculado
    - Para hallazgos no corregibles: `expertGuidance` con recomendaciones
    - _Requisitos: 6.1, 6.2, 6.3_

  - [ ]* 9.2 Escribir property test para correcciones determinísticas
    - **Propiedad 14: Correcciones determinísticas con fórmulas normativas** — corregibles tienen fórmula + valor, no corregibles tienen expertGuidance
    - **Valida: Requisitos 6.1, 6.2, 6.3**

  - [x] 9.3 Completar `PayrollEditor` para mostrar correcciones de Wil junto a celdas con hallazgo, permitir aceptar/rechazar individual y registrar en historial
    - _Requisitos: 6.4, 6.5_

- [x] 10. Corregir Reportes Ejecutivos (Ana)
  - [x] 10.1 Refactorizar agente Ana para agrupar hallazgos por categoría, priorizar por severidad (high > medium > low) y generar reporte narrativo completo
    - Reporte debe incluir: resumen ejecutivo, nivel de riesgo (score/100), análisis narrativo, hallazgos por empleado con recomendaciones y referencias normativas
    - _Requisitos: 7.1, 7.2_

  - [ ]* 10.2 Escribir property tests para agrupación de hallazgos y reporte ejecutivo
    - **Propiedad 15: Hallazgos agrupados por categoría y priorizados por severidad** — dentro de cada categoría, ordenados high > medium > low
    - **Valida: Requisitos 7.1**
    - **Propiedad 16: Reporte ejecutivo contiene secciones requeridas** — resumen, riesgo, análisis, hallazgos por empleado
    - **Valida: Requisitos 7.2**

  - [x] 10.3 Completar página de Reports: detalle del reporte más reciente, log de auditoría, estado vacío, eliminación con confirmación
    - Mostrar: empresa, riesgo global, cobertura variables, riesgo por empleado, validación matemática
    - _Requisitos: 7.3, 7.5, 7.6, 7.7_

  - [x] 10.4 Implementar exportación Excel con 3 hojas (Resumen, Riesgo Empleados, Cola de Acciones) usando XLSX en browser
    - _Requisitos: 7.4, 22.1, 22.2, 22.4_

  - [ ]* 10.5 Escribir property test para exportación Excel
    - **Propiedad 17: Exportación Excel con hojas correctas** — workbook con exactamente 3 hojas con nombres y headers esperados
    - **Valida: Requisitos 7.4, 22.1, 22.2**

- [x] 11. Checkpoint — Verificar pipeline de auditoría completo (Juli → Wil → Ana)
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 12. Corregir Conciliación y Revisión (Reconcile)
  - [x] 12.1 Refactorizar página Reconcile con tablero de 3 pasos: cobertura de campos, validación normativa, gestión de hallazgos por empleado
    - Obtener planilla más reciente y action items desde APIs
    - Mostrar panel normativo con campos obligatorios presentes/faltantes
    - _Requisitos: 8.1, 8.2, 8.3_

  - [x] 12.2 Implementar fusión de hallazgos (motor matemático + IA), deduplicación por documento de empleado, ordenamiento por score de riesgo descendente
    - _Requisitos: 8.4_

  - [ ]* 12.3 Escribir property test para fusión de hallazgos
    - **Propiedad 18: Fusión de hallazgos deduplicada y ordenada** — sin duplicados por doc empleado, ordenada por score descendente
    - **Valida: Requisitos 8.4**

  - [x] 12.4 Implementar creación y resolución de Action Items vía POST/PATCH a `/api/actions`, pre-llenar asignado con email del usuario
    - _Requisitos: 8.5, 8.6, 8.8_

- [x] 13. Corregir Chat IA Multi-Agente (AiSidebar)
  - [x] 13.1 Implementar conexión SSE a `/api/ai/orchestrate` con reconexión automática (backoff exponencial: 1s, 2s, 4s, max 3 intentos) y fallback a JSON
    - Renderizar respuestas incrementalmente con indicador de agente activo
    - _Requisitos: 9.1, 9.2, 9.3, 9.8, 9.9, 24.4_

  - [ ]* 13.2 Escribir property test para backoff exponencial
    - **Propiedad 21: Backoff exponencial en reintentos** — delays siguen 1s, 2s, 4s; tras 3 fallos marca como fallido
    - **Valida: Requisitos 9.8, 11.6, 11.7, 14.7**

  - [x] 13.3 Implementar persistencia de historial en localStorage, restauración al reabrir, botón de limpiar historial
    - _Requisitos: 9.4, 9.10_

  - [ ]* 13.4 Escribir property tests para historial de chat y deshabilitación de envío
    - **Propiedad 19: Persistencia de historial de chat en localStorage** — todos los mensajes en orden, limpiar vacía localStorage
    - **Valida: Requisitos 9.4, 9.10**
    - **Propiedad 20: Deshabilitación de envío en chat** — input vacío o procesando → botón deshabilitado
    - **Valida: Requisitos 9.5**

  - [x] 13.5 Implementar 4 acciones rápidas de agentes y sugerencias predefinidas en mensaje de bienvenida
    - Acciones: sincronizar reglas (Soul), auditar nómina (Juli), consultar normativa (Luni), generar reporte (Ana)
    - _Requisitos: 9.6, 9.7_

- [x] 14. Checkpoint — Verificar chat IA y conciliación
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 15. Completar Soporte Multi-País y Reglas Normativas
  - [x] 15.1 Asegurar que `country_year_rules` soporte los 7 países (CO, MX, PE, CL, BR, AR, US) con esquema validado por Zod
    - Verificar tabla `supported_countries` con los 7 países, moneda, frecuencia de sync
    - Implementar estados de regla: active, pending_review, draft
    - _Requisitos: 10.1, 10.2, 10.5_

  - [ ]* 15.2 Escribir property test para validación de reglas normativas
    - **Propiedad 22: Validación de reglas normativas** — country_code 2 chars, rule_year 2020-2030, arrays requeridos, status válido
    - **Valida: Requisitos 10.2, 10.5**

  - [x] 15.3 Completar página Rules para visualizar, crear y gestionar reglas por país y año (roles admin/analyst)
    - Cargar reglas disponibles al seleccionar país, presentar años disponibles
    - _Requisitos: 10.3, 10.4_

  - [x] 15.4 Completar Admin Countries para gestionar países soportados, activar/desactivar y configurar frecuencia de sync
    - _Requisitos: 10.7_

- [x] 16. Corregir Sincronización Regulatoria (Soul)
  - [x] 16.1 Refactorizar `SyncService` para procesar solo países activos, bootstrap para países sin reglas, borrador N+1 para países con reglas
    - Soul investiga con Firecrawl; fallback a REGULATION_DB con confianza baja
    - Retry con backoff exponencial (1s, 2s, 4s, max 3 intentos); marcar "failed" tras 3 fallos
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 16.2 Escribir property test para sync de países activos
    - **Propiedad 23: Sync procesa solo países activos** — solo is_active=true procesados; sin reglas → bootstrap, con reglas → borrador N+1
    - **Valida: Requisitos 11.2, 11.3, 11.4**

  - [x] 16.3 Implementar detección de cambios regulatorios: actualizar regla a pending_review, registrar en rule_audit_log, enviar notificación a admins
    - _Requisitos: 11.8_

  - [ ]* 16.4 Escribir property test para cambios regulatorios
    - **Propiedad 24: Cambios regulatorios generan regla pending_review** — regla en pending_review + audit_log + notificación a admins
    - **Valida: Requisitos 11.8**

  - [x] 16.5 Completar historial de sincronizaciones en Admin Usage con estado, país, año, trigger y reintentos
    - _Requisitos: 11.9_

- [x] 17. Completar Internacionalización (i18n)
  - [x] 17.1 Auditar y completar diccionarios de traducción en `messages/es.json`, `messages/en.json`, `messages/pt.json` para todas las páginas y componentes
    - Asegurar que todas las claves en es.json existan en en.json y pt.json
    - Implementar fallback a español si clave falta en en/pt
    - _Requisitos: 12.1, 12.4, 12.5_

  - [ ]* 17.2 Escribir property test para completitud de traducciones
    - **Propiedad 25: Completitud de traducciones i18n** — toda clave en es.json existe en en.json y pt.json
    - **Valida: Requisitos 12.1, 12.4, 12.5**

  - [x] 17.3 Verificar que LanguageToggle actualiza todas las etiquetas sin recargar página y que páginas públicas renderizan en locale activo
    - _Requisitos: 12.2, 12.3, 12.6_

- [x] 18. Checkpoint — Verificar multi-país, sync e i18n
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 19. Corregir Proveedores de IA y Fallback Chain
  - [x] 19.1 Refactorizar `executeWithFallback` para iterar proveedores en orden de prioridad, registrar eventos de fallback, y lanzar error combinado si todos fallan
    - _Requisitos: 13.1, 13.3_

  - [ ]* 19.2 Escribir property test para fallback chain
    - **Propiedad 26: Fallback chain de proveedores IA** — primeros K fallan → intenta K+1, registra K eventos; todos fallan → error combinado
    - **Valida: Requisitos 13.3**

  - [x] 19.3 Implementar encriptación AES-256-GCM para API keys de proveedores
    - _Requisitos: 13.4_

  - [ ]* 19.4 Escribir property test para round-trip de encriptación
    - **Propiedad 27: Round-trip de encriptación de API keys** — encrypt → decrypt = original
    - **Valida: Requisitos 13.4**

  - [x] 19.5 Completar selector de modelos con score compuesto (`costScore × cost_weight + quality × quality_weight`) y configuración de estrategia en Admin Optimization
    - _Requisitos: 13.6, 13.7_

  - [ ]* 19.6 Escribir property test para selección de modelo
    - **Propiedad 28: Selección de modelo por score compuesto** — modelo seleccionado tiene mejor score compuesto respetando umbral de calidad
    - **Valida: Requisitos 13.6**

  - [x] 19.7 Completar Settings Providers: configurar, activar/desactivar, reordenar prioridad, probar conectividad de cada proveedor
    - _Requisitos: 13.2, 13.5_

- [x] 20. Corregir Notificaciones y Alertas
  - [x] 20.1 Refactorizar `NotificationService` para soportar 3 severidades (info, warning, critical) y 3 tipos (regulatory_change, sync_complete, rule_pending)
    - Implementar broadcast a admins para eventos críticos
    - _Requisitos: 14.1, 14.2, 14.5_

  - [ ]* 20.2 Escribir property tests para notificaciones
    - **Propiedad 29: Validación de notificaciones** — severidad y tipo válidos, conteo no leídas = count(is_read=false)
    - **Valida: Requisitos 14.1, 14.2, 14.3**
    - **Propiedad 30: Marcar notificación como leída** — is_read=true, conteo decrementa en 1
    - **Valida: Requisitos 14.4**

  - [x] 20.3 Completar `NotificationBell` en Header con conteo de no leídas y marcar como leída vía PATCH
    - _Requisitos: 14.3, 14.4_

  - [x] 20.4 Implementar `EmailService` con Resend: invitaciones, alertas regulatorias, resúmenes semanales con plantillas localizadas y retry con backoff
    - _Requisitos: 14.6, 14.7_

- [x] 21. Corregir Orquestación Multi-Agente (Dianis)
  - [x] 21.1 Refactorizar orchestrator para clasificar intención, construir plan de ejecución, ejecutar fases secuenciales (Juli → Wil → Ana) vía AgentBus
    - Pasar resultados entre fases, consolidar en OrchestrateResponse
    - Registrar uso IA (tokens, latencia, costo) y guardar resultados en BD
    - Si un agente falla, continuar con los restantes
    - _Requisitos: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6_

  - [ ]* 21.2 Escribir property test para orquestación multi-agente
    - **Propiedad 34: Orquestación multi-agente completa** — ejecuta agentes en orden, pasa resultados, consolida respuesta; fallo de un agente no bloquea los demás
    - **Valida: Requisitos 21.1, 21.2, 21.3, 21.4, 21.6**

- [x] 22. Checkpoint — Verificar proveedores IA, notificaciones y orquestación
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 23. Completar Planes de Precios y Límites por Tier
  - [x] 23.1 Implementar página Pricing con 3 planes (Básico $99, Profesional $299, Empresarial personalizado) y tabla comparativa detallada
    - Mostrar disponibilidad de agentes, límites de empleados, cargas, países, soporte por plan
    - _Requisitos: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 23.2 Implementar aplicación de límites del plan en operaciones (empleados, cargas mensuales, agentes, países)
    - Rechazar operaciones que excedan límites con mensaje descriptivo
    - _Requisitos: 15.7_

  - [ ]* 23.3 Escribir property test para límites del plan
    - **Propiedad 36: Límites del plan aplicados** — operaciones que excedan límites son rechazadas con mensaje descriptivo
    - **Valida: Requisitos 15.7**

  - [x] 23.4 Completar Admin Pricing para gestionar planes y precios
    - _Requisitos: 15.6_

- [x] 24. Completar Panel Financiero de IA
  - [x] 24.1 Implementar Admin Finance con KPIs: costo total, tokens consumidos, latencia promedio, desglose por proveedor y por empresa
    - Gráficos de tendencia de costos y uso
    - Exportación a CSV
    - _Requisitos: 18.1, 18.2, 18.3, 18.4_

  - [ ]* 24.2 Escribir property tests para KPIs financieros y usage logger
    - **Propiedad 37: KPIs financieros calculados correctamente** — costo total = suma estimated_cost_usd, tokens = suma input+output, desglose por proveedor suma igual al total
    - **Valida: Requisitos 18.1, 18.4**
    - **Propiedad 38: Usage logger registra operaciones completas** — cada operación IA tiene provider_id, agent_name, model_id, tokens, latency, cost no nulos
    - **Valida: Requisitos 18.5**

  - [x] 24.3 Completar `UsageLogger` para registrar cada operación IA con todos los campos requeridos
    - _Requisitos: 18.5_

- [x] 25. Completar Gestión de Usuarios
  - [x] 25.1 Implementar Settings Users: invitar por email con rol, listar usuarios con rol/email/estado/empresa, reenviar invitaciones, cambiar rol, desactivar
    - Enviar email de invitación con enlace de activación vía EmailService
    - _Requisitos: 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 26. Completar Integraciones Externas
  - [x] 26.1 Implementar interfaz extensible `IntegrationConnector` con conectores para Siigo y Generic API
    - Configurar y probar conexiones vía `/api/integrations/test`
    - Registrar errores de integración sin interrumpir flujo principal
    - _Requisitos: 17.1, 17.2, 17.3, 17.4_

  - [ ]* 26.2 Escribir property test para fallo de integración
    - **Propiedad 40: Integración falla sin interrumpir flujo** — fallo registrado, flujo principal continúa sin excepción
    - **Valida: Requisitos 17.4**

- [x] 27. Checkpoint — Verificar precios, finanzas, usuarios e integraciones
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 28. Corregir Páginas Públicas y Contenido de Marketing
  - [x] 28.1 Actualizar Landing page con capacidades reales: 7 agentes IA con nombres/roles, soporte multi-país, 14 verificaciones, reportes ejecutivos
    - Preview de dashboard, flujo visual de 4 pasos con avatares de agentes
    - Testimonios, CTA hacia registro/demo
    - _Requisitos: 20.1, 20.2, 20.6, 20.7_

  - [x] 28.2 Completar páginas About, Manual y Contact
    - About: misión, equipo de agentes, propuesta de valor
    - Manual: documentación completa con navegación lateral
    - Contact: formulario funcional para demos y soporte
    - _Requisitos: 20.3, 20.4, 20.5_

  - [x] 28.3 Completar PublicLayout: header sticky glassmorphism responsive, footer con enlaces, menú hamburguesa móvil
    - Footer: secciones del sitio, redes sociales, enlaces legales
    - _Requisitos: 1.6, 20.8, 20.9_

- [x] 29. Manejo de Errores, Estados Vacíos y Rendimiento
  - [x] 29.1 Implementar error boundaries (`error.tsx`), loading states (`loading.tsx`) y not-found (`not-found.tsx`) para cada sección principal
    - Mensajes de error contextuales sin detalles técnicos
    - Indicadores de carga (spinner/skeleton) durante operaciones asíncronas
    - EmptyState con icono, mensaje y acción sugerida
    - Preservar datos de formulario en fallo de guardado
    - _Requisitos: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [ ]* 29.2 Escribir property test para mensajes de error
    - **Propiedad 35: Mensajes de error sin detalles técnicos** — sin stack traces, paths internos, queries SQL
    - **Valida: Requisitos 23.2**

  - [x] 29.3 Implementar optimizaciones de rendimiento: Web Workers para archivos >1000 filas, lazy loading de Recharts y editor, límite de 30 planillas recientes
    - _Requisitos: 24.2, 24.3, 24.5_

  - [ ]* 29.4 Escribir property test para límite de consultas
    - **Propiedad 39: Consultas limitadas a 30 planillas** — resultado contiene máximo 30 entradas
    - **Valida: Requisitos 24.5**

  - [x] 29.5 Implementar log de auditoría de reglas con retención 5 años, trazabilidad de origen (manual/automático) y fuentes
    - _Requisitos: 16.5_

  - [x] 29.6 Exportación de datos financieros a CSV desde Admin Finance
    - _Requisitos: 22.3_

- [x] 30. Checkpoint final — Verificar toda la aplicación
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Los checkpoints aseguran validación incremental.
- Los property tests validan propiedades universales de correctitud con fast-check (mínimo 100 iteraciones).
- Los unit tests validan ejemplos específicos y edge cases.
- El stack es TypeScript con Next.js 16, React 19, Supabase, Tailwind CSS 4, Vitest + fast-check.
