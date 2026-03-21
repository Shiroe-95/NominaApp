# Plan de Implementación: NóminaSmart Refactor

## Visión General

Implementación incremental del refactor consolidada en 17 tareas: infraestructura, proveedores IA, agentes especializados, orquestación, UI premium, páginas públicas, autenticación por roles, dashboard y flujo de carga, chat IA y gestión de proveedores, integración, soporte multi-idioma/multi-moneda, motor de reglas multi-país, agente investigador y bus de agentes, panel financiero y gestión de usuarios, e integración final extendida.

## Tareas

- [x] 1. Configurar infraestructura base, dependencias y modelos de datos
  - [x] 1.1 Instalar dependencias y configurar testing
    - Ejecutar `npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google @openrouter/ai-sdk-provider`
    - Ejecutar `npm install -D vitest fast-check`
    - Crear `vitest.config.ts` con configuración para TypeScript y path aliases
    - _Requisitos: 3.1_

  - [x] 1.2 Crear migración de base de datos
    - Crear `scripts/002_refactor_tables.sql` con tablas `user_profiles`, `ai_providers`, `ai_usage_logs`
    - Incluir constraints, índices, trigger `handle_new_user`, políticas RLS y extensión `pgcrypto`
    - _Requisitos: 1.2, 17.1, Diseño: Modelos de Datos_

  - [x] 1.3 Crear esquemas Zod y tipos TypeScript compartidos
    - Crear `src/lib/ai/types.ts` con interfaces: `ProviderConfig`, `AgentContext`, `AgentResult`, `AgentDefinition`, `OrchestratorPlan`, `OrchestrateRequest`, `OrchestrateResponse`
    - Crear `src/lib/ai/schemas.ts` con esquemas Zod: `ProviderConfigSchema`, `AgentResultSchema`, `OrchestrateRequestSchema`
    - _Requisitos: 16.1, 16.2_

  - [ ]* 1.4 Escribir test de propiedad para round-trip de ProviderConfig
    - **Propiedad 1: Ida y vuelta de configuración de proveedor**
    - Generar `ProviderConfig` arbitrarios válidos con `fast-check`, verificar que `parse(JSON.parse(JSON.stringify(config)))` produce objeto equivalente
    - Mínimo 100 iteraciones
    - **Valida: Requisitos 16.3**

- [x] 2. Implementar capa de proveedores de IA con fallback y registro de uso
  - [x] 2.1 Implementar cifrado de API keys y Provider Registry dinámico
    - Crear `src/lib/ai/encryption.ts` con `encryptApiKey`/`decryptApiKey` usando AES-256-GCM
    - Crear `src/lib/ai/providers.ts` con `buildRegistry` usando `createProviderRegistry` del Vercel AI SDK para los 5 proveedores
    - _Requisitos: 1.2, 3.1, 3.2, 3.3_

  - [x] 2.2 Implementar cadena de fallback y registro de uso
    - Crear `src/lib/ai/fallback.ts` con `executeWithFallback` que ordena por prioridad, intenta en secuencia y registra eventos
    - Crear `src/lib/ai/usage-logger.ts` con `logAiUsage` y `getUsageStats` para insertar/agregar en `ai_usage_logs`
    - _Requisitos: 2.2, 2.3, 2.4, 17.1, 17.2, 17.3_

  - [ ]* 2.3 Escribir tests de propiedad para fallback, ordenamiento y uso
    - **Propiedad 2: Cadena de fallback intenta el siguiente proveedor** — Generar cadenas de N proveedores con K primeros fallando, verificar que K+1 es usado. **Valida: Requisitos 2.2**
    - **Propiedad 3: Registro de eventos de fallback** — Verificar que cada fallback genera log con proveedor original, respaldo y razón. **Valida: Requisitos 2.4, 17.3**
    - **Propiedad 4: Ordenamiento de prioridad** — Reordenar proveedores y verificar que la lista respeta el nuevo orden. **Valida: Requisitos 2.1**
    - **Propiedad 13: Creación de registro de uso** — Verificar que cada llamada (exitosa o fallida) produce registro con todos los campos. **Valida: Requisitos 17.1**
    - **Propiedad 14: Agregación de estadísticas** — Verificar total_calls = count, total_tokens = sum, error_rate = failures/total. **Valida: Requisitos 17.2**
    - Mínimo 100 iteraciones cada una

- [x] 3. Implementar API CRUD de proveedores y estadísticas de uso
  - [x] 3.1 Crear rutas API de gestión de proveedores
    - Crear `src/app/api/settings/providers/route.ts` (GET listar, POST crear + validar conectividad)
    - Crear `src/app/api/settings/providers/[id]/route.ts` (PUT actualizar, DELETE eliminar)
    - Crear `src/app/api/settings/providers/[id]/test/route.ts` (POST test conectividad)
    - Crear `src/app/api/settings/providers/reorder/route.ts` (PUT reordenar prioridades)
    - Cifrar API keys al guardar, enmascarar al retornar al frontend
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1_

  - [x] 3.2 Crear ruta API de estadísticas de uso
    - Crear `src/app/api/settings/usage/route.ts` con GET que retorna estadísticas agregadas por proveedor
    - _Requisitos: 17.2_

- [x] 4. Implementar agentes especializados (Auditor, Redactor, Corrector, Mapeador, Nómina)
  - [x] 4.1 Implementar Agente Auditor
    - Crear `src/lib/ai/agents/auditor.ts` reutilizando `ruleValidation.ts` como herramienta
    - Ejecutar 14 verificaciones matemáticas, generar hallazgos estructurados con severidad/norma/valores, retornar resumen por severidad y categoría
    - _Requisitos: 5.1, 5.2, 5.3_

  - [x] 4.2 Implementar Agente Redactor
    - Crear `src/lib/ai/agents/writer.ts` con system prompt de redacción ejecutiva
    - Generar reporte con resumen, nivel de riesgo, hallazgos agrupados por categoría/severidad, referencias normativas
    - _Requisitos: 6.1, 6.2, 6.3_

  - [x] 4.3 Implementar Agente Corrector
    - Crear `src/lib/ai/agents/corrector.ts` con fórmulas normativas colombianas
    - Incluir índice de fila, campo, valor actual/sugerido, justificación. Omitir cuando no es determinístico
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 4.4 Implementar Agente Mapeador
    - Crear `src/lib/ai/agents/mapper.ts` con diccionario de sinónimos + IA para ambigüedades
    - Clasificar relaciones por categoría, crear campos snake_case para columnas sin estándar
    - _Requisitos: 8.1, 8.2, 8.3_

  - [x] 4.5 Implementar Agente de Nómina
    - Crear `src/lib/ai/agents/payroll-expert.ts` con herramientas CRUD de reglas normativas
    - System prompt especializado en normativa laboral colombiana, personalizar con datos del archivo procesado
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 4.6 Escribir tests de propiedad para agentes
    - **Propiedad 7: Estructura de hallazgos del Auditor** — Verificar que cada hallazgo contiene documento no vacío, descripción, severidad válida, norma, valores numéricos. **Valida: Requisitos 5.2**
    - **Propiedad 8: Conteo de resumen del Auditor** — Verificar sum(por_severidad) == total y sum(por_categoría) == total. **Valida: Requisitos 5.3**
    - **Propiedad 10: Correcciones válidas del Corrector** — Verificar rowIndex >= 0, fieldName no vacío, suggestedValue != currentValue, justificación con fórmula. **Valida: Requisitos 7.1, 7.2**
    - **Propiedad 11: Completitud de mapeo** — Verificar cada columna tiene un campo destino, categoría válida, campos no estándar en snake_case. **Valida: Requisitos 8.1, 8.2, 8.3**
    - Mínimo 100 iteraciones cada una

- [x] 5. Implementar Agente Maestro y ruta API de orquestación
  - [x] 5.1 Implementar Agente Maestro (Orquestador)
    - Crear `src/lib/ai/agents/master.ts` con clasificación de intención, plan de ejecución, ejecución secuencial con paso de resultados, y consolidación de respuesta
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.2 Crear ruta API unificada de orquestación
    - Crear `src/app/api/ai/orchestrate/route.ts` que delega al Agente Maestro
    - Soportar tipos: chat, validate, map, correct, full-analysis
    - Registrar uso de IA en `ai_usage_logs` para cada llamada
    - _Requisitos: 4.1, 17.1_

- [x] 6. Checkpoint — Verificar backend completo
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 7. Implementar tokens de diseño, componentes UI premium y páginas públicas
  - [x] 7.1 Rediseñar tokens de diseño y crear componentes UI
    - Actualizar `src/app/globals.css` con paleta premium (colores, radios, sombras, tipografía)
    - Crear componentes: `Stepper`, `MetricCard`, `AgentChip`, `ProviderCard`, `ProgressBar`, `EmptyState` en `src/components/ui/`
    - _Requisitos: 11.1, 11.2, 11.3, 14.1_

  - [x] 7.2 Crear páginas públicas de marketing
    - Crear `src/app/[locale]/(public)/layout.tsx` con header público
    - Crear landing page `(public)/page.tsx` con hero, beneficios, funcionalidades, testimonios, CTA
    - Crear `(public)/pricing/page.tsx` con planes y comparativa
    - Crear `(public)/contact/page.tsx` con formulario de demo
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8. Implementar autenticación por roles, dashboard y flujo de carga
  - [x] 8.1 Implementar middleware de autorización y helpers de perfil
    - Actualizar `src/middleware.ts` para validar sesión y verificar rol contra rutas protegidas
    - Crear `src/lib/auth/user-profile.ts` con `getUserProfile`, `getUserRole`, `hasPermission`
    - _Requisitos: Diseño: Middleware de Autorización, Roles del Sistema_

  - [x] 8.2 Implementar dashboard adaptado por rol
    - Actualizar `src/app/[locale]/(app)/page.tsx` para renderizar según rol (admin/analista/cliente)
    - Usar `MetricCard`, gráficos interactivos con tooltips y filtros por período/empresa
    - _Requisitos: 13.1, 13.2, 13.3_

  - [x] 8.3 Rediseñar flujo de carga con pipeline guiado
    - Actualizar `src/app/[locale]/(app)/upload/` con `Stepper` de 6 etapas, prerrequisitos, instrucciones contextuales, transiciones animadas, drag-and-drop y barra de progreso
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5, 15.1, 15.2, 15.3, 15.4_

  - [ ]* 8.4 Escribir test de propiedad para prerrequisitos del pipeline
    - **Propiedad 12: Prerrequisitos de etapas del pipeline**
    - Generar estados de pipeline con prerrequisitos incompletos, verificar que avance es bloqueado
    - Mínimo 100 iteraciones
    - **Valida: Requisitos 12.5**

- [x] 9. Rediseñar chat de IA y UI de gestión de proveedores
  - [x] 9.1 Implementar panel de chat con visibilidad de agentes
    - Actualizar `src/components/ui/AiSidebar.tsx` con `AgentChip`, progreso de sub-tareas en tiempo real, chips de resultado, historial de conversaciones
    - Conectar al endpoint `/api/ai/orchestrate`
    - _Requisitos: 14.1, 14.2, 14.3, 14.4_

  - [x] 9.2 Crear página de gestión de proveedores y estadísticas
    - Crear `src/app/[locale]/(app)/settings/providers/page.tsx` con `ProviderCard`, formulario CRUD, drag-and-drop de prioridades, test de conectividad
    - Crear `src/app/[locale]/(app)/admin/usage/page.tsx` con gráficos de uso, tokens, tasa de error, fallbacks
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 17.2, 17.3_

- [x] 10. Responsividad, transiciones y checkpoint final
  - [x] 10.1 Asegurar diseño responsivo y transiciones suaves
    - Revisar todos los componentes nuevos para escritorio, tablet y móvil
    - Agregar transiciones CSS entre páginas y estados de carga
    - Agregar feedback visual en interacciones (hover, focus, loading)
    - _Requisitos: 11.3, 11.4_

  - [x] 10.2 Checkpoint final — Verificar integración completa
    - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 11. Implementar soporte multi-idioma (i18n) y multi-moneda
  - [x] 11.1 Extender sistema i18n con soporte dinámico de idiomas
    - Crear `messages/pt.json` con traducciones al portugués (copiar estructura de `es.json`)
    - Crear `src/lib/i18n/locale-config.ts` con utilidades para cargar mensajes dinámicamente y validar completitud de archivos
    - Agregar selector de idioma en la página de configuración del usuario (`settings/page.tsx`)
    - Almacenar preferencia de idioma en `user_profiles` (agregar columna `preferred_locale`)
    - _Requisitos: 18.1, 18.2, 18.3, 18.4_

  - [x] 11.2 Implementar formateo multi-moneda y configuración de países
    - Crear `src/lib/i18n/currency.ts` con `formatCurrency` y `parseCurrencyValue` usando `Intl.NumberFormat`
    - Crear migración `scripts/003_multi_country_tables.sql` con tablas `supported_countries`, `task_pricing`, `infrastructure_costs`, `provider_token_rates`, `applied_corrections`, `agent_communications`, `research_sources`
    - Insertar datos iniciales para Colombia (CO), México (MX), Perú (PE), Chile (CL), Brasil (BR), Argentina (AR), Estados Unidos (US)
    - _Requisitos: 19.1, 19.2, 19.3, 20.1, 20.5_

  - [ ]* 11.3 Escribir tests de propiedad para i18n y moneda
    - **Propiedad 16: Ida y vuelta de formateo de moneda** — Para cualquier valor numérico y locale, formatear y parsear produce valor equivalente. **Valida: Requisitos 19.2, 21.3**
    - **Propiedad 24: Completitud de archivos de mensajes i18n** — Para cualquier locale soportado, todas las claves del locale base existen. **Valida: Requisitos 18.1**
    - **Propiedad 25: Datos de nómina almacenan código de moneda** — Para cualquier registro almacenado, currency_code es válido ISO 4217. **Valida: Requisitos 19.3**
    - Mínimo 100 iteraciones cada una

- [x] 12. Implementar soporte multi-país en motor de reglas y Agente Auditor
  - [x] 12.1 Refactorizar motor de reglas para ser extensible por país
    - Refactorizar `src/lib/ai/ruleValidation.ts` para cargar reglas dinámicamente desde `country_year_rules` según `countryCode` y `year` en lugar de usar tasas hardcodeadas de Colombia
    - Crear `src/lib/ai/rule-engine.ts` con interfaz genérica `CountryRuleEngine` que cada país implementa
    - Actualizar `AgentContext` para incluir `locale` y `currencyCode`
    - _Requisitos: 20.3, 20.4_

  - [x] 12.2 Extender Agente Mapeador para archivos internacionales
    - Actualizar `src/lib/ai/agents/mapper.ts` para detectar idioma de columnas y usar IA para mapeo cross-idioma
    - Agregar parseo de formatos numéricos y de fecha según Locale_Config del país
    - _Requisitos: 21.1, 21.2, 21.3_

  - [ ]* 12.3 Escribir test de propiedad para reglas multi-país
    - **Propiedad 17: Reglas normativas extensibles por país y año** — Para cualquier país/año configurado, el auditor aplica solo las reglas de ese país/año. **Valida: Requisitos 20.1, 20.3**
    - Mínimo 100 iteraciones

- [x] 13. Implementar Agente Investigador Regulatorio y Bus de Agentes
  - [x] 13.1 Implementar Agente Investigador Regulatorio
    - Crear `src/lib/ai/agents/researcher.ts` con herramientas de búsqueda web (usando tool calling del Vercel AI SDK)
    - System prompt especializado en investigación de normativa laboral por país
    - Implementar creación/actualización de reglas en `country_year_rules` con fuentes en `research_sources`
    - Implementar detección de cambios comparando reglas existentes vs nuevas
    - _Requisitos: 22.1, 22.2, 22.3, 22.4, 22.5_

  - [x] 13.2 Implementar Bus de Agentes para comunicación inter-agente
    - Crear `src/lib/ai/agents/agent-bus.ts` con clase `AgentBus`
    - Implementar enrutamiento de mensajes entre agentes, detección de ciclos por profundidad máxima, y registro en `agent_communications`
    - Integrar Bus en el Agente Maestro para que los agentes puedan solicitar ayuda de otros durante su ejecución
    - _Requisitos: 25.1, 25.2, 25.3, 25.4_

  - [x] 13.3 Extender Agente Corrector con aplicación de correcciones
    - Actualizar `src/lib/ai/agents/corrector.ts` para soportar aplicación directa de correcciones aprobadas
    - Implementar aprobación individual y en lote (atómica usando transacciones SQL)
    - Registrar correcciones en `applied_corrections` con valores antes/después
    - Implementar re-ejecución de validaciones afectadas después de aplicar correcciones
    - _Requisitos: 26.1, 26.2, 26.3, 26.4, 26.5_

  - [ ]* 13.4 Escribir tests de propiedad para investigador, bus y correcciones
    - **Propiedad 18: Resultados de investigación incluyen fuentes** — Para cualquier investigación completada, el resultado contiene fuentes con URL válida. **Valida: Requisitos 22.2**
    - **Propiedad 19: Detección de cambios regulatorios** — Para cualquier par de reglas con diferencias, se genera alerta con campos cambiados. **Valida: Requisitos 22.3**
    - **Propiedad 22: Bus de Agentes y detección de ciclos** — Para cualquier mensaje válido, el bus enruta correctamente; si hay ciclo, detiene la cadena. **Valida: Requisitos 25.1, 25.3, 25.4**
    - **Propiedad 23: Aplicación de correcciones con trazabilidad** — Para cualquier corrección aprobada, datos actualizados + registro creado + revalidación ejecutada. Lotes son atómicos. **Valida: Requisitos 26.2, 26.3, 26.4**
    - Mínimo 100 iteraciones cada una

- [ ] 14. Checkpoint — Verificar agentes extendidos y multi-país
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [ ] 15. Implementar Panel Financiero y Gestión de Usuarios
  - [~] 15.1 Crear API y página de gestión de usuarios
    - Crear `src/app/api/admin/users/route.ts` (GET listar, POST crear usuario en Supabase Auth + perfil)
    - Crear `src/app/api/admin/users/[id]/route.ts` (PUT actualizar rol/empresa/estado, DELETE desactivar)
    - Crear `src/app/[locale]/(app)/settings/users/page.tsx` con tabla de usuarios, formulario CRUD, filtros por rol/empresa/estado
    - _Requisitos: 24.1, 24.2, 24.3, 24.4, 24.5_

  - [~] 15.2 Crear API y página del Panel Financiero
    - Crear `src/app/api/admin/finance/route.ts` con endpoints para: tokens por usuario/agente/proveedor, cálculo de costos por tarifas, ingresos por tareas, rentabilidad
    - Crear `src/app/[locale]/(app)/admin/finance/page.tsx` con dashboard financiero: gráficos de tokens, costos vs ingresos, margen de ganancia, costo por nómina
    - Crear `src/app/[locale]/(app)/admin/pricing/page.tsx` para configurar precios por tipo de tarea
    - _Requisitos: 23.1, 23.2, 23.3, 23.4, 23.5_

  - [~] 15.3 Crear página de gestión de países
    - Crear `src/app/[locale]/(app)/admin/countries/page.tsx` con CRUD de países soportados, configuración de moneda/locale, y botón para activar investigación de normativa
    - _Requisitos: 20.5_

  - [ ]* 15.4 Escribir tests de propiedad para finanzas y usuarios
    - **Propiedad 20: Correctitud de cálculos financieros** — Costo total = sum(tokens * rate), margen = ingresos - costos. **Valida: Requisitos 23.1, 23.2, 23.4, 23.5**
    - **Propiedad 21: Cambios de rol afectan permisos** — Cambiar rol o desactivar usuario afecta verificaciones de acceso inmediatamente. **Valida: Requisitos 24.3, 24.4, 24.5**
    - Mínimo 100 iteraciones cada una

- [ ] 16. Integrar comunicación inter-agente en UI del chat
  - [~] 16.1 Actualizar panel de chat para mostrar comunicaciones inter-agente
    - Actualizar `src/components/ui/AiSidebar.tsx` para visualizar mensajes del Bus de Agentes como sub-pasos dentro del flujo
    - Mostrar qué agente solicita ayuda de cuál otro, con indicadores visuales de progreso
    - _Requisitos: 25.5, 14.2_

  - [~] 16.2 Agregar selector de país/año en flujo de carga
    - Actualizar `src/app/[locale]/(app)/upload/` para solicitar país y año antes del mapeo
    - Mostrar moneda y formato numérico del país seleccionado
    - Si no hay reglas para el país/año, ofrecer botón para activar Agente Investigador
    - _Requisitos: 20.2, 20.4_

- [ ] 17. Checkpoint final extendido — Verificar integración completa multi-país
  - Asegurar que todos los tests pasan incluyendo las nuevas propiedades 16-25
  - Verificar que el flujo completo funciona para al menos 2 países diferentes (Colombia + otro)
  - Preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los tests de propiedad usan `fast-check` con mínimo 100 iteraciones cada uno
- Las 15 propiedades originales del diseño están cubiertas en las tareas 1.4, 2.3, 4.6 y 8.4
- Las 10 propiedades nuevas (16-25) están cubiertas en las tareas 11.3, 12.3, 13.4 y 15.4
- Las tareas 1-10 corresponden al alcance original (proveedores, agentes, UI premium)
- Las tareas 11-17 corresponden al alcance extendido (multi-país, multi-idioma, multi-moneda, investigador, finanzas, usuarios, bus de agentes, correcciones aplicables)
