# Documento de Requisitos — NominaSmart World-Class

## Introducción

NominaSmart es una plataforma de auditoría de nómina multi-país con IA multi-agente que ya cuenta con un pipeline funcional de 4 pasos, 7 agentes de IA, soporte para 7 países, RBAC, SSE streaming, i18n y páginas públicas. Este documento define los requisitos para elevar NominaSmart al nivel de referente internacional, abordando las brechas críticas identificadas: funcionalidades enterprise, capacidades avanzadas de IA, colaboración en tiempo real, biblioteca de componentes UI de clase mundial, plataforma para desarrolladores, rendimiento y escalabilidad, cumplimiento normativo internacional, reportería avanzada, onboarding guiado y cobertura de pruebas integral.

El objetivo es transformar NominaSmart de una herramienta funcional a la plataforma de auditoría de nómina más potente y completa del mercado internacional.

## Glosario

- **NominaSmart**: Plataforma de auditoría de nómina multi-país con IA multi-agente.
- **Workspace**: Espacio de trabajo compartido por un equipo dentro de una organización.
- **SSO**: Single Sign-On, autenticación única federada.
- **SAML**: Security Assertion Markup Language, protocolo de autenticación enterprise.
- **OIDC**: OpenID Connect, protocolo de autenticación basado en OAuth 2.0.
- **Webhook**: Callback HTTP que notifica eventos a sistemas externos en tiempo real.
- **SDK**: Kit de desarrollo de software para integración programática con NominaSmart.
- **OpenAPI**: Especificación estándar para documentar APIs REST.
- **WCAG**: Web Content Accessibility Guidelines, estándares de accesibilidad web.
- **PWA**: Progressive Web App, aplicación web con capacidades nativas.
- **Storybook**: Herramienta de desarrollo y documentación de componentes UI aislados.
- **Redis**: Almacén de datos en memoria usado para caché y rate limiting distribuido.
- **CDN**: Content Delivery Network, red de distribución de contenido.
- **Web_Worker**: Hilo de ejecución en segundo plano del navegador para tareas pesadas.
- **Virtual_Scrolling**: Técnica de renderizado que solo muestra elementos visibles en viewport.
- **Anomaly_Detector**: Módulo de IA que detecta patrones atípicos en datos de nómina.
- **NLQ**: Natural Language Query, consultas en lenguaje natural sobre datos de nómina.
- **Audit_Trail_UI**: Interfaz visual para explorar el registro completo de auditoría del sistema.
- **Report_Builder**: Constructor visual de reportes personalizados con drag-and-drop.
- **Guided_Tour**: Tour interactivo paso a paso que guía al usuario por funcionalidades.
- **Component_Library**: Biblioteca de componentes UI reutilizables con documentación y tests.
- **SOC_2**: Service Organization Control 2, estándar de seguridad y disponibilidad.
- **GDPR**: General Data Protection Regulation, regulación europea de protección de datos.
- **Data_Residency**: Capacidad de almacenar datos en regiones geográficas específicas.
- **Benchmark**: Comparación de métricas de nómina contra promedios de la industria.
- **Activity_Feed**: Flujo cronológico de actividades del equipo en un workspace.
- **Annotation**: Comentario o nota asociada a una celda, fila o hallazgo específico.
- **Bulk_Operation**: Operación masiva aplicada a múltiples registros simultáneamente.
- **Scheduled_Report**: Reporte configurado para generarse y enviarse automáticamente.
- **Theme_Engine**: Motor de temas que permite cambiar entre modo claro y oscuro.
- **API_Versioning**: Sistema de versionado de API para compatibilidad hacia atrás.
- **PBT**: Property-Based Testing, pruebas basadas en propiedades generativas.

## Requisitos

### Requisito 1: Autenticación Enterprise (SSO/SAML/OIDC)

**Historia de Usuario:** Como administrador de TI de una empresa multinacional, quiero que mis empleados accedan a NominaSmart con las credenciales corporativas existentes, para que no necesiten gestionar contraseñas adicionales y cumplamos con las políticas de seguridad corporativa.

#### Criterios de Aceptación

1. THE NominaSmart SHALL soportar autenticación SSO mediante los protocolos SAML 2.0 y OIDC como métodos alternativos al login con email/contraseña.
2. WHEN un administrador configura SSO para su organización, THE Settings_SSO SHALL permitir registrar el Identity Provider con metadata URL, entity ID y certificado X.509.
3. WHEN un usuario inicia sesión vía SSO, THE Sistema_Auth SHALL mapear los atributos del Identity Provider (email, nombre, grupo) al perfil de usuario de NominaSmart y asignar el rol correspondiente.
4. IF el Identity Provider no responde dentro de 10 segundos, THEN THE Sistema_Auth SHALL mostrar un mensaje de error y ofrecer login alternativo con email/contraseña.
5. THE NominaSmart SHALL soportar aprovisionamiento automático (Just-In-Time provisioning) de usuarios que se autentican por primera vez vía SSO, creando su perfil con el rol predeterminado configurado por el administrador.
6. WHEN un usuario es desactivado en el Identity Provider, THE Sistema_Auth SHALL revocar la sesión activa de NominaSmart en la siguiente verificación de token.
7. THE Settings_SSO SHALL permitir configurar el mapeo de grupos del Identity Provider a roles de NominaSmart (admin, analyst, client).

### Requisito 2: Workspaces y Equipos

**Historia de Usuario:** Como gerente de operaciones de una empresa con múltiples filiales, quiero organizar a mi equipo en workspaces separados por filial o país, para que cada equipo trabaje con sus datos sin interferir con otros.

#### Criterios de Aceptación

1. THE NominaSmart SHALL soportar múltiples workspaces dentro de una organización, cada uno con su propio conjunto de empresas, planillas y configuraciones.
2. WHEN un administrador crea un workspace, THE Workspace_Manager SHALL solicitar nombre, descripción, país predeterminado y miembros iniciales con sus roles dentro del workspace.
3. THE Workspace_Manager SHALL permitir a los miembros de un workspace ver exclusivamente los datos (planillas, reportes, acciones) asociados a ese workspace.
4. WHEN un usuario pertenece a múltiples workspaces, THE NominaSmart SHALL mostrar un selector de workspace en el header que permita cambiar entre ellos sin cerrar sesión.
5. THE Workspace_Manager SHALL soportar roles específicos por workspace: owner (gestión completa), editor (carga y auditoría), viewer (solo lectura de reportes).
6. WHEN un administrador invita a un usuario a un workspace, THE Email_Service SHALL enviar una invitación con enlace directo al workspace.
7. THE Dashboard SHALL mostrar métricas agregadas del workspace activo, no de toda la organización.

### Requisito 3: Interfaz de Audit Trail

**Historia de Usuario:** Como auditor de cumplimiento, quiero explorar visualmente el historial completo de acciones realizadas en la plataforma, para que pueda demostrar trazabilidad ante auditorías externas.

#### Criterios de Aceptación

1. THE Audit_Trail_UI SHALL mostrar un registro cronológico de todas las acciones realizadas en el sistema: cambios en reglas, cargas de planillas, correcciones aplicadas, cambios de configuración y accesos de usuarios.
2. THE Audit_Trail_UI SHALL permitir filtrar el registro por tipo de acción, usuario, rango de fechas, workspace y nivel de severidad.
3. WHEN un usuario hace clic en una entrada del audit trail, THE Audit_Trail_UI SHALL mostrar el detalle completo incluyendo: usuario, timestamp, acción, datos anteriores, datos nuevos, IP de origen y user-agent.
4. THE Audit_Trail_UI SHALL permitir exportar el registro filtrado a formato CSV y PDF para auditorías externas.
5. THE Audit_Trail_UI SHALL retener registros por un mínimo de 7 años para cumplir con requisitos regulatorios internacionales.
6. THE Audit_Service SHALL registrar automáticamente cada operación de escritura en las APIs protegidas sin requerir código adicional en cada endpoint.
7. IF el volumen de registros excede 10,000 entradas en una consulta, THEN THE Audit_Trail_UI SHALL implementar paginación con cursor para mantener el rendimiento.

### Requisito 4: Operaciones Masivas (Bulk Operations)

**Historia de Usuario:** Como analista de nómina que gestiona múltiples empresas, quiero ejecutar operaciones sobre múltiples planillas o registros simultáneamente, para que no tenga que procesar cada uno individualmente.

#### Criterios de Aceptación

1. THE Página_Reports SHALL permitir seleccionar múltiples planillas y ejecutar acciones masivas: exportar, eliminar o re-auditar.
2. WHEN el usuario selecciona múltiples action items en la Página_Reconcile, THE Bulk_Operations SHALL permitir cambiar el estado, asignar responsable o cambiar prioridad de todos los seleccionados en una sola operación.
3. THE Bulk_Operations SHALL mostrar una barra de progreso durante la ejecución de operaciones masivas indicando el porcentaje completado y los registros procesados.
4. IF una operación masiva falla parcialmente, THEN THE Bulk_Operations SHALL completar los registros exitosos, reportar los fallidos con detalle del error y ofrecer reintentar solo los fallidos.
5. THE Bulk_Operations SHALL solicitar confirmación explícita antes de ejecutar operaciones destructivas (eliminación masiva) mostrando el conteo de registros afectados.
6. THE Pipeline_Auditoría SHALL permitir cargar múltiples archivos de nómina en una sola sesión, procesándolos secuencialmente con un resumen consolidado al finalizar.

### Requisito 5: Reportes Programados (Scheduled Reports)

**Historia de Usuario:** Como gerente de RRHH, quiero programar reportes automáticos que se generen y envíen periódicamente, para que mi equipo directivo reciba información actualizada sin solicitarla manualmente.

#### Criterios de Aceptación

1. THE Report_Scheduler SHALL permitir configurar reportes automáticos con frecuencia: diaria, semanal, mensual o personalizada (expresión cron).
2. WHEN el usuario crea un reporte programado, THE Report_Scheduler SHALL solicitar: tipo de reporte, filtros (empresa, país, periodo), formato de salida (Excel, PDF), destinatarios por email y frecuencia.
3. WHEN llega la hora programada, THE Report_Scheduler SHALL generar el reporte con los datos más recientes y enviarlo por email a los destinatarios configurados.
4. THE Report_Scheduler SHALL mantener un historial de ejecuciones con estado (exitoso, fallido), fecha de ejecución y enlace al reporte generado.
5. IF la generación de un reporte programado falla, THEN THE Report_Scheduler SHALL reintentar una vez después de 15 minutos y notificar al creador si el reintento también falla.
6. THE Report_Scheduler SHALL permitir pausar, reanudar y eliminar reportes programados existentes.
7. THE Report_Scheduler SHALL respetar los permisos RBAC del creador del reporte, generando solo datos a los que el usuario tiene acceso.

### Requisito 6: Sistema de Webhooks

**Historia de Usuario:** Como desarrollador de integraciones, quiero recibir notificaciones automáticas cuando ocurren eventos en NominaSmart, para que pueda sincronizar datos con nuestros sistemas internos en tiempo real.

#### Criterios de Aceptación

1. THE Webhook_System SHALL permitir registrar endpoints HTTP que reciban notificaciones cuando ocurran eventos específicos en NominaSmart.
2. THE Webhook_System SHALL soportar los siguientes eventos: planilla cargada, auditoría completada, corrección aplicada, reporte generado, regla normativa actualizada, usuario invitado y cambio de estado de action item.
3. WHEN ocurre un evento suscrito, THE Webhook_System SHALL enviar un POST HTTP al endpoint registrado con payload JSON que incluya: tipo de evento, timestamp, datos del evento y firma HMAC-SHA256 para verificación.
4. THE Webhook_System SHALL permitir configurar hasta 10 webhooks por workspace con filtros por tipo de evento.
5. IF un webhook falla (respuesta no-2xx o timeout de 30 segundos), THEN THE Webhook_System SHALL reintentar con backoff exponencial (30s, 60s, 120s) hasta un máximo de 5 intentos.
6. THE Webhook_System SHALL mantener un log de entregas con estado (exitoso, fallido, pendiente), código de respuesta HTTP y tiempo de respuesta.
7. THE Settings_Webhooks SHALL permitir probar un webhook enviando un evento de prueba al endpoint configurado.
8. THE Webhook_System SHALL firmar cada payload con HMAC-SHA256 usando un secreto único por webhook para que el receptor pueda verificar la autenticidad.

### Requisito 7: Detección de Anomalías con IA

**Historia de Usuario:** Como auditor de nómina, quiero que el sistema detecte automáticamente patrones atípicos en los datos de nómina, para que pueda identificar fraudes potenciales o errores sistemáticos que las verificaciones estándar no capturan.

#### Criterios de Aceptación

1. WHEN Juli completa la auditoría estándar, THE Anomaly_Detector SHALL analizar los datos de nómina buscando patrones atípicos: variaciones inusuales entre periodos, valores outlier por cargo o departamento, y patrones de redondeo sospechosos.
2. THE Anomaly_Detector SHALL comparar los datos del periodo actual contra los 6 periodos anteriores de la misma empresa para detectar desviaciones significativas.
3. WHEN el Anomaly_Detector identifica una anomalía, THE Sistema SHALL clasificarla con nivel de confianza (alto, medio, bajo) y categoría (fraude potencial, error sistemático, variación estacional, cambio legítimo).
4. THE Dashboard SHALL mostrar un panel de anomalías detectadas con visualización de tendencias y drill-down por empleado o concepto.
5. THE Anomaly_Detector SHALL generar explicaciones en lenguaje natural para cada anomalía detectada, describiendo qué se encontró, por qué es atípico y qué acción se recomienda.
6. IF no existen periodos anteriores para comparación, THEN THE Anomaly_Detector SHALL usar benchmarks de la industria por país y tamaño de empresa como referencia.

### Requisito 8: Análisis Predictivo y Forecasting

**Historia de Usuario:** Como director financiero, quiero proyecciones de costos de nómina basadas en tendencias históricas, para que pueda planificar el presupuesto con mayor precisión.

#### Criterios de Aceptación

1. THE Predictive_Analytics SHALL generar proyecciones de costos de nómina para los próximos 3, 6 y 12 meses basándose en datos históricos de la empresa.
2. WHEN el usuario solicita un forecast, THE Predictive_Analytics SHALL considerar: tendencias históricas de la empresa, cambios regulatorios conocidos (incrementos de salario mínimo, nuevas contribuciones), estacionalidad y crecimiento de plantilla.
3. THE Dashboard SHALL mostrar un gráfico de forecast con bandas de confianza (optimista, esperado, pesimista) junto a los datos históricos reales.
4. THE Predictive_Analytics SHALL alertar cuando una proyección indica un incremento de costos superior al 15% respecto al periodo anterior.
5. WHEN se cargan nuevos datos de nómina, THE Predictive_Analytics SHALL recalcular las proyecciones automáticamente incorporando los datos más recientes.
6. THE Predictive_Analytics SHALL permitir al usuario ajustar parámetros del forecast: tasa de crecimiento de plantilla, incremento salarial esperado y cambios regulatorios anticipados.

### Requisito 9: Consultas en Lenguaje Natural (NLQ)

**Historia de Usuario:** Como gerente de RRHH sin conocimientos técnicos, quiero hacer preguntas sobre mi nómina en lenguaje natural, para que pueda obtener respuestas sin necesidad de navegar reportes complejos.

#### Criterios de Aceptación

1. THE Sidebar_IA SHALL interpretar consultas en lenguaje natural sobre datos de nómina y responder con datos específicos del workspace activo.
2. WHEN el usuario hace una consulta como "¿cuánto gastamos en aportes a salud el mes pasado?", THE NLQ_Engine SHALL traducir la consulta a una búsqueda en los datos de planillas y responder con el valor exacto y contexto.
3. THE NLQ_Engine SHALL soportar consultas comparativas entre periodos: "compara los costos de nómina de enero vs febrero" generando tablas y gráficos comparativos.
4. THE NLQ_Engine SHALL soportar consultas agregadas: "¿cuál es el empleado con mayor riesgo?" o "¿cuántas planillas tienen hallazgos críticos?".
5. IF la consulta del usuario es ambigua, THEN THE NLQ_Engine SHALL solicitar clarificación presentando opciones específicas en lugar de adivinar.
6. THE NLQ_Engine SHALL respetar los permisos RBAC del usuario, respondiendo exclusivamente con datos a los que tiene acceso.
7. THE Sidebar_IA SHALL mostrar las fuentes de datos utilizadas para responder cada consulta, permitiendo al usuario verificar la información.

### Requisito 10: Análisis Comparativo entre Periodos

**Historia de Usuario:** Como analista de nómina, quiero comparar los resultados de auditoría entre diferentes periodos, para que pueda identificar tendencias y evaluar si las correcciones aplicadas tuvieron efecto.

#### Criterios de Aceptación

1. THE Página_Reports SHALL incluir una vista de comparación lado a lado de dos periodos seleccionados por el usuario.
2. WHEN el usuario selecciona dos periodos para comparar, THE Comparative_Analysis SHALL mostrar: diferencias en costos totales, variaciones por concepto de nómina, cambios en score de riesgo y hallazgos nuevos vs resueltos.
3. THE Comparative_Analysis SHALL resaltar visualmente las variaciones significativas (superiores al 5%) con indicadores de dirección (aumento/disminución) y porcentaje de cambio.
4. THE Comparative_Analysis SHALL generar un resumen narrativo de las diferencias principales usando Ana, explicando las causas probables de las variaciones.
5. THE Comparative_Analysis SHALL permitir comparar periodos de diferentes empresas dentro del mismo workspace para benchmarking interno.
6. THE Comparative_Analysis SHALL permitir exportar el análisis comparativo a formato Excel y PDF.


### Requisito 11: Colaboración en Tiempo Real

**Historia de Usuario:** Como equipo de auditoría de nómina, queremos trabajar simultáneamente sobre la misma planilla y ver los cambios de nuestros compañeros en tiempo real, para que podamos completar auditorías complejas de forma colaborativa y eficiente.

#### Criterios de Aceptación

1. WHEN múltiples usuarios abren la misma planilla en el PayrollEditor, THE Collaboration_Engine SHALL mostrar indicadores de presencia (avatar y cursor) de cada usuario conectado.
2. WHEN un usuario aplica una corrección a una celda, THE Collaboration_Engine SHALL propagar el cambio a todos los usuarios conectados a la misma planilla en menos de 500ms.
3. THE Collaboration_Engine SHALL implementar resolución de conflictos optimista: si dos usuarios editan la misma celda simultáneamente, el último cambio prevalece y el usuario cuyo cambio fue sobrescrito recibe una notificación con la opción de revertir.
4. THE Collaboration_Engine SHALL usar Supabase Realtime (WebSocket) para la sincronización de cambios entre usuarios conectados.
5. WHEN un usuario se desconecta inesperadamente, THE Collaboration_Engine SHALL preservar sus cambios no guardados y sincronizarlos al reconectarse.
6. THE PayrollEditor SHALL mostrar un indicador de "usuarios editando" con el conteo y avatares de los colaboradores activos.

### Requisito 12: Anotaciones y Comentarios

**Historia de Usuario:** Como analista de nómina, quiero dejar comentarios y notas sobre hallazgos específicos, para que mi equipo pueda discutir y resolver problemas de forma contextual sin recurrir a herramientas externas.

#### Criterios de Aceptación

1. THE Annotation_System SHALL permitir a los usuarios crear comentarios asociados a: celdas específicas del PayrollEditor, hallazgos de auditoría, action items y secciones de reportes.
2. WHEN un usuario crea una anotación, THE Annotation_System SHALL registrar: autor, timestamp, texto del comentario, elemento asociado y menciones a otros usuarios.
3. WHEN un usuario es mencionado en una anotación (@usuario), THE Notification_Service SHALL enviar una notificación in-app y por email al usuario mencionado.
4. THE Annotation_System SHALL soportar hilos de respuesta para permitir discusiones contextuales sobre un mismo elemento.
5. THE Annotation_System SHALL permitir resolver anotaciones, marcándolas como completadas sin eliminarlas del historial.
6. THE Annotation_System SHALL mostrar un indicador visual (badge) en las celdas, hallazgos o secciones que tienen anotaciones activas.

### Requisito 13: Feed de Actividad del Equipo

**Historia de Usuario:** Como líder de equipo, quiero ver un resumen cronológico de las actividades de mi equipo en el workspace, para que pueda supervisar el progreso y detectar bloqueos.

#### Criterios de Aceptación

1. THE Activity_Feed SHALL mostrar un flujo cronológico de actividades del workspace activo: cargas de planillas, auditorías completadas, correcciones aplicadas, comentarios, cambios de estado de action items y reportes generados.
2. THE Activity_Feed SHALL permitir filtrar por tipo de actividad, usuario y rango de fechas.
3. WHEN ocurre una nueva actividad, THE Activity_Feed SHALL actualizar en tiempo real sin requerir recarga de página.
4. THE Activity_Feed SHALL agrupar actividades relacionadas (por ejemplo, múltiples correcciones en la misma planilla) para reducir el ruido visual.
5. THE Dashboard SHALL incluir un widget de actividad reciente mostrando las últimas 10 actividades del workspace.

### Requisito 14: Biblioteca de Componentes UI (Component Library)

**Historia de Usuario:** Como desarrollador de NominaSmart, quiero una biblioteca de componentes UI consistente, documentada y testeada, para que pueda construir nuevas funcionalidades rápidamente manteniendo coherencia visual y calidad.

#### Criterios de Aceptación

1. THE Component_Library SHALL incluir componentes fundacionales: Button, Input, Select, Checkbox, Radio, Toggle, Textarea, Label, Badge, Avatar, Tooltip, Popover, Dialog (Modal), Sheet (Drawer), Dropdown Menu, Command Palette, Toast, Alert, Card, Tabs, Accordion, Table, Pagination, Skeleton, Spinner y Progress Bar.
2. THE Component_Library SHALL construirse sobre Radix UI primitives para garantizar accesibilidad nativa y comportamiento consistente entre navegadores.
3. THE Component_Library SHALL documentar cada componente en Storybook con: descripción, variantes, props, ejemplos de uso y guías de accesibilidad.
4. THE Component_Library SHALL implementar variantes de estilo consistentes con el design system Obsidian_Ledger: variantes primary, secondary, destructive, outline y ghost para botones; variantes default, error y disabled para inputs.
5. THE Component_Library SHALL soportar composición mediante el patrón Slot de Radix para permitir personalización sin perder funcionalidad base.
6. THE Component_Library SHALL exportar todos los componentes desde un barrel file `src/components/ui/index.ts` para importaciones simplificadas.
7. THE Component_Library SHALL incluir tests unitarios para cada componente verificando renderizado, interacciones y estados.

### Requisito 15: Accesibilidad WCAG 2.1 AA

**Historia de Usuario:** Como usuario con discapacidad visual, quiero que NominaSmart sea completamente accesible con lector de pantalla y navegación por teclado, para que pueda usar la plataforma de forma independiente.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar atributos ARIA (aria-label, aria-describedby, aria-live, role) en todos los componentes interactivos de la interfaz.
2. THE NominaSmart SHALL soportar navegación completa por teclado: Tab para avanzar entre elementos focusables, Shift+Tab para retroceder, Enter/Space para activar, Escape para cerrar modales y menús.
3. THE NominaSmart SHALL implementar gestión de foco (focus management): al abrir un modal el foco se mueve al primer elemento interactivo, al cerrar el foco retorna al elemento que lo abrió, y el foco queda atrapado dentro del modal mientras está abierto (focus trap).
4. THE NominaSmart SHALL mantener un ratio de contraste mínimo de 4.5:1 para texto normal y 3:1 para texto grande en todos los temas (claro y oscuro).
5. THE NominaSmart SHALL proporcionar textos alternativos descriptivos para todas las imágenes, iconos funcionales y gráficos.
6. THE NominaSmart SHALL implementar regiones ARIA live para anunciar cambios dinámicos (notificaciones, resultados de búsqueda, progreso de operaciones) a tecnologías asistivas.
7. WHEN el usuario navega por teclado, THE NominaSmart SHALL mostrar un indicador de foco visible con un outline de alto contraste en el elemento activo.
8. THE NominaSmart SHALL permitir saltar al contenido principal con un enlace "Skip to content" visible al hacer Tab desde el inicio de la página.

### Requisito 16: Diseño Responsive y Mobile-First

**Historia de Usuario:** Como gerente de nómina que viaja frecuentemente, quiero acceder a NominaSmart desde mi teléfono móvil con una experiencia optimizada, para que pueda revisar reportes y aprobar acciones desde cualquier lugar.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar un diseño responsive que se adapte a 4 breakpoints: mobile (< 640px), tablet (640px-1024px), desktop (1024px-1440px) y wide (> 1440px).
2. WHILE el viewport es menor a 1024px, THE Sidebar SHALL transformarse en un menú lateral deslizable (drawer) activado por un botón hamburguesa.
3. THE PayrollEditor SHALL implementar scroll horizontal con indicadores de columnas fijas (employee doc, nombre) en viewports menores a 1024px.
4. THE Dashboard SHALL reorganizar las tarjetas de métricas y gráficos en layout de una columna en viewports menores a 640px.
5. THE NominaSmart SHALL registrar un Service Worker que permita funcionalidad PWA: instalación en pantalla de inicio, caché de assets estáticos y página offline básica.
6. THE NominaSmart SHALL optimizar las interacciones táctiles: áreas de toque mínimas de 44x44px, gestos de swipe para navegación entre pasos del pipeline y pull-to-refresh en listas.
7. WHILE el viewport es menor a 640px, THE Sidebar_IA SHALL mostrarse como un panel de pantalla completa en lugar de panel lateral.

### Requisito 17: Motor de Temas (Claro/Oscuro)

**Historia de Usuario:** Como usuario que trabaja largas jornadas frente a la pantalla, quiero alternar entre modo claro y oscuro, para que pueda reducir la fatiga visual según las condiciones de iluminación.

#### Criterios de Aceptación

1. THE Theme_Engine SHALL soportar 3 modos de tema: claro, oscuro y automático (sigue la preferencia del sistema operativo).
2. WHEN el usuario cambia de tema, THE Theme_Engine SHALL aplicar la transición a todos los componentes de la interfaz sin recargar la página, usando variables CSS custom properties.
3. THE Theme_Engine SHALL persistir la preferencia de tema del usuario en localStorage y aplicarla al cargar la aplicación.
4. THE Theme_Engine SHALL definir tokens de diseño semánticos (background, foreground, primary, secondary, muted, accent, destructive, border, ring) que se adapten automáticamente al tema activo.
5. THE Component_Library SHALL usar exclusivamente tokens semánticos del Theme_Engine, sin colores hardcodeados.
6. THE Storybook SHALL renderizar cada componente en ambos temas (claro y oscuro) para verificación visual.

### Requisito 18: Dashboards Personalizables

**Historia de Usuario:** Como gerente de nómina, quiero personalizar mi dashboard con los widgets y métricas que más me importan, para que pueda tener una vista ejecutiva adaptada a mis necesidades específicas.

#### Criterios de Aceptación

1. THE Dashboard SHALL permitir al usuario agregar, remover y reordenar widgets mediante drag-and-drop.
2. THE Dashboard SHALL ofrecer un catálogo de widgets disponibles: métricas de planillas, gráfico de tendencia de riesgo, anomalías detectadas, forecast de costos, actividad reciente, estado de proveedores IA, calendario de reportes programados y resumen de action items pendientes.
3. WHEN el usuario personaliza su dashboard, THE Dashboard SHALL persistir la configuración de layout en la base de datos asociada al perfil del usuario.
4. THE Dashboard SHALL ofrecer layouts predefinidos por rol: ejecutivo (métricas + forecast + anomalías), analista (planillas + riesgo + acciones) y administrador (proveedores + uso IA + usuarios).
5. THE Dashboard SHALL permitir al usuario restaurar el layout predeterminado de su rol con un solo clic.
6. WHEN un widget falla al cargar datos, THE Dashboard SHALL mostrar un estado de error dentro del widget sin afectar a los demás widgets.


### Requisito 19: API REST Documentada con OpenAPI

**Historia de Usuario:** Como desarrollador de integraciones, quiero una API REST bien documentada con especificación OpenAPI, para que pueda integrar NominaSmart con nuestros sistemas internos de forma confiable y autónoma.

#### Criterios de Aceptación

1. THE NominaSmart SHALL exponer una especificación OpenAPI 3.1 completa en el endpoint `/api/docs/openapi.json` que describa todos los endpoints públicos de la API.
2. THE API_Docs SHALL incluir una interfaz interactiva (Swagger UI o Scalar) accesible en `/api/docs` que permita explorar y probar los endpoints directamente desde el navegador.
3. THE OpenAPI_Spec SHALL documentar para cada endpoint: descripción, parámetros, request body con esquema JSON Schema, respuestas posibles con códigos HTTP y esquemas, y ejemplos de uso.
4. THE NominaSmart SHALL implementar un formato de error consistente en todas las respuestas de API: `{ error: string, code: string, details?: object, requestId: string }`.
5. THE NominaSmart SHALL incluir un header `X-Request-Id` en todas las respuestas de API para trazabilidad de solicitudes.
6. THE OpenAPI_Spec SHALL generarse automáticamente a partir de los esquemas Zod existentes para mantener sincronización entre validación y documentación.
7. THE API_Docs SHALL requerir autenticación para acceder, mostrando solo los endpoints disponibles según el rol del usuario autenticado.

### Requisito 20: Versionado de API

**Historia de Usuario:** Como consumidor de la API de NominaSmart, quiero que los cambios en la API no rompan mis integraciones existentes, para que pueda actualizar a mi propio ritmo sin interrupciones.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar versionado de API mediante prefijo de ruta: `/api/v1/` para la versión actual.
2. WHEN se introduce un cambio incompatible (breaking change) en la API, THE NominaSmart SHALL crear una nueva versión (`/api/v2/`) manteniendo la versión anterior funcional por un mínimo de 6 meses.
3. THE NominaSmart SHALL incluir un header `X-API-Version` en todas las respuestas indicando la versión de la API utilizada.
4. THE NominaSmart SHALL incluir un header `Deprecation` con la fecha de deprecación cuando un endpoint está programado para ser removido.
5. WHEN un cliente usa un endpoint deprecado, THE NominaSmart SHALL incluir un header `Sunset` indicando la fecha en que el endpoint dejará de funcionar.
6. THE API_Docs SHALL documentar claramente las diferencias entre versiones y guías de migración.

### Requisito 21: SDK para Integraciones

**Historia de Usuario:** Como desarrollador, quiero un SDK oficial de NominaSmart en TypeScript, para que pueda integrar la plataforma en mis aplicaciones sin construir el cliente HTTP desde cero.

#### Criterios de Aceptación

1. THE NominaSmart_SDK SHALL proporcionar un cliente TypeScript tipado que cubra todos los endpoints de la API v1: autenticación, planillas, auditorías, reportes, acciones, reglas y webhooks.
2. THE NominaSmart_SDK SHALL generarse automáticamente a partir de la especificación OpenAPI para garantizar sincronización con la API.
3. THE NominaSmart_SDK SHALL soportar autenticación mediante API key y OAuth 2.0 bearer token.
4. THE NominaSmart_SDK SHALL incluir manejo automático de rate limiting: cuando recibe HTTP 429, espera el tiempo indicado en Retry-After y reintenta automáticamente.
5. THE NominaSmart_SDK SHALL incluir tipado completo de request y response para todos los endpoints, generado desde los esquemas Zod.
6. THE NominaSmart_SDK SHALL publicarse como paquete npm con documentación de uso, ejemplos y changelog.
7. THE NominaSmart_SDK SHALL incluir un método de verificación de firma para validar payloads de webhooks recibidos.

### Requisito 22: Estrategia de Caché con Redis

**Historia de Usuario:** Como usuario de NominaSmart, quiero que las páginas y datos frecuentes carguen instantáneamente, para que mi experiencia sea fluida incluso con grandes volúmenes de datos.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar una capa de caché con Redis (Upstash) para datos frecuentemente consultados: reglas normativas por país/año, configuración de proveedores IA, métricas del dashboard y perfil de usuario.
2. WHEN se consultan reglas normativas, THE Cache_Layer SHALL servir desde caché si los datos tienen menos de 1 hora de antigüedad, evitando consultas a la base de datos.
3. WHEN se actualizan datos cacheados (nueva regla, cambio de configuración), THE Cache_Layer SHALL invalidar las entradas de caché correspondientes inmediatamente.
4. THE Cache_Layer SHALL implementar el patrón cache-aside: consultar caché primero, si no existe consultar base de datos y almacenar en caché el resultado.
5. IF Redis no está disponible, THEN THE Cache_Layer SHALL funcionar sin caché consultando directamente la base de datos, sin interrumpir el servicio.
6. THE Cache_Layer SHALL registrar métricas de hit rate y latencia para monitoreo del rendimiento de caché.
7. THE Cache_Layer SHALL implementar TTL (Time To Live) configurable por tipo de dato: 1 hora para reglas, 5 minutos para métricas de dashboard, 15 minutos para configuración de proveedores.

### Requisito 23: Optimización de Rendimiento Frontend

**Historia de Usuario:** Como analista que trabaja con planillas de miles de empleados, quiero que la interfaz se mantenga fluida al navegar grandes volúmenes de datos, para que pueda completar auditorías sin que la aplicación se congele.

#### Criterios de Aceptación

1. THE PayrollEditor SHALL implementar virtual scrolling para renderizar solo las filas visibles en el viewport cuando la planilla exceda 100 filas, manteniendo un frame rate mínimo de 30fps durante el scroll.
2. THE NominaSmart SHALL implementar code splitting por ruta, cargando solo el JavaScript necesario para la página actual.
3. THE NominaSmart SHALL implementar lazy loading para componentes pesados: Recharts, PayrollEditor, Storybook y el editor de mapeo, cargándolos solo cuando el usuario navega a la sección correspondiente.
4. THE NominaSmart SHALL optimizar las imágenes usando el componente Image de Next.js con formatos WebP/AVIF y lazy loading nativo.
5. THE Pipeline_Auditoría SHALL procesar archivos Excel en Web Workers para evitar bloquear el hilo principal del navegador durante el parseo de archivos con más de 500 filas.
6. THE NominaSmart SHALL implementar prefetching de rutas adyacentes (next/link con prefetch) para navegación instantánea entre páginas frecuentes.
7. THE Dashboard SHALL implementar carga progresiva: mostrar skeletons inmediatamente, cargar métricas principales primero y gráficos después.

### Requisito 24: Preparación para SOC 2

**Historia de Usuario:** Como CISO de una empresa enterprise, quiero evidencia de que NominaSmart cumple con estándares de seguridad reconocidos, para que pueda aprobar su uso dentro de nuestra organización.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar logging centralizado de todos los accesos a datos sensibles (planillas, datos de empleados, API keys) con timestamp, usuario, acción y resultado.
2. THE NominaSmart SHALL implementar cifrado en tránsito (TLS 1.3) para todas las comunicaciones y cifrado en reposo (AES-256) para datos sensibles almacenados.
3. THE NominaSmart SHALL implementar políticas de contraseña configurables: longitud mínima de 12 caracteres, complejidad requerida (mayúsculas, minúsculas, números, símbolos) y expiración configurable.
4. THE NominaSmart SHALL implementar bloqueo de cuenta después de 5 intentos fallidos de login consecutivos, con desbloqueo automático después de 30 minutos.
5. THE NominaSmart SHALL mantener un inventario de datos sensibles documentando: qué datos se almacenan, dónde se almacenan, quién tiene acceso, periodo de retención y método de eliminación.
6. THE Settings_Security SHALL mostrar un panel de cumplimiento con el estado de cada control de seguridad implementado (activo, parcial, pendiente).
7. THE NominaSmart SHALL implementar eliminación segura de datos: cuando un usuario o empresa solicita eliminación, todos los datos asociados se eliminan de la base de datos y caché dentro de 30 días.

### Requisito 25: Cumplimiento GDPR

**Historia de Usuario:** Como empresa con operaciones en Europa, quiero que NominaSmart cumpla con GDPR, para que pueda procesar datos de nómina de empleados europeos sin riesgo legal.

#### Criterios de Aceptación

1. THE NominaSmart SHALL implementar un mecanismo de consentimiento explícito para el procesamiento de datos personales, registrando: fecha de consentimiento, versión de la política aceptada y método de obtención.
2. THE NominaSmart SHALL permitir a los usuarios ejercer el derecho de acceso: exportar todos sus datos personales en formato JSON estructurado mediante un botón en Settings.
3. THE NominaSmart SHALL permitir a los usuarios ejercer el derecho al olvido: solicitar la eliminación completa de sus datos personales con confirmación y periodo de gracia de 30 días.
4. THE NominaSmart SHALL mantener un registro de actividades de procesamiento (Record of Processing Activities) documentando: finalidad, categorías de datos, destinatarios, transferencias internacionales y periodos de retención.
5. IF se detecta una brecha de seguridad que afecta datos personales, THEN THE NominaSmart SHALL notificar a los administradores afectados dentro de 72 horas con detalle del incidente, datos afectados y medidas tomadas.
6. THE NominaSmart SHALL mostrar badges de cumplimiento (GDPR, SOC 2 readiness) en la página de seguridad pública y en el footer de la aplicación.

### Requisito 26: Opciones de Residencia de Datos

**Historia de Usuario:** Como empresa regulada en Brasil, quiero que los datos de nómina de mis empleados brasileños se almacenen en servidores dentro de Brasil, para que cumpla con la LGPD y regulaciones locales de protección de datos.

#### Criterios de Aceptación

1. THE NominaSmart SHALL permitir a los administradores seleccionar la región de almacenamiento de datos al crear un workspace: América del Norte, América del Sur, Europa o Asia-Pacífico.
2. WHEN un administrador selecciona una región, THE Data_Residency SHALL garantizar que todos los datos del workspace (planillas, reportes, datos de empleados) se almacenen exclusivamente en la región seleccionada.
3. THE Settings_Security SHALL mostrar la región de almacenamiento actual del workspace con indicador visual de ubicación geográfica.
4. THE NominaSmart SHALL documentar las regiones disponibles con sus ubicaciones físicas de data center y certificaciones de cumplimiento local.
5. IF un usuario intenta transferir datos entre regiones, THEN THE Data_Residency SHALL solicitar confirmación explícita informando las implicaciones regulatorias de la transferencia.

### Requisito 27: Constructor de Reportes Personalizados

**Historia de Usuario:** Como analista de nómina, quiero crear reportes personalizados seleccionando las métricas y visualizaciones que necesito, para que pueda generar informes adaptados a los requerimientos específicos de cada cliente o auditoría.

#### Criterios de Aceptación

1. THE Report_Builder SHALL proporcionar una interfaz visual donde el usuario pueda seleccionar campos de datos, métricas, filtros y tipo de visualización (tabla, gráfico de barras, gráfico de líneas, gráfico circular) para construir reportes personalizados.
2. THE Report_Builder SHALL permitir arrastrar y soltar campos desde un panel de campos disponibles (datos de planilla, métricas de riesgo, datos de empleados, hallazgos de auditoría) al área de diseño del reporte.
3. THE Report_Builder SHALL permitir guardar reportes personalizados con nombre y descripción para reutilización futura.
4. THE Report_Builder SHALL permitir compartir reportes personalizados con otros miembros del workspace.
5. THE Report_Builder SHALL permitir exportar reportes personalizados a formato Excel y PDF.
6. THE Report_Builder SHALL incluir plantillas predefinidas: resumen ejecutivo, detalle por empleado, comparativo de periodos, cumplimiento normativo y análisis de costos.
7. WHEN el usuario modifica los filtros de un reporte personalizado, THE Report_Builder SHALL actualizar la vista previa en tiempo real.

### Requisito 28: Exportación a PDF

**Historia de Usuario:** Como gerente de RRHH, quiero exportar reportes en formato PDF con diseño profesional, para que pueda presentarlos a la dirección y archivarlos como documentos oficiales.

#### Criterios de Aceptación

1. THE PDF_Exporter SHALL generar documentos PDF con diseño profesional que incluyan: logo de la empresa, encabezado con datos de la auditoría, tablas formateadas, gráficos renderizados y pie de página con fecha y número de página.
2. THE PDF_Exporter SHALL soportar la exportación de: reportes ejecutivos de Ana, análisis comparativos, reportes personalizados del Report_Builder y resúmenes de audit trail.
3. THE PDF_Exporter SHALL generar el PDF en el servidor para garantizar consistencia visual independiente del navegador del usuario.
4. WHEN el usuario solicita exportación a PDF, THE PDF_Exporter SHALL mostrar un indicador de progreso y permitir la descarga al completarse.
5. THE PDF_Exporter SHALL incluir un índice de contenidos navegable para reportes de más de 5 páginas.
6. THE PDF_Exporter SHALL respetar el idioma del locale activo del usuario en todos los textos del documento.

### Requisito 29: Benchmarking contra la Industria

**Historia de Usuario:** Como director financiero, quiero comparar los indicadores de nómina de mi empresa contra promedios de la industria, para que pueda evaluar nuestra competitividad salarial y eficiencia operativa.

#### Criterios de Aceptación

1. THE Benchmark_Engine SHALL mantener datos agregados y anonimizados de métricas de nómina por industria, país y tamaño de empresa.
2. THE Dashboard SHALL incluir un widget de benchmarking que compare las métricas clave de la empresa (costo promedio por empleado, ratio de aportes, score de riesgo promedio) contra el promedio de la industria.
3. THE Benchmark_Engine SHALL mostrar la posición relativa de la empresa (percentil) respecto a empresas similares en cada métrica.
4. THE Benchmark_Engine SHALL actualizar los datos de referencia trimestralmente usando datos agregados de la plataforma.
5. THE Benchmark_Engine SHALL garantizar que los datos de benchmarking sean completamente anonimizados, sin posibilidad de identificar empresas individuales.
6. THE Benchmark_Engine SHALL requerir un mínimo de 10 empresas en un segmento (industria + país + tamaño) antes de mostrar datos de benchmarking para ese segmento.

### Requisito 30: Tours Guiados Interactivos

**Historia de Usuario:** Como nuevo usuario de NominaSmart, quiero un tour guiado que me muestre las funcionalidades principales paso a paso, para que pueda empezar a usar la plataforma productivamente sin necesidad de leer documentación extensa.

#### Criterios de Aceptación

1. WHEN un usuario accede a NominaSmart por primera vez, THE Guided_Tour SHALL ofrecer iniciar un tour interactivo que cubra: dashboard, carga de nómina, chat IA, reportes y configuración.
2. THE Guided_Tour SHALL resaltar el elemento de la interfaz correspondiente a cada paso con un overlay oscuro y un tooltip explicativo con texto, imagen o animación.
3. THE Guided_Tour SHALL permitir al usuario avanzar, retroceder, saltar pasos individuales o cancelar el tour en cualquier momento.
4. WHEN el usuario completa o cancela el tour, THE Guided_Tour SHALL registrar el progreso en el perfil del usuario para no volver a mostrarlo automáticamente.
5. THE NominaSmart SHALL ofrecer tours específicos por funcionalidad: tour del pipeline de auditoría, tour del chat IA, tour de reportes y tour de administración.
6. THE Settings SHALL incluir una opción para reiniciar los tours guiados y verlos nuevamente.
7. THE Guided_Tour SHALL adaptarse al rol del usuario, mostrando solo los pasos relevantes para las funcionalidades a las que tiene acceso.

### Requisito 31: Tooltips Contextuales y Centro de Ayuda

**Historia de Usuario:** Como usuario de NominaSmart, quiero obtener ayuda contextual sobre cada funcionalidad sin salir de la pantalla actual, para que pueda resolver dudas rápidamente durante mi flujo de trabajo.

#### Criterios de Aceptación

1. THE NominaSmart SHALL mostrar tooltips contextuales (icono de interrogación) junto a campos, métricas y funcionalidades complejas que expliquen su propósito y uso.
2. THE Help_Center SHALL proporcionar un panel de ayuda accesible desde cualquier página con: búsqueda de artículos, preguntas frecuentes y enlaces a documentación detallada.
3. THE Help_Center SHALL mostrar artículos de ayuda relevantes según la página actual del usuario (ayuda contextual).
4. THE Help_Center SHALL soportar los 3 idiomas de la plataforma (es, en, pt) con contenido localizado.
5. THE Help_Center SHALL incluir enlaces a video tutoriales para los flujos principales: carga de nómina, interpretación de reportes y configuración de proveedores IA.
6. THE NominaSmart SHALL incluir un widget de feedback en cada página que permita al usuario reportar problemas o sugerir mejoras con captura automática de contexto (URL, navegador, rol).


### Requisito 32: Cobertura de Pruebas Integral

**Historia de Usuario:** Como desarrollador de NominaSmart, quiero una suite de pruebas completa que cubra todos los módulos críticos, para que pueda hacer cambios con confianza sin introducir regresiones.

#### Criterios de Aceptación

1. THE Test_Suite SHALL incluir pruebas unitarias para todos los componentes de la Component_Library verificando: renderizado correcto, manejo de props, estados interactivos y accesibilidad básica.
2. THE Test_Suite SHALL incluir pruebas unitarias para todas las funciones de utilidad: cálculos matemáticos de auditoría, funciones de mapeo, parseo de archivos, encriptación/desencriptación y formateo de datos.
3. THE Test_Suite SHALL incluir pruebas de integración para las API routes críticas: orquestación de agentes, pipeline de auditoría, CRUD de planillas, gestión de reglas y autenticación.
4. THE Test_Suite SHALL incluir pruebas basadas en propiedades (PBT) con fast-check para: round-trip de encriptación de API keys, cálculo de score de riesgo, selección de modelo por score compuesto, validación de esquemas Zod y filtrado RBAC de rutas.
5. THE Test_Suite SHALL incluir pruebas para la cadena de fallback de proveedores IA verificando que el sistema intenta proveedores en orden de prioridad y maneja fallos correctamente.
6. THE Test_Suite SHALL incluir pruebas para el sistema de webhooks verificando: firma HMAC-SHA256, reintentos con backoff y manejo de timeouts.
7. THE Test_Suite SHALL incluir pruebas para el Cache_Layer verificando: cache hit, cache miss, invalidación y degradación graceful cuando Redis no está disponible.
8. THE Test_Suite SHALL alcanzar una cobertura mínima del 80% en líneas de código para los módulos críticos: lib/ai/*, lib/audit/*, lib/sync/*, components/ui/* y API routes.

### Requisito 33: Pruebas End-to-End (E2E)

**Historia de Usuario:** Como QA de NominaSmart, quiero pruebas automatizadas que verifiquen los flujos completos de usuario, para que pueda detectar regresiones en la experiencia de usuario antes de cada release.

#### Criterios de Aceptación

1. THE E2E_Suite SHALL implementar pruebas con Playwright que cubran los flujos críticos: login, carga de planilla completa (4 pasos), visualización de reportes, gestión de action items y chat IA.
2. THE E2E_Suite SHALL verificar el flujo de RBAC: un usuario client solo puede acceder a Dashboard y Reports, un analyst no puede acceder a rutas admin.
3. THE E2E_Suite SHALL verificar el flujo de colaboración: dos usuarios editando la misma planilla ven los cambios del otro.
4. THE E2E_Suite SHALL verificar la accesibilidad básica de cada página usando axe-core integrado con Playwright.
5. THE E2E_Suite SHALL ejecutarse en CI/CD antes de cada merge a la rama principal, bloqueando el merge si alguna prueba falla.
6. THE E2E_Suite SHALL generar reportes con capturas de pantalla y videos de las pruebas fallidas para facilitar el diagnóstico.

### Requisito 34: Monitoreo y Observabilidad

**Historia de Usuario:** Como administrador de infraestructura, quiero métricas de rendimiento y salud del sistema en tiempo real, para que pueda detectar y resolver problemas antes de que afecten a los usuarios.

#### Criterios de Aceptación

1. THE NominaSmart SHALL registrar métricas de rendimiento de API: latencia por endpoint (p50, p95, p99), tasa de errores, requests por segundo y uso de rate limiting.
2. THE NominaSmart SHALL implementar health checks en el endpoint `/api/health` que verifiquen: conectividad a Supabase, disponibilidad de Redis, estado de proveedores IA activos y espacio en disco.
3. THE Admin_Dashboard SHALL mostrar un panel de observabilidad con: métricas de API en tiempo real, estado de servicios externos, uso de caché (hit rate) y cola de webhooks pendientes.
4. WHEN un servicio externo (Supabase, Redis, proveedor IA) no responde, THE Health_Monitor SHALL registrar el evento y enviar alerta a los administradores.
5. THE NominaSmart SHALL implementar structured logging (JSON) con correlation ID para trazabilidad de requests a través de todos los servicios.
6. THE NominaSmart SHALL registrar métricas de Web Vitals (LCP, FID, CLS) del frontend y enviarlas al backend para monitoreo de experiencia de usuario.

### Requisito 35: Sistema de Notificaciones Avanzado

**Historia de Usuario:** Como usuario de NominaSmart, quiero controlar qué notificaciones recibo y por qué canal, para que pueda mantenerme informado de lo importante sin ser abrumado por alertas irrelevantes.

#### Criterios de Aceptación

1. THE Notification_Preferences SHALL permitir al usuario configurar preferencias de notificación por tipo de evento y canal (in-app, email, webhook): activar/desactivar cada combinación individualmente.
2. THE Notification_Service SHALL soportar notificaciones push en navegador (Web Push API) como canal adicional a in-app y email.
3. THE Notification_Service SHALL agrupar notificaciones similares (por ejemplo, múltiples correcciones en la misma planilla) en un resumen en lugar de enviar notificaciones individuales.
4. THE Notification_Service SHALL soportar digest de notificaciones: resumen diario o semanal por email con todas las notificaciones pendientes.
5. WHEN el usuario recibe una notificación in-app, THE NotificationBell SHALL mostrar una animación sutil y actualizar el conteo sin recargar la página.
6. THE Notification_Center SHALL mostrar un panel con todas las notificaciones agrupadas por fecha, con opciones de marcar todas como leídas y filtrar por tipo.

### Requisito 36: Internacionalización Extendida

**Historia de Usuario:** Como plataforma de referencia internacional, quiero soportar más idiomas y formatos regionales, para que usuarios de cualquier país puedan usar NominaSmart en su idioma nativo con formatos familiares.

#### Criterios de Aceptación

1. THE NominaSmart SHALL extender el soporte de idiomas a 5 idiomas: Español (es), Inglés (en), Portugués (pt), Francés (fr) y Alemán (de).
2. THE NominaSmart SHALL formatear números, monedas y fechas según el locale activo del usuario usando Intl.NumberFormat e Intl.DateTimeFormat.
3. THE NominaSmart SHALL soportar formatos de moneda locales para cada país soportado: COP, MXN, PEN, CLP, BRL, ARS, USD, EUR.
4. THE NominaSmart SHALL soportar zonas horarias por workspace, mostrando todas las fechas y timestamps en la zona horaria configurada.
5. THE NominaSmart SHALL implementar un sistema de traducción con fallback en cascada: idioma del usuario → idioma del workspace → español (default).
6. THE Email_Service SHALL enviar todos los emails transaccionales en el idioma preferido del destinatario.

### Requisito 37: Integraciones ERP Extendidas

**Historia de Usuario:** Como empresa que usa SAP/Oracle para gestión de nómina, quiero importar datos directamente desde mi ERP, para que pueda auditar nóminas sin procesos manuales de exportación e importación.

#### Criterios de Aceptación

1. THE Integration_Framework SHALL extender los conectores disponibles a: Siigo, SAP SuccessFactors, Oracle HCM, Workday, ADP y Generic REST API.
2. WHEN el usuario configura una integración ERP, THE Settings_Integrations SHALL guiar al usuario paso a paso: selección de conector, configuración de credenciales, mapeo de campos y prueba de conexión.
3. THE Integration_Framework SHALL soportar importación programada (scheduled sync) de datos de nómina desde el ERP configurado.
4. THE Integration_Framework SHALL mantener un log de sincronizaciones con: fecha, registros importados, errores encontrados y duración.
5. IF una importación desde ERP falla, THEN THE Integration_Framework SHALL preservar los datos parcialmente importados y permitir reintentar desde el punto de fallo.
6. THE Integration_Framework SHALL soportar exportación de resultados de auditoría de vuelta al ERP cuando el conector lo permita.
7. THE NominaSmart SHALL proporcionar documentación detallada para crear conectores personalizados usando la interfaz `IntegrationConnector`.

### Requisito 38: Gestión de API Keys para Acceso Programático

**Historia de Usuario:** Como desarrollador que integra NominaSmart con sistemas internos, quiero gestionar API keys para acceso programático, para que pueda automatizar flujos de auditoría sin depender de sesiones de usuario interactivas.

#### Criterios de Aceptación

1. THE Settings_API_Keys SHALL permitir a usuarios con rol admin o analyst crear API keys con nombre descriptivo, permisos específicos (lectura, escritura, admin) y fecha de expiración opcional.
2. WHEN se crea una API key, THE NominaSmart SHALL mostrar la key completa una única vez y almacenar solo el hash SHA-256 en la base de datos.
3. THE API_Guard SHALL aceptar autenticación mediante API key en el header `Authorization: Bearer <api_key>` como alternativa a la autenticación por sesión.
4. THE Settings_API_Keys SHALL mostrar la lista de API keys activas con: nombre, permisos, fecha de creación, última fecha de uso y opción de revocar.
5. WHEN un administrador revoca una API key, THE NominaSmart SHALL invalidar inmediatamente todas las solicitudes que usen esa key.
6. THE Rate_Limiter SHALL aplicar límites específicos para solicitudes autenticadas con API key, independientes de los límites por sesión de usuario.
7. THE Audit_Trail SHALL registrar todas las operaciones realizadas con API keys incluyendo la key utilizada (últimos 4 caracteres) para trazabilidad.

### Requisito 39: Recomendaciones Inteligentes de IA

**Historia de Usuario:** Como analista de nómina, quiero que el sistema me sugiera proactivamente acciones basadas en los patrones detectados, para que pueda ser más eficiente y no pasar por alto problemas recurrentes.

#### Criterios de Aceptación

1. WHEN el usuario accede al Dashboard, THE Recommendation_Engine SHALL mostrar hasta 5 recomendaciones priorizadas basadas en: hallazgos recurrentes no resueltos, anomalías detectadas, reglas normativas próximas a cambiar y optimizaciones de configuración.
2. THE Recommendation_Engine SHALL categorizar las recomendaciones en: acción urgente (hallazgos críticos no resueltos), optimización (mejoras de configuración), informativa (cambios regulatorios próximos) y preventiva (patrones de riesgo detectados).
3. WHEN el usuario descarta una recomendación, THE Recommendation_Engine SHALL registrar la acción y no volver a mostrar la misma recomendación por 30 días.
4. THE Recommendation_Engine SHALL aprender de las acciones del usuario: si el usuario consistentemente acepta recomendaciones de un tipo, priorizar ese tipo en el futuro.
5. THE Recommendation_Engine SHALL generar explicaciones claras para cada recomendación: qué se detectó, por qué es importante y qué acción se sugiere.
6. THE Sidebar_IA SHALL integrar las recomendaciones como sugerencias contextuales durante las conversaciones con Dianis.

### Requisito 40: Modo Offline y Sincronización

**Historia de Usuario:** Como auditor que trabaja en campo sin conexión estable a internet, quiero poder revisar reportes y datos previamente cargados sin conexión, para que pueda continuar mi trabajo sin interrupciones.

#### Criterios de Aceptación

1. THE PWA SHALL cachear los datos del dashboard, reportes recientes y configuración del usuario para acceso offline usando Service Worker y Cache API.
2. WHILE el dispositivo está offline, THE NominaSmart SHALL mostrar un banner indicando el modo offline y la fecha de la última sincronización.
3. WHILE el dispositivo está offline, THE NominaSmart SHALL permitir visualizar reportes y datos previamente cacheados en modo solo lectura.
4. WHEN el dispositivo recupera la conexión, THE NominaSmart SHALL sincronizar automáticamente cualquier dato pendiente y actualizar la caché.
5. THE NominaSmart SHALL mostrar claramente qué funcionalidades están disponibles offline (visualización de reportes, dashboard) y cuáles requieren conexión (carga de planillas, chat IA, operaciones de escritura).
