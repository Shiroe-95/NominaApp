# Documento de Requisitos: NóminaSmart Refactor

## Introducción

Refactorización mayor de la aplicación NóminaSmart para transformarla en una plataforma premium de conciliación de nómina. El alcance cubre tres ejes: (1) soporte multi-proveedor de IA con gestión de API keys, (2) rediseño completo de la interfaz para lograr una experiencia ultra premium, intuitiva y moderna, y (3) implementación de una arquitectura de agentes de IA especializados orquestados por un agente maestro.

## Glosario

- **Sistema_NóminaSmart**: La aplicación web de conciliación de nómina construida con Next.js 16, React 19 y Supabase.
- **Registro_Proveedor**: Configuración almacenada de un proveedor de IA que incluye nombre, API key, modelo seleccionado y estado activo/inactivo.
- **Agente_Maestro**: Componente orquestador central que recibe solicitudes del usuario, descompone tareas y delega a agentes especializados.
- **Agente_Auditor**: Agente especializado en validación matemática y normativa de registros de nómina colombiana (Ley 1393, UGPP, IBC).
- **Agente_Redactor**: Agente especializado en generar reportes narrativos, resúmenes ejecutivos y documentos de hallazgos.
- **Agente_Corrector**: Agente especializado en proponer correcciones numéricas precisas basadas en fórmulas normativas.
- **Agente_Mapeador**: Agente especializado en mapear columnas de archivos Excel subidos a campos estándar del sistema.
- **Agente_Nómina**: Agente especializado en consultas de normativa laboral colombiana, cálculos de nómina, interpretación de conceptos (IBC, UGPP, prestaciones, Ley 1393) y asistencia contextual al usuario.
- **Panel_Proveedores**: Interfaz de usuario dentro de Configuración para gestionar proveedores de IA y sus API keys.
- **Página_Pública**: Páginas de marketing accesibles sin autenticación destinadas a convencer empresas de contratar el servicio de NóminaSmart.
- **Landing_Page**: Página principal pública con propuesta de valor, beneficios, testimonios y llamada a la acción.
- **Proveedor_IA**: Servicio externo de modelos de lenguaje (OpenAI, Anthropic, Groq, OpenRouter, Google, etc.) accesible mediante el Vercel AI SDK.
- **Pipeline_Nómina**: Flujo completo de procesamiento: Carga → Mapeo → Validación → Análisis IA → Corrección → Certificación.
- **Tema_Visual**: Conjunto de tokens de diseño (colores, tipografía, espaciado, sombras) que definen la apariencia premium de la interfaz.
- **Agente_Investigador**: Agente especializado en investigar tasas, porcentajes, cálculos y normativa laboral vigente para cada país y año, usando fuentes oficiales de internet.
- **Agente_Corrector_Aplicador**: Extensión del Agente_Corrector que además de proponer correcciones puede aplicarlas directamente a los datos de nómina cuando el usuario lo aprueba.
- **Panel_Financiero**: Interfaz de administración que muestra ingresos, costos (tokens IA + infraestructura), rentabilidad y métricas financieras del negocio.
- **Panel_Usuarios**: Interfaz de administración para crear, editar, eliminar usuarios y asignar roles y empresas.
- **Bus_Agentes**: Canal de comunicación inter-agente que permite a los agentes especializados solicitar ayuda de otros agentes durante su ejecución.
- **Locale_Config**: Configuración de idioma y moneda asociada a un país, incluyendo código de moneda, formato numérico y traducciones de la interfaz.

## Requisitos

### Requisito 1: Registro y Gestión de Proveedores de IA

**Historia de Usuario:** Como administrador del sistema, quiero configurar múltiples proveedores de IA con sus API keys, para poder elegir qué modelo usar en cada tarea y tener respaldo ante fallos.

#### Criterios de Aceptación

1. WHEN un administrador accede al Panel_Proveedores, THE Sistema_NóminaSmart SHALL mostrar la lista de Registro_Proveedor configurados con su estado activo/inactivo y modelo seleccionado.
2. WHEN un administrador agrega un nuevo Registro_Proveedor proporcionando nombre, API key y modelo, THE Sistema_NóminaSmart SHALL almacenar la configuración de forma cifrada en la base de datos y validar la conectividad con el Proveedor_IA.
3. WHEN un administrador modifica un Registro_Proveedor existente, THE Sistema_NóminaSmart SHALL actualizar la configuración y re-validar la conectividad.
4. WHEN un administrador elimina un Registro_Proveedor, THE Sistema_NóminaSmart SHALL remover la configuración y reasignar las tareas que usaban ese proveedor al proveedor por defecto.
5. WHEN la validación de conectividad de un Registro_Proveedor falla, THE Sistema_NóminaSmart SHALL mostrar un mensaje de error descriptivo indicando la causa del fallo.
6. IF un Registro_Proveedor tiene una API key inválida o expirada, THEN THE Sistema_NóminaSmart SHALL marcar el proveedor como inactivo y notificar al administrador.

### Requisito 2: Selección Dinámica de Proveedor y Fallback

**Historia de Usuario:** Como administrador del sistema, quiero definir el orden de prioridad de los proveedores de IA, para que el sistema use automáticamente el siguiente proveedor disponible si el principal falla.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL permitir al administrador ordenar los Registro_Proveedor por prioridad mediante arrastrar y soltar en el Panel_Proveedores.
2. WHEN el Proveedor_IA principal falla al procesar una solicitud, THE Sistema_NóminaSmart SHALL intentar automáticamente con el siguiente Proveedor_IA activo en la cadena de prioridad.
3. WHEN todos los Proveedor_IA activos fallan, THE Sistema_NóminaSmart SHALL mostrar un mensaje indicando que el servicio de IA no está disponible temporalmente.
4. WHEN un Proveedor_IA responde exitosamente después de un fallback, THE Sistema_NóminaSmart SHALL registrar en el log qué proveedor fue utilizado y el motivo del fallback.

### Requisito 3: Proveedores Soportados vía Vercel AI SDK

**Historia de Usuario:** Como administrador del sistema, quiero poder conectar proveedores de IA populares del ecosistema Vercel AI SDK, para tener flexibilidad en la elección de modelos.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL soportar los siguientes Proveedor_IA a través del Vercel AI SDK: OpenAI, Anthropic, Groq, Google Generative AI y OpenRouter.
2. WHEN un administrador selecciona un Proveedor_IA, THE Sistema_NóminaSmart SHALL mostrar la lista de modelos disponibles para ese proveedor.
3. WHEN un administrador configura OpenRouter como Proveedor_IA, THE Sistema_NóminaSmart SHALL permitir especificar cualquier modelo disponible en el catálogo de OpenRouter.

### Requisito 4: Arquitectura de Agentes Especializados

**Historia de Usuario:** Como usuario del sistema, quiero que las tareas de análisis de nómina sean ejecutadas por agentes de IA especializados coordinados por un orquestador, para obtener resultados más precisos y trazables.

#### Criterios de Aceptación

1. THE Agente_Maestro SHALL recibir solicitudes del usuario, descomponer la tarea en sub-tareas y delegarlas a los agentes especializados correspondientes (Agente_Auditor, Agente_Redactor, Agente_Corrector, Agente_Mapeador).
2. WHEN el Agente_Maestro delega una sub-tarea a un agente especializado, THE Agente_Maestro SHALL proporcionar el contexto necesario incluyendo datos de nómina, reglas normativas aplicables y resultados de agentes previos.
3. WHEN un agente especializado completa su sub-tarea, THE Agente_Maestro SHALL recopilar el resultado y decidir si se requieren sub-tareas adicionales o si la tarea global está completa.
4. WHEN el Agente_Maestro completa la orquestación de una tarea, THE Sistema_NóminaSmart SHALL presentar al usuario un resultado consolidado con las contribuciones de cada agente identificadas.

### Requisito 5: Agente Auditor

**Historia de Usuario:** Como auditor de nómina, quiero que un agente especializado valide los registros de nómina contra las reglas normativas colombianas, para detectar inconsistencias matemáticas y de cumplimiento.

#### Criterios de Aceptación

1. WHEN el Agente_Auditor recibe registros de nómina y reglas normativas, THE Agente_Auditor SHALL validar cada registro contra las 14 verificaciones matemáticas del motor de reglas (IBC Ley 1393, aportes salud 4%, aportes pensión 4%, cesantías 8.33%, prima 8.33%, vacaciones 4.17%, salud empleador 8.5%, pensión empleador 12%, parafiscales 9%, ARL, auxilio transporte, tope 40%, IBC mínimo/máximo, consistencia subsistemas).
2. WHEN el Agente_Auditor detecta una inconsistencia, THE Agente_Auditor SHALL generar un hallazgo estructurado con documento del empleado, descripción del problema, severidad (alta, media, baja), norma aplicable y valores esperados vs reportados.
3. WHEN el Agente_Auditor completa la validación de un lote, THE Agente_Auditor SHALL retornar un resumen con conteo de hallazgos por severidad y categoría.

### Requisito 6: Agente Redactor

**Historia de Usuario:** Como gerente de recursos humanos, quiero que un agente especializado genere reportes narrativos claros sobre los hallazgos de auditoría, para comunicar los resultados a las partes interesadas.

#### Criterios de Aceptación

1. WHEN el Agente_Redactor recibe hallazgos del Agente_Auditor, THE Agente_Redactor SHALL generar un reporte ejecutivo con resumen, nivel de riesgo global, análisis narrativo y recomendaciones priorizadas.
2. WHEN el Agente_Redactor genera un reporte, THE Agente_Redactor SHALL agrupar los hallazgos por categoría (IBC, Prestaciones, Seguridad Social, Parafiscales, Datos) y priorizar por severidad.
3. WHEN el Agente_Redactor genera un reporte, THE Agente_Redactor SHALL incluir referencias específicas a las normas aplicables (Ley 1393, Art. 249 CST, UGPP) para cada hallazgo.

### Requisito 7: Agente Corrector

**Historia de Usuario:** Como analista de nómina, quiero que un agente especializado proponga correcciones numéricas precisas para los errores detectados, para agilizar el proceso de corrección.

#### Criterios de Aceptación

1. WHEN el Agente_Corrector recibe hallazgos y registros originales, THE Agente_Corrector SHALL calcular el valor correcto para cada campo con error usando las fórmulas normativas colombianas vigentes.
2. WHEN el Agente_Corrector propone una corrección, THE Agente_Corrector SHALL incluir el índice de fila, campo afectado, valor actual, valor sugerido y justificación con la fórmula aplicada.
3. WHEN el Agente_Corrector no puede determinar un valor correcto con certeza matemática, THE Agente_Corrector SHALL omitir la sugerencia para ese campo en lugar de proponer un valor especulativo.

### Requisito 8: Agente Mapeador

**Historia de Usuario:** Como usuario del sistema, quiero que un agente especializado mapee automáticamente las columnas de mis archivos Excel a los campos estándar del sistema, para reducir el trabajo manual de configuración.

#### Criterios de Aceptación

1. WHEN el Agente_Mapeador recibe las columnas de un archivo subido, THE Agente_Mapeador SHALL generar un mapeo de cada columna origen a un campo destino estándar usando el diccionario de sinónimos de nómina colombiana.
2. WHEN el Agente_Mapeador genera un mapeo, THE Agente_Mapeador SHALL clasificar cada relación con su categoría de análisis (identity, salary_base, non_salary, ibc, contribution, contract, informational).
3. WHEN el Agente_Mapeador no encuentra un campo destino estándar para una columna, THE Agente_Mapeador SHALL crear un campo nuevo en formato snake_case y clasificarlo como informational.

### Requisito 9: Agente de Nómina

**Historia de Usuario:** Como usuario del sistema, quiero que un agente especializado en nómina colombiana me asista con consultas sobre normativa laboral, cálculos y conceptos, para resolver dudas sin salir de la plataforma.

#### Criterios de Aceptación

1. WHEN el usuario hace una consulta sobre normativa laboral colombiana (Ley 1393, UGPP, CST, PILA), THE Agente_Nómina SHALL responder con explicaciones claras, referencias legales y ejemplos numéricos cuando aplique.
2. WHEN el usuario solicita un cálculo de nómina (IBC, prestaciones, aportes, liquidación), THE Agente_Nómina SHALL realizar el cálculo paso a paso mostrando las fórmulas y valores intermedios.
3. WHEN el Agente_Nómina tiene acceso al contexto de la nómina cargada, THE Agente_Nómina SHALL personalizar sus respuestas usando los datos reales del archivo procesado.
4. WHEN el usuario solicita gestionar reglas normativas (listar, crear, actualizar, eliminar), THE Agente_Nómina SHALL ejecutar las operaciones directamente en la base de datos usando las herramientas disponibles.

### Requisito 10: Páginas Públicas de Marketing

**Historia de Usuario:** Como visitante del sitio web, quiero ver páginas públicas atractivas que expliquen los beneficios de NóminaSmart, para evaluar si el servicio es adecuado para mi empresa.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL incluir una Landing_Page pública con propuesta de valor, beneficios clave, sección de funcionalidades, testimonios y llamada a la acción para registro.
2. THE Sistema_NóminaSmart SHALL incluir una Página_Pública de precios con planes disponibles, comparativa de funcionalidades por plan y botón de contratación.
3. THE Sistema_NóminaSmart SHALL incluir una Página_Pública de contacto con formulario de solicitud de demostración.
4. WHEN un visitante accede a las Página_Pública, THE Sistema_NóminaSmart SHALL mostrar las páginas sin requerir autenticación y con diseño premium consistente con la aplicación interna.
5. WHEN un visitante hace clic en el botón de registro o contratación, THE Sistema_NóminaSmart SHALL redirigir al flujo de registro/login de la aplicación.

### Requisito 11: Rediseño de Interfaz Premium

**Historia de Usuario:** Como usuario del sistema, quiero una interfaz moderna, limpia y premium, para tener una experiencia de uso intuitiva y profesional.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL implementar un Tema_Visual premium con paleta de colores refinada, tipografía moderna, espaciado consistente y micro-animaciones sutiles.
2. THE Sistema_NóminaSmart SHALL implementar un sistema de componentes UI consistente basado en tokens de diseño reutilizables (colores, sombras, bordes, espaciado).
3. WHEN el usuario navega entre páginas, THE Sistema_NóminaSmart SHALL proporcionar transiciones suaves y feedback visual inmediato de carga.
4. THE Sistema_NóminaSmart SHALL ser completamente responsivo, adaptándose a pantallas de escritorio, tablet y móvil.

### Requisito 12: Experiencia Guiada Paso a Paso

**Historia de Usuario:** Como usuario nuevo del sistema, quiero que cada proceso me guíe paso a paso con instrucciones claras, para completar las tareas sin confusión ni necesidad de capacitación previa.

#### Criterios de Aceptación

1. WHEN el usuario inicia cualquier flujo del Pipeline_Nómina, THE Sistema_NóminaSmart SHALL mostrar un stepper visual con las etapas numeradas, la etapa actual resaltada y las etapas completadas marcadas.
2. WHEN el usuario está en una etapa del flujo, THE Sistema_NóminaSmart SHALL mostrar instrucciones contextuales claras sobre qué hacer, qué datos se necesitan y qué resultado esperar.
3. WHEN el usuario completa una etapa, THE Sistema_NóminaSmart SHALL mostrar un resumen de lo realizado y avanzar automáticamente a la siguiente etapa con animación de transición.
4. WHEN el usuario comete un error en una etapa, THE Sistema_NóminaSmart SHALL mostrar mensajes de error descriptivos con sugerencias de corrección en lenguaje sencillo.
5. IF el usuario intenta avanzar a una etapa sin completar los requisitos previos, THEN THE Sistema_NóminaSmart SHALL bloquear el avance y mostrar qué falta por completar.

### Requisito 13: Rediseño del Dashboard

**Historia de Usuario:** Como usuario del sistema, quiero un dashboard que muestre métricas clave de forma clara y visualmente atractiva, para entender rápidamente el estado de las nóminas.

#### Criterios de Aceptación

1. WHEN el usuario accede al dashboard, THE Sistema_NóminaSmart SHALL mostrar tarjetas de métricas con indicadores de tendencia, gráficos interactivos de distribución de riesgo y estado de certificación.
2. WHEN el usuario interactúa con un gráfico del dashboard, THE Sistema_NóminaSmart SHALL mostrar tooltips con datos detallados y permitir filtrado por período y empresa.
3. WHEN hay datos de auditoría disponibles, THE Sistema_NóminaSmart SHALL mostrar un resumen de hallazgos recientes con indicadores de severidad codificados por color.

### Requisito 14: Rediseño del Chat de IA

**Historia de Usuario:** Como usuario del sistema, quiero un panel de chat de IA mejorado que muestre qué agente está trabajando y el progreso de las tareas, para entender qué está haciendo el sistema.

#### Criterios de Aceptación

1. WHEN el usuario envía un mensaje al chat de IA, THE Sistema_NóminaSmart SHALL mostrar qué agente especializado está procesando la solicitud con un indicador visual distintivo.
2. WHEN el Agente_Maestro delega tareas a agentes especializados, THE Sistema_NóminaSmart SHALL mostrar el progreso de cada sub-tarea en tiempo real dentro del panel de chat.
3. WHEN un agente completa una sub-tarea, THE Sistema_NóminaSmart SHALL mostrar un chip de acción con el resultado (éxito/error) y un resumen de lo realizado.
4. WHEN el usuario abre el panel de chat, THE Sistema_NóminaSmart SHALL mostrar el historial de conversaciones previas con la posibilidad de iniciar una nueva conversación.

### Requisito 15: Rediseño del Flujo de Carga y Procesamiento

**Historia de Usuario:** Como usuario del sistema, quiero un flujo de carga de archivos simplificado y visualmente guiado, para procesar nóminas de forma rápida y sin confusión.

#### Criterios de Aceptación

1. WHEN el usuario inicia el flujo de carga, THE Sistema_NóminaSmart SHALL mostrar un stepper visual con las etapas del Pipeline_Nómina (Carga, Mapeo, Validación, Análisis, Corrección, Certificación).
2. WHEN el usuario arrastra un archivo al área de carga, THE Sistema_NóminaSmart SHALL mostrar feedback visual inmediato de aceptación o rechazo con animación.
3. WHEN el sistema procesa un archivo, THE Sistema_NóminaSmart SHALL mostrar una barra de progreso con porcentaje y etapa actual del procesamiento.
4. WHEN el procesamiento completa una etapa, THE Sistema_NóminaSmart SHALL avanzar automáticamente el stepper y mostrar un resumen de la etapa completada.

### Requisito 16: Serialización de Configuración de Proveedores

**Historia de Usuario:** Como desarrollador del sistema, quiero que la configuración de proveedores se serialice y deserialice correctamente, para garantizar la integridad de los datos almacenados.

#### Criterios de Aceptación

1. WHEN el Sistema_NóminaSmart almacena un Registro_Proveedor en la base de datos, THE Sistema_NóminaSmart SHALL serializar la configuración a formato JSON.
2. WHEN el Sistema_NóminaSmart lee un Registro_Proveedor de la base de datos, THE Sistema_NóminaSmart SHALL deserializar el JSON y reconstruir el objeto de configuración completo.
3. FOR ALL Registro_Proveedor válidos, serializar y luego deserializar SHALL producir un objeto equivalente al original (propiedad de ida y vuelta).

### Requisito 17: Trazabilidad de Uso de IA

**Historia de Usuario:** Como administrador del sistema, quiero ver un registro de las llamadas realizadas a cada proveedor de IA, para monitorear el uso y los costos.

#### Criterios de Aceptación

1. WHEN el Sistema_NóminaSmart realiza una llamada a un Proveedor_IA, THE Sistema_NóminaSmart SHALL registrar el proveedor utilizado, modelo, tokens consumidos, latencia y resultado (éxito/error).
2. WHEN un administrador accede al Panel_Proveedores, THE Sistema_NóminaSmart SHALL mostrar estadísticas de uso por proveedor incluyendo total de llamadas, tokens consumidos y tasa de error.
3. WHEN ocurre un fallback entre proveedores, THE Sistema_NóminaSmart SHALL registrar el evento con el proveedor original, el proveedor de respaldo y la razón del fallback.


### Requisito 18: Soporte Multi-Idioma (i18n)

**Historia de Usuario:** Como usuario internacional, quiero usar la plataforma en mi idioma nativo, para entender todas las funcionalidades sin barreras lingüísticas.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL soportar múltiples idiomas usando next-intl, con archivos de mensajes en `messages/{locale}.json` para cada idioma soportado (mínimo: español, inglés, portugués).
2. WHEN un usuario selecciona un idioma en la interfaz, THE Sistema_NóminaSmart SHALL cambiar todos los textos de la UI al idioma seleccionado sin recargar la página completa.
3. WHEN se agrega un nuevo idioma al sistema, THE Sistema_NóminaSmart SHALL cargar dinámicamente el archivo de mensajes correspondiente sin requerir cambios en el código fuente.
4. THE Sistema_NóminaSmart SHALL almacenar la preferencia de idioma del usuario en su perfil y restaurarla en sesiones posteriores.
5. WHEN el Agente_Redactor genera reportes, THE Sistema_NóminaSmart SHALL generar el contenido narrativo en el idioma configurado por el usuario.

### Requisito 19: Soporte Multi-Moneda

**Historia de Usuario:** Como usuario que gestiona nóminas en diferentes países, quiero que el sistema maneje las monedas locales correctamente, para ver los valores en la moneda correspondiente a cada país.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL asociar un código de moneda ISO 4217 (COP, MXN, USD, PEN, CLP, BRL, ARS, etc.) a cada país configurado en el sistema.
2. WHEN el sistema muestra valores monetarios, THE Sistema_NóminaSmart SHALL formatear los números según la Locale_Config del país (separadores de miles, decimales, símbolo de moneda).
3. WHEN se almacenan datos de nómina, THE Sistema_NóminaSmart SHALL registrar el código de moneda junto con cada valor monetario.
4. WHEN el Panel_Financiero muestra métricas de múltiples países, THE Sistema_NóminaSmart SHALL mostrar los valores en la moneda original y opcionalmente convertidos a una moneda base configurable (USD por defecto).

### Requisito 20: Soporte Multi-País para Nómina

**Historia de Usuario:** Como empresa multinacional, quiero que la plataforma procese nóminas de cualquier país, para centralizar la auditoría de nómina de todas mis operaciones.

#### Criterios de Aceptación

1. THE Sistema_NóminaSmart SHALL mantener un catálogo de reglas normativas por país y año en la tabla `country_year_rules`, extensible a cualquier país.
2. WHEN se carga un archivo de nómina, THE Sistema_NóminaSmart SHALL solicitar al usuario el país y año correspondientes para aplicar las reglas normativas correctas.
3. WHEN el Agente_Auditor valida registros de nómina, THE Agente_Auditor SHALL aplicar las verificaciones matemáticas específicas del país y año seleccionados, no solo las colombianas.
4. WHEN no existen reglas normativas para un país/año solicitado, THE Sistema_NóminaSmart SHALL notificar al usuario y ofrecer activar al Agente_Investigador para investigar y crear las reglas.
5. THE Sistema_NóminaSmart SHALL permitir al administrador configurar nuevos países con sus respectivas reglas, moneda, formato de nómina y normativa aplicable.

### Requisito 21: Manejo Universal de Archivos de Nómina

**Historia de Usuario:** Como usuario, quiero que el sistema acepte archivos de nómina de cualquier formato y país, para no tener que adaptar mis archivos al formato del sistema.

#### Criterios de Aceptación

1. WHEN el usuario carga un archivo de nómina (Excel, CSV, TSV), THE Agente_Mapeador SHALL analizar las columnas independientemente de los nombres, idioma o convenciones del país de origen.
2. WHEN el Agente_Mapeador encuentra columnas en un idioma diferente al español, THE Agente_Mapeador SHALL usar IA para identificar el campo estándar equivalente basándose en el contexto y los datos de la columna.
3. WHEN el archivo contiene formatos numéricos o de fecha específicos de un país, THE Sistema_NóminaSmart SHALL detectar y parsear correctamente los formatos según la Locale_Config del país seleccionado.
4. IF el Agente_Mapeador no puede determinar el mapeo de una columna con confianza suficiente, THEN THE Agente_Mapeador SHALL solicitar confirmación al usuario presentando las opciones más probables.

### Requisito 22: Agente Investigador Regulatorio

**Historia de Usuario:** Como administrador del sistema, quiero que un agente especializado investigue y mantenga actualizadas las tasas, porcentajes y reglas normativas de cada país, para que la plataforma siempre aplique la normativa vigente.

#### Criterios de Aceptación

1. WHEN el administrador solicita investigar la normativa de un país y año, THE Agente_Investigador SHALL buscar en fuentes oficiales de internet (sitios gubernamentales, gacetas oficiales, entidades reguladoras) las tasas, porcentajes y reglas de cálculo de nómina vigentes.
2. WHEN el Agente_Investigador completa una investigación, THE Agente_Investigador SHALL crear o actualizar las reglas en la tabla `country_year_rules` con las tasas encontradas, incluyendo las fuentes consultadas y fecha de última verificación.
3. WHEN el Agente_Investigador detecta cambios en la normativa de un país ya configurado, THE Agente_Investigador SHALL generar una alerta al administrador con un resumen de los cambios detectados y las fuentes.
4. THE Agente_Investigador SHALL almacenar las URLs de las fuentes oficiales consultadas como referencia para auditoría y verificación manual.
5. IF el Agente_Investigador no encuentra información confiable para un país/año, THEN THE Agente_Investigador SHALL reportar la falta de información y sugerir fuentes alternativas al administrador.

### Requisito 23: Panel Financiero de Administración

**Historia de Usuario:** Como administrador del negocio, quiero ver un panel financiero con ingresos, costos y rentabilidad, para tomar decisiones informadas sobre precios y operación.

#### Criterios de Aceptación

1. WHEN un administrador accede al Panel_Financiero, THE Sistema_NóminaSmart SHALL mostrar un dashboard con: tokens consumidos por usuario, por agente y por proveedor de IA en el período seleccionado.
2. WHEN un administrador consulta costos, THE Sistema_NóminaSmart SHALL calcular el costo estimado de tokens consumidos basándose en las tarifas configuradas por proveedor/modelo.
3. THE Sistema_NóminaSmart SHALL permitir al administrador configurar los precios de venta de cada tipo de tarea (auditoría, mapeo, corrección, reporte, consulta) para calcular ingresos.
4. WHEN un administrador consulta rentabilidad, THE Sistema_NóminaSmart SHALL mostrar: ingresos por tareas ejecutadas, costos de tokens IA, costos de infraestructura configurados, y margen de ganancia resultante.
5. THE Sistema_NóminaSmart SHALL mostrar el costo promedio por nómina procesada, desglosado por tipo de agente y proveedor utilizado.

### Requisito 24: Gestión de Usuarios por Administrador

**Historia de Usuario:** Como administrador del sistema, quiero crear y gestionar usuarios con diferentes roles, para controlar el acceso y asignar permisos según las responsabilidades de cada persona.

#### Criterios de Aceptación

1. WHEN un administrador accede al Panel_Usuarios, THE Sistema_NóminaSmart SHALL mostrar la lista de usuarios con su rol, empresa asignada, estado activo/inactivo y última actividad.
2. WHEN un administrador crea un nuevo usuario proporcionando email, nombre, rol y empresa, THE Sistema_NóminaSmart SHALL crear la cuenta en Supabase Auth y el perfil en `user_profiles` con el rol asignado.
3. WHEN un administrador modifica el rol de un usuario, THE Sistema_NóminaSmart SHALL actualizar el perfil y ajustar los permisos de acceso inmediatamente.
4. WHEN un administrador desactiva un usuario, THE Sistema_NóminaSmart SHALL revocar el acceso del usuario sin eliminar sus datos históricos.
5. THE Sistema_NóminaSmart SHALL permitir al administrador filtrar usuarios por rol, empresa y estado, y ver estadísticas de uso por usuario.

### Requisito 25: Comunicación Inter-Agente

**Historia de Usuario:** Como usuario del sistema, quiero que los agentes de IA colaboren entre sí para resolver problemas complejos, para obtener resultados más completos y precisos.

#### Criterios de Aceptación

1. WHEN un agente especializado necesita información o análisis de otro agente durante su ejecución, THE agente SHALL enviar una solicitud al Bus_Agentes especificando el agente destino, el tipo de consulta y los datos necesarios.
2. WHEN el Bus_Agentes recibe una solicitud inter-agente, THE Bus_Agentes SHALL enrutar la solicitud al agente destino, ejecutarla y retornar el resultado al agente solicitante.
3. WHEN ocurre comunicación inter-agente, THE Sistema_NóminaSmart SHALL registrar cada intercambio en el log de uso incluyendo agentes involucrados, tokens consumidos y latencia.
4. THE Agente_Maestro SHALL mantener visibilidad de todas las comunicaciones inter-agente y poder intervenir si detecta ciclos o solicitudes redundantes.
5. WHEN el panel de chat muestra el progreso de una tarea, THE Sistema_NóminaSmart SHALL visualizar las comunicaciones inter-agente como sub-pasos dentro del flujo de trabajo.

### Requisito 26: Agente Corrector con Aplicación de Correcciones

**Historia de Usuario:** Como analista de nómina, quiero que el agente corrector pueda aplicar las correcciones directamente a los datos cuando yo lo apruebe, para agilizar el proceso sin tener que hacer cambios manuales.

#### Criterios de Aceptación

1. WHEN el Agente_Corrector_Aplicador presenta correcciones al usuario, THE Sistema_NóminaSmart SHALL mostrar cada corrección con opción de aprobar o rechazar individualmente.
2. WHEN el usuario aprueba una corrección, THE Agente_Corrector_Aplicador SHALL aplicar el cambio directamente en los datos de nómina almacenados y registrar la acción con timestamp, usuario aprobador y valores antes/después.
3. WHEN el usuario aprueba múltiples correcciones en lote, THE Agente_Corrector_Aplicador SHALL aplicar todas las correcciones aprobadas de forma atómica (todas o ninguna).
4. WHEN una corrección es aplicada, THE Sistema_NóminaSmart SHALL re-ejecutar las validaciones afectadas para confirmar que la corrección resuelve el hallazgo original.
5. IF la aplicación de una corrección genera nuevos hallazgos, THEN THE Sistema_NóminaSmart SHALL notificar al usuario de los efectos secundarios antes de confirmar.
