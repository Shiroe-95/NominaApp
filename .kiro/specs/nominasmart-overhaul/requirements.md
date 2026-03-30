# Documento de Requisitos — NominaSmart Overhaul

## Introducción

NominaSmart es una plataforma de auditoría de nómina multi-país con IA multi-agente. Los usuarios han reportado problemas sistémicos de usabilidad, navegación confusa, y funcionalidades prometidas públicamente que no operan correctamente. Este documento define los requisitos para una revisión integral de la aplicación, abarcando UX/UI, funcionalidad de los 7 agentes de IA, el pipeline de auditoría, reportes, soporte multi-país, y todas las características transversales (i18n, notificaciones, integraciones, pricing).

## Glosario

- **NominaSmart**: La plataforma de auditoría de nómina con IA multi-agente.
- **Agente_IA**: Cada uno de los 7 agentes especializados del sistema (Dianis, Juli, Ana, Wil, Gyoru, Luni, Soul).
- **Dianis**: Agente orquestador maestro que coordina al equipo de agentes.
- **Juli**: Agente auditora que ejecuta las 14 verificaciones matemáticas y normativas.
- **Ana**: Agente redactora de reportes ejecutivos narrativos.
- **Wil**: Agente corrector que propone correcciones numéricas determinísticas.
- **Gyoru**: Agente mapeadora de campos Excel a campos estándar.
- **Luni**: Agente experta en nómina multi-país y normativa laboral.
- **Soul**: Agente investigadora regulatoria con búsqueda web.
- **Pipeline_Auditoría**: Flujo de 4 pasos: carga → mapeo → verificación → corrección.
- **Triple_Match**: Cruce de nómina interna vs PILA/Seguridad Social vs estándar regulatorio.
- **Dashboard**: Panel ejecutivo con métricas, gráficos y estado de salud del sistema.
- **Sidebar_IA**: Panel lateral de chat con el sistema multi-agente.
- **AgentBus**: Bus de comunicación inter-agente para coordinación.
- **Página_Pública**: Páginas sin autenticación (landing, about, pricing, manual, contact).
- **Página_Protegida**: Páginas que requieren autenticación y autorización RBAC.
- **RuleSet**: Conjunto de reglas normativas para un país y año específico.
- **Verificación_Matemática**: Cada una de las 14 comprobaciones numéricas del auditor.
- **Certificación**: Estado que indica que una planilla cumple todos los campos y cálculos obligatorios.
- **Action_Item**: Hallazgo o acción sugerida asociada a un empleado en una planilla.
- **SSE**: Server-Sent Events, protocolo de streaming para comunicación en tiempo real.
- **Obsidian_Ledger**: Design system oscuro con superficies tonales usado por NominaSmart.
- **SMMLV**: Salario Mínimo Mensual Legal Vigente (Colombia).
- **IBC**: Ingreso Base de Cotización.
- **PILA**: Planilla Integrada de Liquidación de Aportes (Colombia).
- **RLS**: Row Level Security de PostgreSQL.
- **RBAC**: Control de acceso basado en roles (admin, analyst, client).

## Requisitos

### Requisito 1: Navegación y Arquitectura de Información

**Historia de Usuario:** Como usuario de NominaSmart, quiero una navegación clara e intuitiva, para que pueda encontrar y usar las funcionalidades sin confusión.

#### Criterios de Aceptación

1. WHEN un usuario autenticado accede al Dashboard, THE Sidebar SHALL mostrar el flujo guiado de 3 pasos (Cargar → Auditar → Reportar) con indicadores visuales de progreso que reflejen el estado real del pipeline del usuario.
2. THE Sidebar SHALL mostrar los enlaces de navegación principal (Dashboard, Upload, Reconcile, Reports, Rules, Settings) con iconos descriptivos y etiquetas traducidas según el locale activo.
3. WHEN un usuario con rol "client" accede a NominaSmart, THE Sistema_RBAC SHALL restringir la navegación exclusivamente a Dashboard y Reports, ocultando los enlaces a rutas no autorizadas.
4. WHEN un usuario con rol "analyst" accede a NominaSmart, THE Sistema_RBAC SHALL ocultar los enlaces a rutas /admin/* de la navegación.
5. WHEN el usuario cambia de página, THE Sidebar SHALL actualizar el indicador de paso activo en el flujo guiado dentro de 100ms.
6. THE Página_Pública SHALL incluir un header sticky con navegación responsive que contenga enlaces a Inicio, Nosotros, Precios, Manual y Contacto, funcional tanto en desktop como en dispositivos móviles.
7. IF un usuario intenta acceder a una ruta protegida sin autenticación, THEN THE Middleware SHALL redirigir al usuario a la página de login preservando la URL de destino en el parámetro `redirectTo`.
8. WHEN el usuario completa el login exitosamente, THE Sistema_Auth SHALL redirigir al usuario a la URL almacenada en `redirectTo` o al Dashboard por defecto.

### Requisito 2: Dashboard Ejecutivo

**Historia de Usuario:** Como gerente de nómina, quiero un dashboard con métricas claras y accionables, para que pueda evaluar el estado de cumplimiento de mi empresa de un vistazo.

#### Criterios de Aceptación

1. THE Dashboard SHALL mostrar las métricas principales (total de planillas, planillas certificables, planillas con fallas críticas, score de riesgo promedio) en tarjetas con valores numéricos y tendencias.
2. WHEN se cargan los datos del Dashboard, THE DashboardClient SHALL renderizar gráficos de tendencia de riesgo usando Recharts con datos de las últimas 30 planillas.
3. WHILE el rol del usuario es "client", THE Dashboard SHALL filtrar todos los datos por el company_id del usuario, mostrando exclusivamente la información de su empresa.
4. THE Dashboard SHALL mostrar el estado de los proveedores de IA configurados (nombre, tipo, activo/inactivo, último test exitoso) en un panel de salud del sistema.
5. WHEN no existen planillas cargadas, THE Dashboard SHALL mostrar un estado vacío con un enlace directo a la página de carga de nómina.
6. THE Dashboard SHALL cargar los datos iniciales en paralelo (planillas, empresas, proveedores) para minimizar el tiempo de carga total.
7. IF la carga de datos del Dashboard falla, THEN THE DashboardClient SHALL renderizar la interfaz con datos vacíos sin mostrar errores no controlados al usuario.

### Requisito 3: Pipeline de Carga y Procesamiento de Nómina (Upload)

**Historia de Usuario:** Como analista de nómina, quiero un flujo guiado paso a paso para cargar y procesar archivos de nómina, para que pueda completar la auditoría sin perder contexto ni cometer errores.

#### Criterios de Aceptación

1. THE Pipeline_Auditoría SHALL implementar un flujo de 4 pasos secuenciales: (1) Carga de archivos y selección de hojas, (2) Mapeo inteligente de campos con Gyoru, (3) Verificación normativa y pre-certificación, (4) Corrección y exportación.
2. WHEN el usuario arrastra o selecciona un archivo Excel/CSV en el paso 1, THE UploadZone SHALL parsear el archivo, detectar las hojas disponibles y extraer los headers de cada hoja.
3. WHEN el usuario confirma la selección de hojas, THE Pipeline_Auditoría SHALL intentar detectar automáticamente el periodo (mes y año) escaneando las primeras 20 filas del workbook buscando nombres de meses en español y años entre 2020-2030.
4. WHEN el usuario avanza al paso 2, THE MappingAI SHALL invocar a Gyoru para mapear las columnas del archivo fuente a campos estándar del sistema usando diccionario de sinónimos y fuzzy matching con IA.
5. WHEN el mapeo se completa, THE Pipeline_Auditoría SHALL calcular la cobertura de campos obligatorios y cálculos requeridos según la regla normativa activa del país y año seleccionados.
6. THE Pipeline_Auditoría SHALL cargar las reglas normativas dinámicamente desde la API `/api/rules`; IF la API falla, THEN THE Pipeline_Auditoría SHALL usar las reglas de respaldo (FALLBACK_RULES) para Colombia y México.
7. WHEN el usuario selecciona un país diferente, THE Pipeline_Auditoría SHALL recargar las reglas normativas correspondientes y actualizar el año del periodo al más reciente disponible.
8. THE Pipeline_Auditoría SHALL permitir al usuario crear una nueva empresa directamente desde el paso 1 sin salir del flujo de carga.
9. WHEN el usuario avanza al paso 3, THE Pipeline_Auditoría SHALL evaluar la certificación verificando que todos los campos obligatorios y cálculos requeridos estén mapeados, mostrando los faltantes de forma explícita.
10. WHEN el usuario avanza al paso 4, THE Pipeline_Auditoría SHALL parsear las matrices de datos, ejecutar la validación matemática local (14 verificaciones) y solicitar validación IA al endpoint `/api/ai/validation` en paralelo.
11. THE PayrollEditor SHALL permitir al usuario corregir valores individuales en las celdas de la planilla y registrar cada corrección con índice de hoja, fila, columna, valor anterior y valor nuevo.
12. WHEN el usuario guarda la planilla, THE Pipeline_Auditoría SHALL persistir en la base de datos: resumen de riesgo por empleado, reporte de validación matemática, reporte de validación IA, resumen de conceptos, correcciones aplicadas y metadatos de hojas.
13. WHEN el usuario guarda la planilla exitosamente, THE Pipeline_Auditoría SHALL mostrar un indicador de éxito y el ID de la planilla guardada.
14. THE Pipeline_Auditoría SHALL mostrar un resumen de resultados por paso en todo momento, indicando el progreso acumulado del procesamiento.
15. THE Pipeline_Auditoría SHALL permitir al usuario ver y eliminar planillas recientes directamente desde la página de carga.

### Requisito 4: Mapeo Inteligente de Campos (Gyoru)

**Historia de Usuario:** Como analista de nómina, quiero que el sistema mapee automáticamente las columnas de mis archivos Excel a los campos estándar, para que no tenga que hacer el mapeo manual cada vez.

#### Criterios de Aceptación

1. WHEN Gyoru recibe los headers del archivo, THE MappingAI SHALL proponer un mapeo automático de columnas fuente a campos destino estándar usando un diccionario de sinónimos y análisis de IA.
2. THE MappingAI SHALL clasificar cada campo mapeado en una categoría de análisis: identity, salary_base, non_salary, ibc, contribution, contract o informational.
3. WHEN un campo obligatorio de la regla normativa no tiene correspondencia en el archivo fuente, THE MappingAI SHALL crear el campo destino y marcarlo como "creado" para que el usuario lo complete manualmente.
4. THE MappingAI SHALL permitir al usuario revisar, aceptar o modificar cada mapeo propuesto antes de confirmar.
5. IF el endpoint de mapeo IA `/api/ai/mapping` falla, THEN THE MappingAI SHALL informar al usuario del error y permitir el mapeo manual como alternativa.

### Requisito 5: Auditoría y Verificaciones Matemáticas (Juli)

**Historia de Usuario:** Como auditor de nómina, quiero que el sistema ejecute automáticamente las 14 verificaciones matemáticas y normativas sobre cada planilla, para que pueda identificar errores de cálculo y riesgos de incumplimiento.

#### Criterios de Aceptación

1. WHEN Juli ejecuta la auditoría, THE Auditor SHALL aplicar las 14 verificaciones matemáticas definidas para el país y año del contexto: (1) IBC Ley 1393, (2) Deducción Salud, (3) Deducción Pensión, (4) Cesantías, (5) Intereses Cesantías, (6) Prima de Servicios, (7) Vacaciones, (8) Parafiscales SENA, (9) Parafiscales ICBF, (10) Caja de Compensación, (11) ARL, (12) Auxilio de Transporte, (13) Tope IBC Máximo, (14) Tope IBC Mínimo.
2. THE Auditor SHALL cargar los porcentajes y valores de referencia dinámicamente desde la tabla `country_year_rules` según el país y año del contexto.
3. WHEN una verificación detecta una discrepancia, THE Auditor SHALL registrar el hallazgo con: ID de verificación, etiqueta descriptiva, filas que pasaron, filas que fallaron y muestras de hallazgos.
4. WHEN una verificación no puede ejecutarse por falta de campos mapeados, THE Auditor SHALL reportar las dependencias faltantes y sugerir posibles coincidencias (potentialMatches) entre headers del archivo y campos requeridos.
5. THE Auditor SHALL calcular un score de riesgo por empleado basado en la suma ponderada de hallazgos (high: 40 puntos, medium: 20 puntos, low: 10 puntos).
6. THE Auditor SHALL generar un reporte de validación con: total de filas analizadas, filas con hallazgos, hallazgos críticos y detalle por verificación.
7. WHEN la auditoría se completa, THE Auditor SHALL solicitar auto-correcciones proactivas a Wil vía el AgentBus.

### Requisito 6: Correcciones Determinísticas (Wil)

**Historia de Usuario:** Como analista de nómina, quiero recibir correcciones numéricas precisas con fórmulas normativas, para que pueda corregir los errores detectados con confianza.

#### Criterios de Aceptación

1. WHEN Wil recibe hallazgos de Juli, THE Corrector SHALL proponer correcciones numéricas determinísticas con fórmulas normativas explícitas para cada hallazgo corregible.
2. THE Corrector SHALL construir las fórmulas de corrección usando las reglas del país correspondiente (buildCorrectionFormulas con countryRules).
3. WHEN un hallazgo no es determinísticamente corregible, THE Corrector SHALL proporcionar guía experta (expertGuidance) con recomendaciones para resolución manual.
4. THE PayrollEditor SHALL mostrar las correcciones sugeridas por Wil junto a cada celda con hallazgo, permitiendo al usuario aceptar o rechazar cada corrección individualmente.
5. WHEN el usuario acepta una corrección, THE PayrollEditor SHALL aplicar el nuevo valor a la celda y registrar la corrección en el historial de cambios de la planilla.

### Requisito 7: Reportes Ejecutivos (Ana)

**Historia de Usuario:** Como gerente de RRHH, quiero reportes ejecutivos narrativos con hallazgos priorizados y recomendaciones accionables, para que pueda presentar resultados a la dirección sin procesamiento adicional.

#### Criterios de Aceptación

1. WHEN Ana genera un reporte ejecutivo, THE Writer SHALL agrupar los hallazgos por categoría y priorizarlos por severidad (high, medium, low).
2. THE Writer SHALL generar un reporte narrativo que incluya: resumen ejecutivo, nivel de riesgo general, análisis narrativo, hallazgos por empleado con recomendaciones y referencias normativas.
3. THE Página_Reports SHALL mostrar el detalle del reporte más reciente con: identificación de empresa, riesgo global (score/100 con nivel), cobertura de variables, riesgo por empleado y validación matemática.
4. THE Página_Reports SHALL permitir exportar el reporte completo a formato Excel con 3 hojas: Resumen general, Riesgo por Empleados y Cola de Acciones.
5. WHEN no existen planillas guardadas, THE Página_Reports SHALL mostrar un estado vacío descriptivo.
6. THE Página_Reports SHALL mostrar un log de auditoría con todas las planillas procesadas, incluyendo fecha, empresa, periodo, riesgo y estado de certificación.
7. THE Página_Reports SHALL permitir eliminar planillas individuales del historial con confirmación previa.

### Requisito 8: Conciliación y Revisión (Reconcile)

**Historia de Usuario:** Como analista de nómina, quiero un tablero de revisión detallado de la última planilla procesada, para que pueda gestionar hallazgos y asignar acciones correctivas por empleado.

#### Criterios de Aceptación

1. THE Página_Reconcile SHALL presentar un tablero de revisión en 3 pasos: (1) Revisión de cobertura de campos, (2) Validación normativa, (3) Gestión de hallazgos por empleado.
2. WHEN la página se carga, THE Página_Reconcile SHALL obtener la planilla más reciente y sus action items desde las APIs `/api/payrolls` y `/api/actions`.
3. THE Página_Reconcile SHALL mostrar un panel normativo con los campos obligatorios y cálculos requeridos de la regla correspondiente, indicando visualmente cuáles están presentes y cuáles faltan.
4. THE Página_Reconcile SHALL fusionar los hallazgos del motor matemático y del análisis IA, deduplicando por documento de empleado y ordenando por score de riesgo descendente.
5. WHEN un analista hace clic en "Asignar" para un hallazgo, THE Página_Reconcile SHALL crear un Action_Item vía POST a `/api/actions` con los datos del empleado, prioridad, área, título, descripción y corrección recomendada.
6. WHEN un analista marca un Action_Item como "Resuelto", THE Página_Reconcile SHALL actualizar el estado vía PATCH a `/api/actions/[id]` con nota de resolución.
7. THE Página_Reconcile SHALL integrar el componente LivePayrollWorkbench para análisis interactivo en tiempo real de la planilla seleccionada.
8. THE Página_Reconcile SHALL pre-llenar el campo de asignado con el email del usuario autenticado.

### Requisito 9: Chat IA Multi-Agente (Sidebar)

**Historia de Usuario:** Como usuario de NominaSmart, quiero interactuar con los agentes de IA a través de un chat lateral, para que pueda hacer consultas, ejecutar acciones y recibir asistencia contextual sin salir de mi flujo de trabajo.

#### Criterios de Aceptación

1. THE Sidebar_IA SHALL conectar con `/api/ai/orchestrate` usando SSE streaming para enviar mensajes al Agente Maestro (Dianis).
2. WHEN un agente comienza a procesar, THE Sidebar_IA SHALL mostrar un indicador de escritura con el nombre y avatar del agente activo.
3. WHEN un agente completa su procesamiento, THE Sidebar_IA SHALL renderizar el resultado incrementalmente mostrando estado (éxito/error), tokens consumidos y latencia.
4. THE Sidebar_IA SHALL persistir el historial de conversación en localStorage y restaurarlo al reabrir el panel.
5. WHEN el input está vacío o el sistema está procesando, THE Sidebar_IA SHALL deshabilitar el botón de envío.
6. THE Sidebar_IA SHALL mostrar sugerencias predefinidas en el mensaje de bienvenida para guiar al usuario.
7. THE Sidebar_IA SHALL ofrecer 4 acciones rápidas de agentes: (1) Actualizar reglas normativas (Soul/sync), (2) Auditar última nómina (Juli), (3) Consultar normativa vigente (Luni), (4) Generar reporte ejecutivo (Ana).
8. IF la conexión SSE se interrumpe inesperadamente, THEN THE Sidebar_IA SHALL intentar reconexión automática con backoff exponencial (1s, 2s, 4s) hasta un máximo de 3 intentos.
9. IF el servidor no soporta SSE, THEN THE Sidebar_IA SHALL hacer fallback a respuesta JSON estándar.
10. THE Sidebar_IA SHALL permitir limpiar el historial de conversación con un botón dedicado.

### Requisito 10: Soporte Multi-País y Reglas Normativas

**Historia de Usuario:** Como empresa multinacional, quiero que NominaSmart soporte las reglas normativas de los 7 países prometidos, para que pueda auditar nóminas de todas mis operaciones en una sola plataforma.

#### Criterios de Aceptación

1. THE Sistema_Reglas SHALL soportar reglas normativas para los 7 países: Colombia (CO), México (MX), Perú (PE), Chile (CL), Brasil (BR), Argentina (AR) y Estados Unidos (US).
2. THE Sistema_Reglas SHALL almacenar las reglas en la tabla `country_year_rules` con: código de país, año, etiqueta descriptiva, campos obligatorios, cálculos requeridos y verificaciones.
3. WHEN un usuario selecciona un país en el Pipeline_Auditoría, THE Sistema_Reglas SHALL cargar las reglas disponibles para ese país y presentar los años disponibles.
4. THE Página_Rules SHALL permitir a usuarios con rol admin o analyst visualizar, crear y gestionar reglas normativas por país y año.
5. THE Sistema_Reglas SHALL soportar estados de regla: active, pending_review, draft, para el flujo de aprobación de cambios regulatorios.
6. WHEN Soul detecta cambios regulatorios durante la sincronización, THE Sistema_Reglas SHALL crear reglas en estado pending_review que requieren aprobación de un admin.
7. THE Admin_Countries SHALL permitir a administradores gestionar los países soportados, activar/desactivar países y configurar la frecuencia de sincronización regulatoria.

### Requisito 11: Sincronización Regulatoria Automática (Soul)

**Historia de Usuario:** Como administrador del sistema, quiero que NominaSmart investigue y actualice automáticamente las reglas normativas de cada país, para que la plataforma esté siempre al día con los cambios regulatorios.

#### Criterios de Aceptación

1. THE Sync_Service SHALL ejecutar una sincronización regulatoria automática cada lunes a las 6:00 UTC vía cron de Vercel.
2. WHEN se ejecuta la sincronización, THE Sync_Service SHALL cargar los países activos desde `supported_countries` y procesar cada uno.
3. IF un país no tiene reglas en `country_year_rules`, THEN THE Sync_Service SHALL ejecutar un bootstrap donde Soul investiga y crea las reglas iniciales.
4. IF un país ya tiene reglas, THEN THE Sync_Service SHALL crear un borrador de reglas para el año N+1.
5. WHEN Soul investiga normativa, THE Researcher SHALL usar Firecrawl para búsqueda web de fuentes gubernamentales; IF Firecrawl no está disponible, THEN THE Researcher SHALL usar REGULATION_DB como fallback con confianza baja.
6. IF la investigación falla, THEN THE Sync_Service SHALL reintentar con backoff exponencial (1s → 2s → 4s) hasta un máximo de 3 intentos.
7. IF los 3 intentos fallan, THEN THE Sync_Service SHALL marcar el estado como "failed" en `sync_history`.
8. WHEN se detectan cambios regulatorios, THE Sync_Service SHALL actualizar la regla a estado pending_review, registrar en `rule_audit_log` y enviar notificación in-app y email a los usuarios suscritos.
9. THE Admin_Usage SHALL mostrar el historial de sincronizaciones con estado, país, año, tipo de trigger y conteo de reintentos.

### Requisito 12: Internacionalización (i18n)

**Historia de Usuario:** Como usuario de NominaSmart en Brasil, quiero usar la plataforma en mi idioma, para que pueda entender todas las funcionalidades sin barrera lingüística.

#### Criterios de Aceptación

1. THE NominaSmart SHALL soportar 3 idiomas: Español (es, default), Inglés (en) y Portugués (pt).
2. THE NominaSmart SHALL usar next-intl para rutas localizadas con el formato `/[locale]/ruta`.
3. WHEN el usuario cambia de idioma mediante el LanguageToggle, THE NominaSmart SHALL actualizar todas las etiquetas, mensajes y contenido de la interfaz al idioma seleccionado sin recargar la página completa.
4. THE NominaSmart SHALL mantener diccionarios de traducción completos en `messages/es.json`, `messages/en.json` y `messages/pt.json` para todas las páginas y componentes.
5. IF una clave de traducción no existe en el idioma seleccionado, THEN THE NominaSmart SHALL mostrar la clave en español como fallback.
6. THE Página_Pública SHALL renderizar todo el contenido (landing, about, pricing, manual, contact) en el idioma del locale activo.

### Requisito 13: Proveedores de IA y Fallback

**Historia de Usuario:** Como administrador, quiero configurar múltiples proveedores de IA con fallback automático, para que el sistema siga funcionando si un proveedor falla.

#### Criterios de Aceptación

1. THE NominaSmart SHALL soportar 5 proveedores de IA: OpenAI, Anthropic, Groq, Google y OpenRouter.
2. THE Settings_Providers SHALL permitir al usuario configurar, activar/desactivar, reordenar prioridad y probar cada proveedor de IA.
3. WHEN un proveedor de IA falla durante una operación, THE Fallback_Chain SHALL intentar automáticamente con el siguiente proveedor en orden de prioridad.
4. THE NominaSmart SHALL encriptar las API keys de los proveedores usando AES-256-GCM antes de almacenarlas en la base de datos.
5. THE Settings_Providers SHALL permitir probar la conectividad de un proveedor individual vía el endpoint `/api/settings/providers/[id]/test`.
6. THE Model_Selector SHALL seleccionar el modelo óptimo según la complejidad de la tarea (score 0.0-1.0) usando un score compuesto de costo × peso_costo + calidad × peso_calidad.
7. THE Admin_Optimization SHALL permitir configurar la estrategia de selección de modelos (cost-first, quality-first, balanced) y los pesos correspondientes.

### Requisito 14: Notificaciones y Alertas

**Historia de Usuario:** Como usuario de NominaSmart, quiero recibir notificaciones sobre cambios regulatorios y eventos importantes, para que pueda tomar acción oportuna.

#### Criterios de Aceptación

1. THE Notification_Service SHALL soportar notificaciones in-app con 3 niveles de severidad: info, warning y critical.
2. THE Notification_Service SHALL soportar tipos de notificación: cambio regulatorio, sincronización completada y regla pendiente de revisión.
3. THE NotificationBell SHALL mostrar el conteo de notificaciones no leídas en el header de la aplicación.
4. WHEN el usuario hace clic en una notificación, THE Notification_Service SHALL marcarla como leída vía PATCH a `/api/notifications/[id]/read`.
5. WHEN ocurre un evento crítico (cambio regulatorio detectado), THE Notification_Service SHALL enviar broadcast a todos los usuarios con rol admin.
6. THE Email_Service SHALL enviar alertas por email usando Resend para: invitaciones, alertas regulatorias y resúmenes semanales, con plantillas localizadas según el idioma del usuario.
7. IF el envío de email falla, THEN THE Email_Service SHALL reintentar con backoff exponencial.

### Requisito 15: Planes de Precios y Límites por Tier

**Historia de Usuario:** Como potencial cliente, quiero entender claramente los planes disponibles y sus límites, para que pueda elegir el plan adecuado para mi empresa.

#### Criterios de Aceptación

1. THE Página_Pricing SHALL mostrar 3 planes de suscripción: Básico ($99/mes), Profesional ($299/mes) y Empresarial (personalizado).
2. THE Página_Pricing SHALL mostrar una tabla comparativa detallada con disponibilidad de agentes IA, límites de empleados, cargas mensuales, países, soporte y funcionalidades por plan.
3. THE Plan_Básico SHALL incluir: hasta 50 empleados, 5 cargas/mes, 2 agentes (Juli + Gyoru), reportes básicos, 1 proveedor IA, 1 país y soporte por email.
4. THE Plan_Profesional SHALL incluir: hasta 500 empleados, cargas ilimitadas, los 7 agentes IA, reportes ejecutivos completos, 3 proveedores IA, 3 países y chat prioritario.
5. THE Plan_Empresarial SHALL incluir: empleados ilimitados, cargas ilimitadas, todos los agentes incluyendo Soul, reportes personalizados, proveedores ilimitados, todos los países, soporte dedicado 24/7 y acceso API.
6. THE Admin_Pricing SHALL permitir a administradores gestionar los planes y precios desde el panel de administración.
7. THE NominaSmart SHALL aplicar los límites del plan del usuario (empleados, cargas, agentes, países) en las operaciones correspondientes.

### Requisito 16: Seguridad y Control de Acceso

**Historia de Usuario:** Como administrador de seguridad, quiero que NominaSmart implemente controles de seguridad robustos, para que los datos de nómina estén protegidos adecuadamente.

#### Criterios de Aceptación

1. THE API_Guard SHALL validar la autenticación en todas las rutas protegidas usando `requireAuth()` antes de procesar cualquier solicitud.
2. THE Rate_Limiter SHALL aplicar límites por endpoint: auth (10/min), AI (20/min), chat (30/min), admin writes (30/min), reads (60/min), writes (40/min), cron (5/min).
3. IF un cliente excede el rate limit, THEN THE Rate_Limiter SHALL responder con HTTP 429 y un header Retry-After indicando cuándo puede reintentar.
4. THE NominaSmart SHALL implementar Row Level Security (RLS) en PostgreSQL para aislar datos entre empresas.
5. THE Audit_Service SHALL registrar todos los cambios en reglas normativas con retención de 5 años, incluyendo trazabilidad de origen (manual/automático) y fuentes.
6. THE NominaSmart SHALL sanitizar todos los inputs de API validando UUIDs y aplicando esquemas Zod antes de procesar la lógica de negocio.
7. THE Middleware SHALL implementar RBAC verificando el rol del usuario contra los permisos requeridos de cada ruta antes de permitir el acceso.

### Requisito 17: Integraciones Externas

**Historia de Usuario:** Como empresa que usa Siigo como ERP, quiero que NominaSmart se integre con mi sistema contable, para que pueda importar datos de nómina directamente sin exportar archivos manualmente.

#### Criterios de Aceptación

1. THE Integration_Framework SHALL implementar una interfaz extensible `IntegrationConnector` para agregar nuevos conectores de ERP.
2. THE NominaSmart SHALL incluir conectores para Siigo y Generic API como integraciones iniciales.
3. THE Settings_Integrations SHALL permitir al usuario configurar y probar conexiones con sistemas externos vía `/api/integrations/test`.
4. IF una integración falla durante la importación, THEN THE Integration_Framework SHALL registrar el error y notificar al usuario sin interrumpir el flujo principal.

### Requisito 18: Panel Financiero de IA

**Historia de Usuario:** Como administrador financiero, quiero un panel con KPIs de uso y costos de IA, para que pueda controlar el gasto y optimizar la selección de proveedores.

#### Criterios de Aceptación

1. THE Admin_Finance SHALL mostrar KPIs financieros de uso de IA: costo total, tokens consumidos, latencia promedio y desglose por proveedor.
2. THE Admin_Finance SHALL mostrar gráficos de tendencia de costos y uso a lo largo del tiempo.
3. THE Admin_Finance SHALL permitir exportar los datos financieros a formato CSV.
4. THE Admin_Finance SHALL mostrar el desglose de costos por cliente/empresa cuando el rol es admin.
5. THE Usage_Logger SHALL registrar cada operación de IA con: proveedor usado, modelo, tokens de entrada, tokens de salida, latencia y costo estimado.

### Requisito 19: Gestión de Usuarios

**Historia de Usuario:** Como administrador, quiero gestionar los usuarios de mi organización con roles diferenciados, para que cada persona tenga acceso solo a las funcionalidades que necesita.

#### Criterios de Aceptación

1. THE Settings_Users SHALL permitir a administradores invitar nuevos usuarios por email con un rol asignado (admin, analyst, client).
2. THE Settings_Users SHALL mostrar la lista de usuarios con su rol, email, estado y empresa asociada.
3. WHEN un administrador invita a un usuario, THE Email_Service SHALL enviar un email de invitación con enlace de activación.
4. THE Settings_Users SHALL permitir reenviar invitaciones pendientes vía `/api/admin/users/[id]/resend-invite`.
5. THE Settings_Users SHALL permitir a administradores cambiar el rol o desactivar usuarios existentes.

### Requisito 20: Páginas Públicas y Contenido de Marketing

**Historia de Usuario:** Como visitante del sitio, quiero que las páginas públicas reflejen fielmente las capacidades reales de NominaSmart, para que pueda tomar una decisión informada antes de registrarme.

#### Criterios de Aceptación

1. THE Página_Landing SHALL mostrar las capacidades reales del sistema: 7 agentes IA con sus nombres, roles y descripciones, soporte multi-país, 14 verificaciones matemáticas y reportes ejecutivos.
2. THE Página_Landing SHALL incluir un preview del dashboard con métricas representativas y un flujo visual del proceso de auditoría en 4 pasos con avatares de agentes.
3. THE Página_About SHALL describir la misión, el equipo de agentes IA y la propuesta de valor de NominaSmart.
4. THE Página_Manual SHALL proporcionar documentación de usuario completa con navegación lateral, cubriendo todos los flujos principales de la aplicación.
5. THE Página_Contact SHALL incluir un formulario de contacto funcional para solicitar demos y soporte.
6. THE Página_Landing SHALL incluir testimonios de clientes y un CTA claro hacia registro y demo.
7. WHEN un visitante hace clic en "Comenzar gratis" o "Iniciar sesión", THE Página_Pública SHALL redirigir a la página de login.
8. THE Footer SHALL incluir enlaces a todas las secciones del sitio, redes sociales y enlaces legales (Privacidad, Términos, Seguridad).
9. THE Página_Pública SHALL ser completamente responsive, funcionando correctamente en dispositivos móviles con menú hamburguesa.

### Requisito 21: Orquestación Multi-Agente (Dianis)

**Historia de Usuario:** Como usuario de NominaSmart, quiero que Dianis coordine automáticamente al equipo de agentes según mi solicitud, para que obtenga resultados completos sin tener que invocar cada agente manualmente.

#### Criterios de Aceptación

1. WHEN Dianis recibe una solicitud, THE Orchestrator SHALL clasificar la intención del usuario (determinística o IA) y construir un plan de ejecución.
2. THE Orchestrator SHALL ejecutar el plan en fases secuenciales: (1) Auditoría con Juli, (2) Correcciones con Wil, (3) Reporte con Ana, coordinando la comunicación inter-agente vía AgentBus.
3. WHEN un agente completa su fase, THE Orchestrator SHALL pasar los resultados al siguiente agente en el plan.
4. THE Orchestrator SHALL consolidar los resultados de todos los agentes en una respuesta unificada (OrchestrateResponse).
5. THE Orchestrator SHALL registrar el uso de IA (tokens, latencia, costo) y guardar los resultados en la base de datos.
6. IF un agente falla durante la ejecución, THEN THE Orchestrator SHALL registrar el error y continuar con los agentes restantes del plan.
7. THE Orchestrator SHALL soportar adaptación dinámica del plan si la complejidad de los datos lo requiere.

### Requisito 22: Exportación y Descarga de Datos

**Historia de Usuario:** Como analista de nómina, quiero exportar los resultados de auditoría y correcciones en formato Excel, para que pueda compartirlos con mi equipo y archivarlos.

#### Criterios de Aceptación

1. THE Pipeline_Auditoría SHALL permitir descargar la planilla corregida en formato Excel desde el paso 4.
2. THE Página_Reports SHALL permitir exportar el reporte completo a Excel con múltiples hojas (Resumen, Riesgo Empleados, Cola de Acciones).
3. THE Admin_Finance SHALL permitir exportar datos financieros de uso de IA a formato CSV.
4. WHEN el usuario solicita una exportación, THE NominaSmart SHALL generar el archivo en el navegador usando la librería XLSX sin requerir procesamiento del servidor.

### Requisito 23: Manejo de Errores y Estados Vacíos

**Historia de Usuario:** Como usuario de NominaSmart, quiero que la aplicación maneje los errores de forma clara y me guíe hacia la solución, para que no me quede bloqueado sin saber qué hacer.

#### Criterios de Aceptación

1. WHEN una página protegida falla al cargar, THE Error_Boundary SHALL mostrar una página de error con mensaje descriptivo y opción de reintentar.
2. WHEN una API retorna un error, THE NominaSmart SHALL mostrar un mensaje de error contextual al usuario sin exponer detalles técnicos internos.
3. WHILE una operación asíncrona está en progreso, THE NominaSmart SHALL mostrar un indicador de carga (spinner o skeleton) en el componente afectado.
4. WHEN una página no tiene datos para mostrar, THE NominaSmart SHALL renderizar un componente EmptyState con icono, mensaje descriptivo y acción sugerida.
5. THE NominaSmart SHALL implementar páginas de error (error.tsx), carga (loading.tsx) y no encontrado (not-found.tsx) para cada sección principal de la aplicación.
6. IF una operación de guardado falla, THEN THE NominaSmart SHALL preservar los datos del formulario para que el usuario pueda reintentar sin perder su trabajo.

### Requisito 24: Rendimiento y Optimización

**Historia de Usuario:** Como usuario de NominaSmart, quiero que la aplicación responda rápidamente, para que pueda completar mis tareas de auditoría sin esperas innecesarias.

#### Criterios de Aceptación

1. THE Dashboard SHALL cargar los datos iniciales (planillas, empresas, proveedores) en paralelo usando Promise.all para minimizar el tiempo total de carga.
2. THE Pipeline_Auditoría SHALL procesar archivos Excel en el navegador usando Web Workers cuando el archivo exceda 1000 filas.
3. THE NominaSmart SHALL implementar carga diferida (lazy loading) para componentes pesados como Recharts y el editor de planillas.
4. THE Sidebar_IA SHALL usar SSE streaming para renderizar respuestas incrementalmente en lugar de esperar la respuesta completa.
5. THE NominaSmart SHALL limitar las consultas de planillas recientes a las últimas 30 entradas para evitar cargas excesivas de datos.
