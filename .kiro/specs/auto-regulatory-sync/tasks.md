# Plan de Implementación: Sincronización Regulatoria Automática Multi-País

## Visión General

Implementación incremental del sistema de sincronización regulatoria automática. Se comienza con la capa de datos, luego los servicios core, las API routes, y finalmente los cambios de UI. Cada paso construye sobre el anterior, asegurando que no quede código huérfano.

## Tareas

- [x] 1. Migración de base de datos y tipos core
  - [x] 1.1 Crear script SQL de migración con las 4 nuevas tablas y alteraciones
    - Crear `scripts/004_regulatory_sync_tables.sql` con las tablas `sync_history`, `rule_audit_log`, `notifications`, `email_log`
    - Agregar columna `status` a `country_year_rules` (default `'approved'`) con índice
    - Agregar columnas `invitation_status`, `preferred_locale`, `alert_countries` a `user_profiles`
    - Incluir índices definidos en el diseño y políticas RLS permisivas
    - _Requisitos: 1.3, 1.5, 3.1, 3.2, 5.1, 6.1, 7.1, 8.3_

  - [x] 1.2 Crear interfaces TypeScript compartidas para los nuevos modelos de datos
    - Crear `src/lib/types/regulatory-sync.ts` con interfaces: `SyncHistoryRow`, `RuleAuditLogRow`, `NotificationRow`, `EmailLogRow`, `SyncOptions`, `SyncResult`, `AuditEntry`, `SendEmailOptions`, `SendEmailResult`, `CreateNotificationOptions`, `ParsedRuleConstants`
    - Extender `CountryYearRuleRow` en `rule-engine.ts` para incluir campo `status`
    - Asegurar que el script SQL es válido y los tipos compilan sin errores
    - _Requisitos: 1.3, 3.2, 5.1, 6.1, 8.3_

- [x] 2. Servicios de auditoría y notificaciones
  - [x] 2.1 Implementar AuditService (`src/lib/audit/audit-service.ts`)
    - Implementar `logAudit(entry)` que inserta en `rule_audit_log` con validación condicional: si `origin='automatic'` requiere `sourceIds`, si `origin='manual'` requiere `userId`
    - Implementar `getAuditHistory(ruleId)` que retorna entradas ordenadas por `created_at` ascendente
    - _Requisitos: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Escribir test de propiedad para AuditService — Propiedad 16
    - **Propiedad 16: Auditoría completa con datos condicionales**
    - **Valida: Requisitos 6.1, 6.2, 6.3**

  - [ ]* 2.3 Escribir test de propiedad para AuditService — Propiedad 17
    - **Propiedad 17: Historial de auditoría ordenado cronológicamente**
    - **Valida: Requisito 6.4**

  - [x] 2.4 Implementar NotificationService (`src/lib/notifications/notification-service.ts`)
    - Implementar `createNotification(options)` que inserta en tabla `notifications`, con broadcast a admins si `userId` es null
    - Implementar `markAsRead(notificationId, userId)` que establece `is_read=true` y `read_at`
    - Implementar `getUnreadCount(userId)` que retorna conteo de notificaciones no leídas
    - Mapear confianza a severidad: `high` → `info`, `medium`/`low` → `warning`
    - _Requisitos: 5.1, 5.2, 5.3, 5.5_

  - [ ]* 2.5 Escribir test de propiedad para NotificationService — Propiedad 14
    - **Propiedad 14: Mapeo de confianza a severidad de notificación**
    - **Valida: Requisitos 5.1, 5.2, 5.3**

  - [ ]* 2.6 Escribir test de propiedad para NotificationService — Propiedad 15
    - **Propiedad 15: Marcar notificación como leída**
    - **Valida: Requisito 5.5**

- [x] 3. Servicio de email con Resend y plantillas
  - [x] 3.1 Crear plantillas de email localizadas (`src/lib/email/templates/index.ts`)
    - Implementar `userInvitationTemplate(data)` con soporte para locales `en`, `es`, `pt`
    - Implementar `regulatoryAlertTemplate(data)` con soporte para locales `en`, `es`, `pt`
    - Implementar `weeklySummaryTemplate(data)` con soporte para locales `en`, `es`, `pt`
    - Cada función retorna `{ subject, html }` en el idioma correspondiente
    - _Requisitos: 8.5, 8.7_

  - [x] 3.2 Implementar EmailService (`src/lib/email/email-service.ts`)
    - Implementar `sendEmail(options)` usando `fetch` contra `https://api.resend.com/emails` con header `Authorization: Bearer RESEND_API_KEY`
    - Implementar reintentos (3 intentos, backoff exponencial) respetando `Retry-After` en 429
    - Registrar cada envío en tabla `email_log` con `to_email`, `email_type`, `status`, `resend_message_id`, `sent_at`
    - Filtrar destinatarios de alertas regulatorias por `alert_countries` del usuario
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.6_

  - [ ]* 3.3 Escribir test de propiedad para EmailService — Propiedad 22
    - **Propiedad 22: Alertas enviadas solo a destinatarios configurados por país**
    - **Valida: Requisitos 8.2, 8.6**

  - [ ]* 3.4 Escribir test de propiedad para EmailService — Propiedad 23
    - **Propiedad 23: Registro completo de envío de email**
    - **Valida: Requisito 8.3**

  - [ ]* 3.5 Escribir test de propiedad para EmailService — Propiedad 24
    - **Propiedad 24: Reintentos de email limitados a 3**
    - **Valida: Requisito 8.4**

  - [ ]* 3.6 Escribir test de propiedad para EmailService — Propiedad 25
    - **Propiedad 25: Plantillas localizadas según idioma del destinatario**
    - **Valida: Requisito 8.7**

- [x] 4. Motor de reglas dinámico
  - [x] 4.1 Refactorizar `src/lib/ai/rule-engine.ts` para eliminar hardcodeo
    - Implementar `parseChecksToConstants(checks)` que extrae valores numéricos (SMMLV, porcentajes, topes) desde strings de checks
    - Implementar `formatConstantsToChecks(constants, template)` para el round-trip inverso
    - Implementar `loadAndValidateRules(countryCode, year)` que carga reglas desde BD y retorna `CountryRuleEngine`
    - Mantener `CO_CONSTANTS` y `getHardcodedConstants()` como fallback temporal pero marcar como deprecated
    - Retornar error descriptivo si no existen reglas para país/año solicitado
    - Asegurar que todos los tests pasan tras la refactorización
    - _Requisitos: 4.1, 4.2, 4.4, 4.5_

  - [ ]* 4.2 Escribir test de propiedad para motor de reglas — Propiedad 11
    - **Propiedad 11: Motor de reglas carga constantes dinámicamente**
    - **Valida: Requisitos 4.1, 4.4**

  - [ ]* 4.3 Escribir test de propiedad para motor de reglas — Propiedad 12
    - **Propiedad 12: Parseo de checks extrae valores numéricos correctamente**
    - **Valida: Requisito 4.5**

  - [ ]* 4.4 Escribir test de propiedad para motor de reglas — Propiedad 13
    - **Propiedad 13: Round-trip de parseo/formateo de reglas**
    - **Valida: Requisito 4.6**

- [x] 5. Agente Investigador mejorado
  - [x] 5.1 Agregar herramienta `web_search` al Agente Investigador (`src/lib/ai/agents/researcher.ts`)
    - Crear herramienta `web_search` que consulta fuentes web reales vía Vercel AI SDK
    - Mantener `REGULATION_DB` como fallback cuando fuentes web no están disponibles, marcando confianza como `low`
    - Agregar lógica de reintentos con backoff exponencial para consultas web
    - _Requisitos: 2.1, 2.2, 2.3_

  - [x] 5.2 Implementar lógica de resolución de conflictos y persistencia de fuentes
    - Cuando hay información contradictoria entre fuentes, priorizar la de mayor confianza
    - Asegurar que cada fuente consultada se registra en `research_sources` con todos los campos requeridos
    - _Requisitos: 2.4, 2.5_

  - [ ]* 5.3 Escribir test de propiedad para Agente Investigador — Propiedad 4
    - **Propiedad 4: Investigación produce al menos 2 fuentes**
    - **Valida: Requisitos 2.1, 2.2**

  - [ ]* 5.4 Escribir test de propiedad para Agente Investigador — Propiedad 5
    - **Propiedad 5: Persistencia completa de fuentes consultadas**
    - **Valida: Requisito 2.4**

  - [ ]* 5.5 Escribir test de propiedad para Agente Investigador — Propiedad 6
    - **Propiedad 6: Resolución de conflictos por confianza**
    - **Valida: Requisito 2.5**

- [x] 6. SyncService y generación de reglas
  - [x] 6.1 Implementar SyncService (`src/lib/sync/sync-service.ts`)
    - Implementar `runSync(options)` que itera sobre países activos de `supported_countries`
    - Registrar cada ejecución en `sync_history` (inicio, fin, estado, cambios detectados, confianza)
    - Invocar al Agente Investigador por cada país, con reintentos (3 intentos, backoff exponencial)
    - Disparar notificaciones y auditoría al detectar cambios
    - Respetar frecuencia configurada (diaria, semanal, mensual) verificando última sincronización
    - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 6.2 Implementar generación automática de borradores de reglas para año nuevo
    - Cuando no existen reglas para año N+1, copiar estructura de año N con `status='draft'`
    - Cuando el Agente detecta cambios, aplicarlos y marcar como `pending_review`
    - Cuando no hay cambios, mantener reglas existentes y notificar
    - Asegurar que todos los tests pasan tras la implementación
    - _Requisitos: 3.1, 3.2, 3.6_

  - [ ]* 6.3 Escribir test de propiedad para SyncService — Propiedad 1
    - **Propiedad 1: Sincronización cubre todos los países activos**
    - **Valida: Requisitos 1.1, 1.3, 1.5**

  - [ ]* 6.4 Escribir test de propiedad para SyncService — Propiedad 2
    - **Propiedad 2: Frecuencia de sincronización respetada**
    - **Valida: Requisito 1.2**

  - [ ]* 6.5 Escribir test de propiedad para SyncService — Propiedad 3
    - **Propiedad 3: Reintentos limitados a 3 con estado final fallido**
    - **Valida: Requisito 1.4**

  - [ ]* 6.6 Escribir test de propiedad para generación de reglas — Propiedad 7
    - **Propiedad 7: Borrador de reglas copia estructura del año anterior**
    - **Valida: Requisito 3.1**

  - [ ]* 6.7 Escribir test de propiedad para generación de reglas — Propiedad 8
    - **Propiedad 8: Cambios detectados marcan regla como pendiente de revisión**
    - **Valida: Requisito 3.2**

  - [ ]* 6.8 Escribir test de propiedad para generación de reglas — Propiedad 9
    - **Propiedad 9: Aprobación cambia estado y genera auditoría**
    - **Valida: Requisito 3.4**

  - [ ]* 6.9 Escribir test de propiedad para generación de reglas — Propiedad 10
    - **Propiedad 10: Sin cambios preserva reglas existentes y notifica**
    - **Valida: Requisito 3.6**

- [x] 7. API Routes — Sincronización, auditoría y notificaciones
  - [x] 7.1 Crear `src/app/api/sync/run/route.ts` (POST)
    - Validar header `Authorization: Bearer ${CRON_SECRET}` para autenticar cron jobs
    - Invocar `SyncService.runSync()` y retornar resultados
    - _Requisitos: 1.1, 1.3_

  - [x] 7.2 Crear `src/app/api/sync/history/route.ts` (GET)
    - Retornar historial de sincronizaciones filtrable por `country_code`
    - _Requisitos: 1.6_

  - [x] 7.3 Crear `src/app/api/audit/[ruleId]/route.ts` (GET)
    - Retornar historial de auditoría de una regla ordenado cronológicamente
    - _Requisitos: 6.4_

  - [x] 7.4 Crear `src/app/api/notifications/route.ts` (GET)
    - Retornar notificaciones del usuario autenticado, ordenadas por fecha descendente
    - _Requisitos: 5.1, 5.4_

  - [x] 7.5 Crear `src/app/api/notifications/[id]/read/route.ts` (PATCH)
    - Marcar notificación como leída usando `NotificationService.markAsRead()`
    - _Requisitos: 5.5_

- [x] 8. API Routes — Gestión de reglas, invitación de usuarios y Vercel Cron
  - [x] 8.1 Crear `src/app/api/admin/rules/[id]/approve/route.ts` (PATCH)
    - Cambiar estado de regla a `approved`, registrar en auditoría con `action='approved'`
    - _Requisitos: 3.4, 6.1_

  - [x] 8.2 Crear `src/app/api/admin/rules/[id]/reject/route.ts` (PATCH)
    - Cambiar estado de regla a `rejected`, registrar en auditoría con `action='rejected'`
    - _Requisitos: 3.5, 6.1_

  - [x] 8.3 Crear `src/app/api/admin/users/invite/route.ts` (POST)
    - Validar email único, crear usuario con `supabase.auth.admin.inviteUserByEmail()`
    - Crear perfil en `user_profiles` con `invitation_status='pending'`
    - Enviar email de invitación vía EmailService
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 8.4 Crear `src/app/api/admin/users/[id]/resend-invite/route.ts` (POST)
    - Verificar que usuario tiene `invitation_status='pending'` antes de reenviar
    - Rechazar reenvío si usuario ya está activo
    - _Requisitos: 7.4, 7.6_

  - [x] 8.5 Crear o actualizar `vercel.json` con configuración de cron
    - Agregar cron job semanal: `"path": "/api/sync/run", "schedule": "0 6 * * 1"`
    - Agregar variables `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET` al `.env.local.example`
    - _Requisitos: 1.1, 1.2_

  - [ ]* 8.6 Escribir test de propiedad para invitación de usuarios — Propiedad 18
    - **Propiedad 18: Creación de usuario genera perfil e invitación**
    - **Valida: Requisitos 7.1, 7.2**

  - [ ]* 8.7 Escribir test de propiedad para invitación de usuarios — Propiedad 19
    - **Propiedad 19: Email duplicado rechazado**
    - **Valida: Requisito 7.3**

  - [ ]* 8.8 Escribir test de propiedad para invitación de usuarios — Propiedad 20
    - **Propiedad 20: Reenvío de invitación solo para usuarios pendientes**
    - **Valida: Requisito 7.6**

  - [ ]* 8.9 Escribir test de propiedad para invitación de usuarios — Propiedad 21
    - **Propiedad 21: Rol determina permisos**
    - **Valida: Requisito 7.7**

- [x] 9. Cambios de UI — Países, usuarios y reglas
  - [x] 9.1 Modificar `src/app/[locale]/admin/countries/page.tsx`
    - Agregar columna "Última sincronización" con fecha, estado y cambios detectados (consultando `/api/sync/history`)
    - Agregar botón "Sincronizar ahora" por país que invoca `POST /api/sync/run` con `countryCode`
    - _Requisitos: 1.6_

  - [x] 9.2 Modificar `src/app/[locale]/settings/users/page.tsx`
    - Reemplazar campo "Contraseña" en formulario de creación por flujo de invitación (invocar `POST /api/admin/users/invite`)
    - Agregar columna "Estado invitación" (pendiente/activo/expirado) a la tabla de usuarios
    - Agregar botón "Reenviar invitación" para usuarios con `invitation_status='pending'`
    - _Requisitos: 7.1, 7.2, 7.4, 7.6_

  - [x] 9.3 Modificar `src/app/[locale]/rules/page.tsx`
    - Agregar badge de estado (aprobada/pendiente/borrador) a cada regla
    - Agregar botones "Aprobar" y "Rechazar" para reglas con `status='pending_review'`
    - Agregar enlace a historial de auditoría por regla (consultando `/api/audit/[ruleId]`)
    - _Requisitos: 3.3, 3.4, 3.5, 6.4_

- [x] 10. Campana de notificaciones e integración final
  - [x] 10.1 Crear componente `NotificationBell` (`src/components/ui/NotificationBell.tsx`)
    - Mostrar icono de campana con badge de conteo de notificaciones no leídas
    - Al hacer clic, mostrar dropdown con lista de notificaciones recientes
    - Permitir marcar como leída desde el dropdown
    - Consultar `/api/notifications` y `getUnreadCount`
    - _Requisitos: 5.4, 5.5_

  - [x] 10.2 Integrar `NotificationBell` en el layout principal (`src/app/[locale]/layout.tsx`)
    - Agregar el componente en la barra de navegación junto al toggle de idioma
    - Asegurar que todos los tests pasan y la UI refleja los cambios correctamente
    - _Requisitos: 5.4_

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Los tests de propiedades validan correctitud universal con fast-check.
- Los tests unitarios validan ejemplos específicos y edge cases.
- Lenguaje de implementación: TypeScript (Next.js + Supabase + Vitest + fast-check).
