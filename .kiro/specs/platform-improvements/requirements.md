# Documento de Requisitos — NominaSmart Platform Improvements

## Introducción

NominaSmart es una plataforma de auditoría de nómina multi-país con IA multi-agente construida con Next.js 16, React 19, Supabase, Tailwind CSS 4 y un sistema de 7 agentes de IA. La plataforma ya cuenta con un pipeline funcional, RBAC, SSE streaming, i18n, y múltiples módulos avanzados (detección de anomalías, NLQ, forecasting, webhooks, workspaces, SSO, SDK, OpenAPI) que están implementados como servicios independientes pero no integrados en el flujo principal de la aplicación.

Este documento define los requisitos para una mejora integral de la plataforma en 7 ejes: rendimiento y escalabilidad, testing y calidad de código, experiencia de usuario y accesibilidad, integración de funcionalidades avanzadas ya construidas, capacidades enterprise, experiencia de desarrollador, y monitoreo y observabilidad.

El objetivo es cerrar la brecha entre los módulos existentes y la experiencia del usuario final, garantizando rendimiento, calidad, y una plataforma cohesiva de clase mundial.

## Glosario

- **NominaSmart**: Plataforma de auditoría de nómina multi-país con IA multi-agente.
- **Virtual_Scrolling**: Técnica de renderizado que solo instancia los elementos visibles en el viewport, reciclando nodos DOM al hacer scroll.
- **Cache_Layer**: Capa de caché en memoria y/o Redis para almacenar datos de acceso frecuente y reducir consultas a la base de datos.
- **Web_Worker**: Hilo de ejecución en segundo plano del navegador que permite ejecutar cómputos pesados sin bloquear el hilo principal de UI.
- **PBT**: Property-Based Testing, técnica de pruebas que genera inputs aleatorios para verificar propiedades invariantes del código.
- **fast-check**: Biblioteca de PBT para JavaScript/TypeScript ya instalada en el proyecto.
- **Playwright**: Framework de testing end-to-end que automatiza navegadores reales para verificar flujos completos de usuario.
- **Theme_Engine**: Motor de temas que permite alternar entre modo claro, oscuro y automático usando CSS custom properties.
- **Dashboard_Personalizable**: Dashboard cuyo layout de widgets es configurable por el usuario mediante drag-and-drop.
- **Collaboration_Engine**: Motor de colaboración en tiempo real basado en Supabase Realtime (WebSocket).
- **Annotation_System**: Sistema de comentarios y notas contextuales asociados a celdas, hallazgos o secciones de reportes.
- **Anomaly_Detector**: Módulo existente en `src/lib/ai/agents/` que detecta patrones atípicos en datos de nómina.
- **NLQ_Engine**: Motor de consultas en lenguaje natural existente en `src/app/api/v1/nlq/` que traduce preguntas del usuario a consultas sobre datos de nómina.
- **Forecast_Service**: Servicio de análisis predictivo existente en `src/app/api/v1/forecast/` que genera proyecciones de costos de nómina.
- **SSO_Service**: Servicio de autenticación enterprise existente en `src/lib/auth/sso-service.ts` para SAML 2.0 y OIDC.
- **Workspace_Service**: Servicio de workspaces multi-equipo existente en `src/lib/workspaces/workspace-service.ts`.
- **Webhook_Service**: Servicio de webhooks existente en `src/lib/webhooks/webhook-service.ts` para notificaciones HTTP a sistemas externos.
- **Bulk_API**: Endpoints de operaciones masivas existentes en `src/app/api/v1/bulk/`.
- **OpenAPI_Spec**: Especificación OpenAPI 3.1 existente en `src/app/api/v1/docs/openapi.json/`.
- **SDK_Client**: Cliente SDK existente en `src/lib/sdk/nominasmart-client.ts` para integración programática.
- **Health_Monitor**: Monitor de salud existente en `src/lib/monitoring/health-monitor.ts`.
- **Metrics_Collector**: Colector de métricas existente en `src/lib/monitoring/metrics-collector.ts`.
- **Sentry**: Plataforma de monitoreo de errores y rendimiento en producción.
- **Distributed_Tracing**: Técnica de observabilidad que rastrea una solicitud a través de múltiples servicios usando un trace ID único.
- **Storybook**: Herramienta de desarrollo y documentación de componentes UI aislados.
- **Pipeline_Auditoría**: Flujo de 4 pasos de NominaSmart: carga → mapeo → verificación → corrección.
- **Sidebar_IA**: Panel lateral de chat con el sistema multi-agente de IA.
- **Obsidian_Ledger**: Design system oscuro con superficies tonales usado por NominaSmart.
- **PayrollTable**: Componente de tabla que muestra datos de nómina de empleados.
- **country_year_rules**: Tabla de Supabase que almacena reglas normativas por país y año.
- **API_Guard**: Módulo de autenticación y autorización en `src/lib/api/guard.ts`.
- **Rate_Limiter**: Módulo de limitación de tasa en `src/lib/api/rate-limit.ts`.

## Requisitos

### Requisito 1: Virtual Scrolling para Tablas de Nómina

**Historia de Usuario:** Como analista de nómina que gestiona empresas con más de 100 empleados, quiero que las tablas de nómina se rendericen de forma fluida sin degradación de rendimiento, para que pueda revisar y editar datos sin esperas ni bloqueos de la interfaz.

#### Criterios de Aceptación

1. WHEN la PayrollTable contiene más de 50 filas, THE Virtual_Scrolling SHALL renderizar exclusivamente las filas visibles en el viewport más un buffer de 5 filas arriba y 5 filas abajo.
2. THE Virtual_Scrolling SHALL mantener un frame rate mínimo de 30 FPS durante el scroll continuo en tablas de hasta 10,000 filas.
3. THE Virtual_Scrolling SHALL preservar el estado de selección, edición y correcciones aplicadas en las filas que salen y vuelven a entrar al viewport.
4. WHEN el usuario busca o filtra en la PayrollTable, THE Virtual_Scrolling SHALL recalcular el conjunto de filas visibles y hacer scroll al primer resultado coincidente.
5. THE Virtual_Scrolling SHALL soportar filas de altura variable para acomodar celdas con contenido expandido (anotaciones, correcciones sugeridas).
6. THE Virtual_Scrolling SHALL mantener las columnas de identificación del empleado (documento, nombre) fijas durante el scroll horizontal.
7. IF el navegador no soporta IntersectionObserver, THEN THE Virtual_Scrolling SHALL hacer fallback a paginación tradicional con 50 filas por página.

### Requisito 2: Caché de Reglas Normativas

**Historia de Usuario:** Como usuario que navega frecuentemente entre países y periodos, quiero que las reglas normativas se carguen instantáneamente después de la primera consulta, para que no tenga que esperar la respuesta del servidor cada vez que cambio de contexto.

#### Criterios de Aceptación

1. THE Cache_Layer SHALL almacenar en caché las reglas normativas consultadas desde `country_year_rules` con una clave compuesta de país + año.
2. THE Cache_Layer SHALL implementar una estrategia de invalidación basada en TTL de 1 hora para reglas en estado "active" y 5 minutos para reglas en estado "pending_review" o "draft".
3. WHEN una regla normativa es actualizada (por sincronización regulatoria o edición manual), THE Cache_Layer SHALL invalidar la entrada correspondiente de la caché de forma inmediata.
4. THE Cache_Layer SHALL soportar dos niveles de caché: nivel 1 en memoria del proceso (Map) para acceso sub-milisegundo, y nivel 2 en Redis (Upstash) para caché distribuida entre instancias.
5. IF Redis no está disponible, THEN THE Cache_Layer SHALL operar exclusivamente con caché en memoria sin degradar la funcionalidad.
6. THE Cache_Layer SHALL registrar métricas de hit rate, miss rate y latencia promedio por nivel de caché para monitoreo.
7. THE Cache_Layer SHALL limitar el tamaño de la caché en memoria a un máximo de 200 entradas, aplicando evicción LRU cuando se alcance el límite.

### Requisito 3: Web Workers para Cómputos Pesados

**Historia de Usuario:** Como analista que ejecuta auditorías sobre planillas grandes, quiero que los cálculos pesados (detección de anomalías, forecasting, parsing de Excel) se ejecuten en segundo plano, para que la interfaz permanezca responsiva durante el procesamiento.

#### Criterios de Aceptación

1. THE NominaSmart SHALL ejecutar el parsing de archivos Excel/CSV en un Web_Worker dedicado (`excel-parser.worker.ts`) para evitar bloquear el hilo principal de UI.
2. THE NominaSmart SHALL ejecutar los cálculos de detección de anomalías en un Web_Worker cuando el volumen de datos supere 50 empleados.
3. THE NominaSmart SHALL ejecutar los cálculos de forecasting en un Web_Worker cuando el análisis involucre más de 3 periodos históricos.
4. WHEN un Web_Worker está procesando, THE NominaSmart SHALL mostrar un indicador de progreso con porcentaje estimado y opción de cancelar la operación.
5. IF el navegador no soporta Web Workers, THEN THE NominaSmart SHALL ejecutar los cálculos en el hilo principal con un aviso de que la interfaz puede experimentar lentitud temporal.
6. THE Web_Worker SHALL comunicar resultados parciales al hilo principal cada 500ms para actualizar el indicador de progreso.
7. WHEN el usuario cancela una operación en curso, THE Web_Worker SHALL terminar la ejecución y liberar los recursos dentro de 1 segundo.

### Requisito 4: Property-Based Testing con fast-check

**Historia de Usuario:** Como desarrollador de NominaSmart, quiero pruebas basadas en propiedades que verifiquen invariantes del sistema con inputs generados automáticamente, para que pueda detectar errores de borde que las pruebas unitarias tradicionales no cubren.

#### Criterios de Aceptación

1. THE NominaSmart SHALL incluir pruebas PBT con fast-check para los módulos críticos: rule-engine (motor de reglas normativas), plan-serializer (serialización/deserialización de planes), encryption (cifrado/descifrado de API keys), model-selector (selección de modelos IA) y format-detector (detección de formato de archivos).
2. THE PBT para rule-engine SHALL verificar que para toda regla normativa válida generada, las 14 verificaciones matemáticas producen resultados determinísticos y consistentes (misma entrada produce misma salida).
3. THE PBT para plan-serializer SHALL verificar la propiedad de round-trip: para todo plan válido generado, serializar y luego deserializar produce un objeto equivalente al original.
4. THE PBT para encryption SHALL verificar la propiedad de round-trip: para toda cadena de texto generada y toda clave válida, descifrar el resultado de cifrar produce la cadena original.
5. THE PBT para model-selector SHALL verificar que para toda configuración válida de proveedores y pesos, el selector retorna un modelo cuyo score compuesto es mayor o igual al de cualquier otro candidato.
6. THE PBT para format-detector SHALL verificar que para todo archivo generado con formato conocido (CSV, XLSX), el detector identifica correctamente el formato.
7. THE PBT SHALL ejecutarse como parte del comando `npm run test` existente usando Vitest como runner.
8. THE PBT SHALL generar un mínimo de 100 casos de prueba por propiedad en cada ejecución.

### Requisito 5: Tests End-to-End con Playwright

**Historia de Usuario:** Como equipo de desarrollo, queremos tests automatizados que verifiquen los flujos completos de usuario en un navegador real, para que podamos detectar regresiones en la experiencia de usuario antes de cada despliegue.

#### Criterios de Aceptación

1. THE NominaSmart SHALL incluir tests E2E con Playwright que cubran los flujos críticos: login y autenticación, pipeline de carga de nómina (4 pasos), visualización de reportes, chat con agentes IA, y gestión de reglas normativas.
2. THE E2E para login SHALL verificar: login exitoso con credenciales válidas redirige al dashboard, login con credenciales inválidas muestra mensaje de error, y acceso a ruta protegida sin sesión redirige a login con parámetro redirectTo.
3. THE E2E para pipeline de carga SHALL verificar: carga de archivo Excel, mapeo automático de campos, ejecución de verificaciones y guardado de planilla con resultados.
4. THE E2E para reportes SHALL verificar: visualización del reporte más reciente con métricas, exportación a Excel y navegación del historial de planillas.
5. THE E2E para chat IA SHALL verificar: envío de mensaje al chat, recepción de respuesta con streaming, y ejecución de acciones rápidas de agentes.
6. THE E2E SHALL ejecutarse en los navegadores Chromium y Firefox como mínimo.
7. THE E2E SHALL usar fixtures de datos de prueba aislados para evitar dependencias entre tests.
8. THE NominaSmart SHALL incluir un script `npm run test:e2e` para ejecutar los tests E2E de Playwright.

### Requisito 6: Manejo de Errores Consistente en API

**Historia de Usuario:** Como desarrollador que consume la API de NominaSmart, quiero que todos los endpoints retornen errores en un formato predecible y consistente, para que pueda implementar manejo de errores robusto en mis integraciones.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar un formato de error estándar en todas las respuestas de API con estructura: `{ error: string, code: string, details?: object, requestId: string }`.
2. THE NominaSmart SHALL incluir un header `X-Request-Id` con un UUID v4 único en todas las respuestas de API (exitosas y de error) para trazabilidad.
3. THE API_Guard SHALL capturar todas las excepciones no controladas en los handlers de API y retornar una respuesta con código HTTP 500 y el formato de error estándar, sin exponer stack traces ni detalles internos al cliente.
4. WHEN un endpoint recibe un body con formato inválido según el esquema Zod, THE API_Guard SHALL retornar HTTP 400 con código "VALIDATION_ERROR" y los detalles de los campos inválidos en el campo `details`.
5. WHEN un endpoint recibe un request sin autenticación válida, THE API_Guard SHALL retornar HTTP 401 con código "UNAUTHORIZED" y mensaje descriptivo.
6. WHEN un endpoint recibe un request de un usuario sin permisos suficientes, THE API_Guard SHALL retornar HTTP 403 con código "FORBIDDEN" y el rol requerido en `details`.
7. WHEN el Rate_Limiter rechaza un request, THE API_Guard SHALL retornar HTTP 429 con código "RATE_LIMITED", header `Retry-After` y el límite aplicado en `details`.
8. THE NominaSmart SHALL implementar una función utilitaria `createApiError(code, message, details?)` que todos los endpoints usen para generar respuestas de error consistentes.

### Requisito 7: Motor de Temas (Claro/Oscuro)

**Historia de Usuario:** Como usuario que trabaja largas jornadas frente a la pantalla, quiero alternar entre modo claro y oscuro, para que pueda reducir la fatiga visual según las condiciones de iluminación de mi entorno.

#### Criterios de Aceptación

1. THE Theme_Engine SHALL soportar 3 modos de tema: claro, oscuro (Obsidian_Ledger actual) y automático (sigue la preferencia `prefers-color-scheme` del sistema operativo).
2. WHEN el usuario cambia de tema mediante el toggle en el header, THE Theme_Engine SHALL aplicar la transición a todos los componentes de la interfaz en menos de 100ms sin recargar la página, usando CSS custom properties.
3. THE Theme_Engine SHALL persistir la preferencia de tema del usuario en localStorage con la clave `nominasmart-theme` y aplicarla al cargar la aplicación antes del primer render para evitar flash de tema incorrecto (FOUC).
4. THE Theme_Engine SHALL definir tokens de diseño semánticos para ambos temas: background, foreground, primary, secondary, muted, accent, destructive, border, ring, card, popover y sidebar, cada uno con variantes de foreground.
5. THE Theme_Engine SHALL generar el tema claro como inversión semántica del Obsidian_Ledger existente, manteniendo la jerarquía de superficies tonales (6 niveles) y la paleta de colores de acento.
6. THE NominaSmart SHALL renderizar un toggle de tema en el header de la aplicación con iconos de sol (claro), luna (oscuro) y monitor (automático).
7. WHEN el modo es automático y el sistema operativo cambia de tema, THE Theme_Engine SHALL detectar el cambio vía `matchMedia('prefers-color-scheme: dark')` y actualizar el tema de la aplicación en tiempo real.

### Requisito 8: Dashboards Personalizables

**Historia de Usuario:** Como gerente de nómina, quiero personalizar mi dashboard con los widgets y métricas que más me importan, para que pueda tener una vista ejecutiva adaptada a mis necesidades sin depender de un layout fijo.

#### Criterios de Aceptación

1. THE Dashboard SHALL permitir al usuario agregar, remover y reordenar widgets mediante drag-and-drop en una grilla responsiva.
2. THE Dashboard SHALL ofrecer un catálogo de widgets disponibles: métricas de planillas, gráfico de tendencia de riesgo, anomalías detectadas, forecast de costos, actividad reciente, estado de proveedores IA, resumen de action items pendientes y estado de salud del sistema.
3. WHEN el usuario personaliza su dashboard, THE Dashboard SHALL persistir la configuración de layout (posición, tamaño y widgets seleccionados) en la tabla `user_profiles` asociada al perfil del usuario.
4. THE Dashboard SHALL ofrecer 3 layouts predefinidos por rol: ejecutivo (métricas + forecast + anomalías), analista (planillas + riesgo + acciones) y administrador (proveedores + uso IA + salud del sistema).
5. THE Dashboard SHALL permitir al usuario restaurar el layout predeterminado de su rol con un botón dedicado.
6. WHEN un widget falla al cargar datos, THE Dashboard SHALL mostrar un estado de error dentro del widget con opción de reintentar, sin afectar a los demás widgets.
7. THE Dashboard SHALL adaptar la grilla de widgets a los breakpoints responsive: 1 columna en mobile, 2 columnas en tablet y 3-4 columnas en desktop.

### Requisito 9: Colaboración en Tiempo Real

**Historia de Usuario:** Como equipo de auditoría de nómina, queremos trabajar simultáneamente sobre la misma planilla y ver los cambios de nuestros compañeros en tiempo real, para que podamos completar auditorías complejas de forma colaborativa.

#### Criterios de Aceptación

1. WHEN múltiples usuarios abren la misma planilla en el PayrollEditor, THE Collaboration_Engine SHALL mostrar indicadores de presencia (avatar, nombre y cursor de color único) de cada usuario conectado.
2. WHEN un usuario aplica una corrección a una celda, THE Collaboration_Engine SHALL propagar el cambio a todos los usuarios conectados a la misma planilla en menos de 500ms usando Supabase Realtime (WebSocket).
3. THE Collaboration_Engine SHALL implementar resolución de conflictos optimista: si dos usuarios editan la misma celda simultáneamente, el último cambio prevalece y el usuario cuyo cambio fue sobrescrito recibe una notificación con la opción de revertir.
4. WHEN un usuario se desconecta inesperadamente, THE Collaboration_Engine SHALL preservar los cambios no guardados del usuario y sincronizarlos al reconectarse dentro de un periodo de 5 minutos.
5. THE PayrollEditor SHALL mostrar un indicador de "usuarios editando" con el conteo y avatares de los colaboradores activos en la barra superior de la planilla.
6. THE Collaboration_Engine SHALL limitar a un máximo de 10 usuarios simultáneos por planilla para mantener el rendimiento de sincronización.

### Requisito 10: Anotaciones y Comentarios sobre Hallazgos

**Historia de Usuario:** Como analista de nómina, quiero dejar comentarios y notas sobre hallazgos específicos de auditoría, para que mi equipo pueda discutir y resolver problemas de forma contextual sin recurrir a herramientas externas.

#### Criterios de Aceptación

1. THE Annotation_System SHALL permitir a los usuarios crear comentarios asociados a: celdas específicas del PayrollEditor, hallazgos de auditoría en la Página_Reconcile, action items y secciones de reportes.
2. WHEN un usuario crea una anotación, THE Annotation_System SHALL registrar vía POST a `/api/v1/annotations`: autor, timestamp, texto del comentario, tipo de entidad asociada (celda, hallazgo, action_item, reporte), ID de la entidad y menciones a otros usuarios.
3. WHEN un usuario es mencionado en una anotación (@usuario), THE Notification_Service SHALL enviar una notificación in-app al usuario mencionado dentro de 5 segundos.
4. THE Annotation_System SHALL soportar hilos de respuesta (parent_id) para permitir discusiones contextuales sobre un mismo elemento.
5. THE Annotation_System SHALL permitir resolver anotaciones marcándolas como completadas vía PATCH a `/api/v1/annotations/[id]` sin eliminarlas del historial.
6. THE PayrollEditor y la Página_Reconcile SHALL mostrar un indicador visual (badge con conteo) en las celdas, hallazgos o secciones que tienen anotaciones activas no resueltas.

### Requisito 11: Integración de Detección de Anomalías en el Pipeline Principal

**Historia de Usuario:** Como auditor de nómina, quiero que la detección de anomalías se ejecute automáticamente como parte del pipeline de auditoría, para que pueda identificar fraudes potenciales y errores sistemáticos sin tener que invocar el análisis manualmente.

#### Criterios de Aceptación

1. WHEN Juli completa la auditoría estándar (paso 3 del Pipeline_Auditoría), THE Pipeline_Auditoría SHALL invocar automáticamente al Anomaly_Detector para analizar los datos de la planilla procesada.
2. THE Anomaly_Detector SHALL ejecutar el análisis en un Web_Worker cuando el volumen de datos supere 50 empleados, comunicando progreso al hilo principal.
3. WHEN el Anomaly_Detector identifica anomalías, THE Pipeline_Auditoría SHALL incluir los resultados en el reporte de validación junto a los hallazgos de las 14 verificaciones matemáticas.
4. THE Dashboard SHALL mostrar un widget de anomalías detectadas con clasificación por nivel de confianza (alto, medio, bajo) y categoría (fraude potencial, error sistemático, variación estacional, cambio legítimo).
5. THE Anomaly_Detector SHALL comparar los datos del periodo actual contra los 6 periodos anteriores de la misma empresa cuando existan datos históricos disponibles.
6. IF no existen periodos anteriores para comparación, THEN THE Anomaly_Detector SHALL usar benchmarks de la industria por país y tamaño de empresa como referencia, consultando el endpoint `/api/v1/benchmarks`.
7. THE Anomaly_Detector SHALL generar explicaciones en lenguaje natural para cada anomalía detectada, describiendo qué se encontró y qué acción se recomienda.

### Requisito 12: Integración de NLQ en el Chat de IA

**Historia de Usuario:** Como gerente de RRHH sin conocimientos técnicos, quiero hacer preguntas sobre mi nómina en lenguaje natural directamente en el chat de IA, para que pueda obtener respuestas inmediatas sin navegar reportes complejos.

#### Criterios de Aceptación

1. WHEN el usuario envía una consulta en lenguaje natural en la Sidebar_IA, THE Dianis (Master) SHALL clasificar la intención y delegar consultas de datos al NLQ_Engine vía el endpoint `/api/v1/nlq`.
2. THE NLQ_Engine SHALL soportar consultas sobre datos de nómina del workspace activo: totales por concepto, comparaciones entre periodos, empleados con mayor riesgo, conteos de hallazgos y costos agregados.
3. WHEN el NLQ_Engine responde con datos, THE Sidebar_IA SHALL renderizar la respuesta con formato enriquecido: tablas para datos tabulares, valores destacados para métricas individuales y gráficos inline para comparaciones.
4. IF la consulta del usuario es ambigua, THEN THE NLQ_Engine SHALL solicitar clarificación presentando opciones específicas como botones seleccionables en el chat.
5. THE NLQ_Engine SHALL respetar los permisos RBAC del usuario, respondiendo exclusivamente con datos a los que el usuario tiene acceso según su rol y workspace.
6. THE Sidebar_IA SHALL mostrar las fuentes de datos utilizadas (tabla, periodo, empresa) para responder cada consulta NLQ, permitiendo al usuario verificar la información.
7. THE Sidebar_IA SHALL ofrecer una acción rápida "Consultar datos" en el panel de acciones que active el modo NLQ con sugerencias de consultas frecuentes.

### Requisito 13: Exposición de Forecasting en la UI

**Historia de Usuario:** Como director financiero, quiero ver proyecciones de costos de nómina directamente en el dashboard y en reportes, para que pueda planificar el presupuesto con mayor precisión sin necesidad de herramientas externas.

#### Criterios de Aceptación

1. THE Dashboard SHALL incluir un widget de forecast que muestre proyecciones de costos de nómina para los próximos 3, 6 y 12 meses, consumiendo datos del endpoint `/api/v1/forecast`.
2. THE widget de forecast SHALL mostrar un gráfico de líneas con bandas de confianza (optimista, esperado, pesimista) junto a los datos históricos reales de los últimos 6 periodos.
3. WHEN se cargan nuevos datos de nómina, THE Dashboard SHALL recalcular las proyecciones automáticamente incorporando los datos más recientes.
4. THE Forecast_Service SHALL considerar en las proyecciones: tendencias históricas de la empresa, cambios regulatorios conocidos (incrementos de salario mínimo almacenados en country_year_rules), estacionalidad y tasa de crecimiento de plantilla.
5. THE Forecast_Service SHALL alertar mediante una notificación in-app cuando una proyección indica un incremento de costos superior al 15% respecto al periodo anterior.
6. THE Página_Reports SHALL incluir una sección de forecast con los mismos datos del widget, más opciones para ajustar parámetros: tasa de crecimiento de plantilla, incremento salarial esperado y cambios regulatorios anticipados.
7. WHEN el usuario ajusta parámetros del forecast, THE Forecast_Service SHALL recalcular las proyecciones en tiempo real y actualizar el gráfico sin recargar la página.

### Requisito 14: Integración de SSO/SAML/OIDC en la UI

**Historia de Usuario:** Como administrador de TI de una empresa multinacional, quiero configurar y gestionar la autenticación SSO desde la interfaz de NominaSmart, para que mis empleados accedan con credenciales corporativas sin intervención técnica manual.

#### Criterios de Aceptación

1. THE Settings SHALL incluir una sección "Autenticación SSO" accesible para usuarios con rol admin que permita configurar el Identity Provider.
2. WHEN un administrador configura SSO, THE Settings_SSO SHALL permitir registrar el Identity Provider con: metadata URL, entity ID, certificado X.509, protocolo (SAML 2.0 o OIDC) y mapeo de grupos a roles de NominaSmart.
3. THE Página_Login SHALL mostrar un botón "Iniciar sesión con SSO corporativo" cuando la organización del usuario tenga SSO configurado, además de las opciones existentes de email/contraseña y OAuth.
4. WHEN un usuario inicia sesión vía SSO, THE SSO_Service SHALL mapear los atributos del Identity Provider (email, nombre, grupo) al perfil de usuario de NominaSmart y asignar el rol correspondiente según el mapeo configurado.
5. IF el Identity Provider no responde dentro de 10 segundos, THEN THE SSO_Service SHALL mostrar un mensaje de error descriptivo y ofrecer login alternativo con email/contraseña.
6. THE SSO_Service SHALL soportar aprovisionamiento automático (Just-In-Time provisioning) de usuarios que se autentican por primera vez vía SSO, creando su perfil con el rol predeterminado configurado por el administrador.
7. THE Settings_SSO SHALL mostrar el estado de la configuración SSO (activo, inactivo, error) y permitir probar la conexión con el Identity Provider.

### Requisito 15: Integración de Workspaces Multi-Equipo en la UI

**Historia de Usuario:** Como gerente de operaciones de una empresa con múltiples filiales, quiero gestionar workspaces desde la interfaz de NominaSmart, para que cada equipo trabaje con sus datos de forma aislada y organizada.

#### Criterios de Aceptación

1. THE NominaSmart SHALL mostrar un selector de workspace en el header de la aplicación cuando el usuario pertenezca a más de un workspace.
2. WHEN el usuario cambia de workspace mediante el selector, THE NominaSmart SHALL recargar los datos del Dashboard, planillas, reportes y acciones del workspace seleccionado sin cerrar sesión.
3. THE Settings SHALL incluir una sección "Workspaces" accesible para usuarios con rol admin que permita crear, editar y eliminar workspaces.
4. WHEN un administrador crea un workspace, THE Workspace_Service SHALL solicitar: nombre, descripción, país predeterminado y miembros iniciales con sus roles dentro del workspace (owner, editor, viewer).
5. THE Dashboard SHALL mostrar métricas agregadas exclusivamente del workspace activo, filtrando todos los datos por workspace_id.
6. WHEN un administrador invita a un usuario a un workspace, THE Email_Service SHALL enviar una invitación con enlace directo al workspace.
7. THE Workspace_Service SHALL aplicar Row Level Security (RLS) para garantizar que los datos de un workspace sean inaccesibles desde otro workspace.

### Requisito 16: Integración de Webhooks en la UI

**Historia de Usuario:** Como desarrollador de integraciones, quiero configurar y gestionar webhooks desde la interfaz de NominaSmart, para que pueda recibir notificaciones automáticas en mis sistemas cuando ocurran eventos relevantes.

#### Criterios de Aceptación

1. THE Settings SHALL incluir una sección "Webhooks" accesible para usuarios con rol admin que permita registrar, editar, activar/desactivar y eliminar webhooks.
2. WHEN un administrador crea un webhook, THE Settings_Webhooks SHALL solicitar: URL del endpoint, eventos suscritos (planilla cargada, auditoría completada, corrección aplicada, reporte generado, regla actualizada, cambio de estado de action item), y generar automáticamente un secreto HMAC-SHA256.
3. THE Settings_Webhooks SHALL permitir probar un webhook enviando un evento de prueba al endpoint configurado y mostrando la respuesta recibida.
4. THE Settings_Webhooks SHALL mostrar un log de entregas recientes por webhook con: estado (exitoso, fallido, pendiente), código HTTP de respuesta, tiempo de respuesta y opción de reenviar entregas fallidas.
5. THE Webhook_Service SHALL firmar cada payload con HMAC-SHA256 usando el secreto único del webhook y documentar el proceso de verificación en la sección de ayuda.
6. IF un webhook falla (respuesta no-2xx o timeout de 30 segundos), THEN THE Webhook_Service SHALL reintentar con backoff exponencial (30s, 60s, 120s) hasta un máximo de 5 intentos.
7. THE Settings_Webhooks SHALL permitir configurar hasta 10 webhooks por workspace.

### Requisito 17: Operaciones Masivas (Bulk Operations) en la UI

**Historia de Usuario:** Como analista de nómina que gestiona múltiples empresas, quiero ejecutar operaciones sobre múltiples registros simultáneamente desde la interfaz, para que no tenga que procesar cada planilla o acción individualmente.

#### Criterios de Aceptación

1. THE Página_Reports SHALL permitir seleccionar múltiples planillas mediante checkboxes y ejecutar acciones masivas: exportar a Excel, eliminar y re-auditar.
2. THE Página_Reconcile SHALL permitir seleccionar múltiples action items y ejecutar acciones masivas: cambiar estado, asignar responsable y cambiar prioridad.
3. WHEN el usuario ejecuta una operación masiva, THE Bulk_Operations SHALL mostrar una barra de progreso con porcentaje completado, registros procesados y tiempo estimado restante.
4. IF una operación masiva falla parcialmente, THEN THE Bulk_Operations SHALL completar los registros exitosos, reportar los fallidos con detalle del error y ofrecer reintentar solo los fallidos.
5. THE Bulk_Operations SHALL solicitar confirmación explícita antes de ejecutar operaciones destructivas (eliminación masiva) mostrando el conteo de registros afectados y un campo de confirmación por texto.
6. THE Bulk_Operations SHALL consumir los endpoints existentes en `/api/v1/bulk/` para ejecutar las operaciones en el servidor.

### Requisito 18: Documentación OpenAPI/Swagger Interactiva

**Historia de Usuario:** Como desarrollador de integraciones, quiero una documentación de API interactiva y siempre actualizada, para que pueda explorar, entender y probar los endpoints de NominaSmart de forma autónoma.

#### Criterios de Aceptación

1. THE NominaSmart SHALL exponer la especificación OpenAPI 3.1 existente en `/api/v1/docs/openapi.json` con documentación completa de todos los endpoints públicos de la API v1.
2. THE NominaSmart SHALL servir una interfaz interactiva (Swagger UI o Scalar) en `/api/docs` que permita explorar y probar los endpoints directamente desde el navegador.
3. THE OpenAPI_Spec SHALL generarse automáticamente a partir de los esquemas Zod existentes en `src/lib/schemas/` usando la función `generateOpenApiSpec()` de `src/lib/openapi/generate-spec.ts` para mantener sincronización entre validación y documentación.
4. THE OpenAPI_Spec SHALL documentar para cada endpoint: descripción, parámetros, request body con esquema JSON Schema, respuestas posibles con códigos HTTP, esquemas de respuesta y ejemplos de uso.
5. THE API_Docs SHALL requerir autenticación para acceder, mostrando solo los endpoints disponibles según el rol del usuario autenticado.
6. THE OpenAPI_Spec SHALL incluir la documentación de autenticación (Bearer token, API key) y los esquemas de error estándar definidos en el Requisito 6.

### Requisito 19: SDK para Integraciones Programáticas

**Historia de Usuario:** Como desarrollador que integra NominaSmart con sistemas internos, quiero un SDK tipado que abstraiga las llamadas a la API, para que pueda integrar funcionalidades de NominaSmart en mis aplicaciones sin construir un cliente HTTP desde cero.

#### Criterios de Aceptación

1. THE SDK_Client existente en `src/lib/sdk/nominasmart-client.ts` SHALL exponerse como un paquete documentado con métodos tipados para las operaciones principales: autenticación, carga de planillas, ejecución de auditorías, consulta de reportes, gestión de reglas y operaciones masivas.
2. THE SDK_Client SHALL incluir tipado TypeScript completo para todos los request y response bodies, generados a partir de los esquemas Zod existentes.
3. THE SDK_Client SHALL implementar manejo automático de autenticación: almacenamiento de token, refresh automático y reintentos con backoff exponencial ante errores 401.
4. THE SDK_Client SHALL incluir documentación inline (JSDoc) para cada método público con descripción, parámetros, tipo de retorno y ejemplo de uso.
5. THE NominaSmart SHALL incluir una página de documentación del SDK accesible desde la sección de desarrolladores con guía de inicio rápido, ejemplos de uso y referencia de métodos.
6. THE SDK_Client SHALL soportar configuración de base URL, timeout y headers personalizados para adaptarse a diferentes entornos (desarrollo, staging, producción).

### Requisito 20: Storybook para Biblioteca de Componentes

**Historia de Usuario:** Como desarrollador de NominaSmart, quiero una documentación visual e interactiva de todos los componentes UI, para que pueda descubrir, probar y reutilizar componentes existentes sin leer el código fuente.

#### Criterios de Aceptación

1. THE NominaSmart SHALL incluir una instancia de Storybook configurada con soporte para React 19, Tailwind CSS 4 y el design system Obsidian_Ledger.
2. THE Storybook SHALL incluir stories para los componentes UI principales: Button, Input, Select, Dialog, Card, Table, Tabs, Toast, Badge, Avatar, Tooltip, Dropdown Menu, Progress Bar, Skeleton y Sidebar.
3. THE Storybook SHALL renderizar cada componente en ambos temas (claro y oscuro) usando el Theme_Engine definido en el Requisito 7.
4. THE Storybook SHALL documentar para cada componente: descripción, variantes disponibles, props con tipos y valores por defecto, y ejemplos de composición.
5. THE Storybook SHALL incluir una sección de "Design Tokens" que muestre la paleta de colores, tipografía, espaciado y sombras del Obsidian_Ledger en ambos temas.
6. THE NominaSmart SHALL incluir un script `npm run storybook` para ejecutar Storybook en modo desarrollo.
7. THE Storybook SHALL incluir stories para componentes compuestos específicos de NominaSmart: PayrollTable, AISidebar, DashboardWidget y RuleEditor.

### Requisito 21: Dashboard de Health Check y Monitoreo

**Historia de Usuario:** Como administrador del sistema, quiero un dashboard de salud que muestre el estado de todos los servicios y dependencias de NominaSmart en tiempo real, para que pueda detectar y resolver problemas antes de que afecten a los usuarios.

#### Criterios de Aceptación

1. THE Admin SHALL incluir una página de "Salud del Sistema" que muestre el estado en tiempo real de todos los servicios: Supabase (PostgreSQL), Redis (Upstash), proveedores de IA (5 proveedores), Firecrawl, Resend (email) y disco.
2. THE Health_Dashboard SHALL consumir el endpoint existente `/api/v1/health` y mostrar para cada servicio: estado (healthy, degraded, down), latencia de respuesta, último check exitoso y mensaje de error cuando aplique.
3. THE Health_Dashboard SHALL actualizar los estados automáticamente cada 30 segundos sin requerir recarga manual de la página.
4. WHEN un servicio cambia de estado healthy a degraded o down, THE Health_Monitor SHALL crear una notificación in-app de severidad "critical" para todos los usuarios con rol admin.
5. THE Health_Dashboard SHALL mostrar un historial de incidentes de las últimas 24 horas con: servicio afectado, duración del incidente, estado de resolución y timestamp.
6. THE Health_Dashboard SHALL mostrar métricas agregadas: uptime porcentual por servicio en los últimos 7 días, latencia promedio y conteo de incidentes.
7. THE Health_Monitor SHALL registrar cada verificación de salud en el Metrics_Collector para análisis histórico y tendencias.

### Requisito 22: Integración de Error Tracking con Sentry

**Historia de Usuario:** Como equipo de desarrollo, queremos capturar y analizar errores de producción automáticamente, para que podamos identificar, priorizar y resolver bugs antes de que los usuarios los reporten.

#### Criterios de Aceptación

1. THE NominaSmart SHALL integrar el SDK de Sentry tanto en el cliente (React) como en el servidor (Next.js API routes) para captura automática de excepciones no controladas.
2. THE Sentry_Integration SHALL capturar para cada error: stack trace, breadcrumbs (últimas 20 acciones del usuario), contexto del usuario (ID, rol, workspace), URL, navegador y versión de la aplicación.
3. THE Sentry_Integration SHALL configurar source maps para que los stack traces muestren el código fuente original de TypeScript en lugar del código compilado.
4. THE Sentry_Integration SHALL filtrar información sensible antes de enviar a Sentry: API keys, tokens de autenticación, datos de nómina de empleados y cualquier PII.
5. THE Sentry_Integration SHALL configurar alertas automáticas cuando la tasa de errores supere 10 errores por minuto o cuando aparezca un nuevo tipo de error no visto previamente.
6. THE Sentry_Integration SHALL etiquetar cada evento con: entorno (development, staging, production), versión de la aplicación, locale del usuario y workspace activo.
7. THE Sentry_Integration SHALL capturar métricas de rendimiento (Web Vitals: LCP, FID, CLS) para las páginas principales: Dashboard, Upload, Reconcile y Reports.

### Requisito 23: Distributed Tracing para Solicitudes API

**Historia de Usuario:** Como desarrollador que diagnostica problemas de rendimiento, quiero rastrear una solicitud completa a través de todos los servicios involucrados, para que pueda identificar cuellos de botella y optimizar los flujos críticos.

#### Criterios de Aceptación

1. THE NominaSmart SHALL generar un trace ID único (UUID v4) para cada solicitud entrante y propagarlo a través de todos los servicios internos invocados durante el procesamiento.
2. THE NominaSmart SHALL incluir el trace ID en el header `X-Request-Id` de todas las respuestas de API (consistente con el Requisito 6).
3. THE NominaSmart SHALL registrar el trace ID en todos los logs generados durante el procesamiento de una solicitud, incluyendo: llamadas a Supabase, invocaciones a proveedores de IA, operaciones del AgentBus y llamadas a servicios externos.
4. WHEN una solicitud involucra múltiples agentes de IA (orquestación), THE Distributed_Tracing SHALL crear spans hijos para cada agente invocado con: nombre del agente, duración, tokens consumidos y resultado.
5. THE Distributed_Tracing SHALL registrar spans para las operaciones críticas: autenticación, validación de input, consulta a base de datos, invocación de IA, serialización de respuesta y envío de webhooks.
6. THE Health_Dashboard SHALL incluir una vista de "Traces Recientes" que muestre las últimas 50 solicitudes con: endpoint, duración total, número de spans, estado y opción de expandir el detalle del trace.
7. THE Distributed_Tracing SHALL integrarse con Sentry Performance para visualización de traces en el dashboard de Sentry cuando esté configurado.
