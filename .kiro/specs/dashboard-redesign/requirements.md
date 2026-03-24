# Documento de Requisitos: Rediseño del Dashboard

## Introducción

Rediseño del dashboard principal de NominaSmart para resolver cuatro problemas críticos de usabilidad: (1) la configuración de API keys de IA no es descubrible desde el dashboard, (2) el flujo de procesamiento de nómina (carga → mapeo → validación → corrección) no está claramente visualizado, (3) no existe una vista persistente de logs en tiempo real durante la orquestación de agentes IA, y (4) no hay una vista dedicada para síntesis/resúmenes generados por IA en tiempo real. El rediseño mantiene el sistema de diseño Obsidian Ledger existente y reutiliza componentes ya construidos.

## Glosario

- **Dashboard**: Página principal del sistema en `/[locale]/dashboard`, punto de entrada tras autenticación.
- **Panel_de_Proveedores_IA**: Widget embebido en el dashboard que muestra el estado de configuración de proveedores de IA y permite acceso rápido a la configuración completa en `/settings/providers`.
- **Flujo_de_Proceso**: Visualización del pipeline de 4 pasos (carga → mapeo → validación → corrección) que guía al usuario a través del análisis de nómina.
- **Panel_de_Logs**: Componente persistente en el dashboard que muestra eventos SSE de los agentes IA en tiempo real, con historial que sobrevive al cierre del sidebar de chat.
- **Panel_de_Síntesis**: Componente del dashboard que muestra resúmenes y reportes generados por IA en tiempo real conforme los agentes completan su trabajo.
- **Agente_IA**: Uno de los 6 agentes especializados del sistema multi-agente (auditor, mapper, corrector, writer, payroll-expert, researcher).
- **SSE**: Server-Sent Events, protocolo de streaming usado para comunicación en tiempo real entre el servidor de orquestación y el frontend.
- **Obsidian_Ledger**: Sistema de diseño premium de NominaSmart definido en `design-tokens.ts` con colores, tipografía, espaciado y elevación.
- **DashboardClient**: Componente cliente principal del dashboard que renderiza métricas, filtros y gráficos.
- **AiSidebar**: Panel lateral de chat con IA multi-agente que conecta con el endpoint de orquestación usando SSE streaming.
- **PipelineStreamEmitter**: Clase que emite eventos SSE durante la ejecución del pipeline de agentes.

## Requisitos

### Requisito 1: Acceso rápido a configuración de proveedores IA

**Historia de Usuario:** Como usuario del dashboard, quiero ver el estado de mis proveedores de IA y acceder rápidamente a su configuración, para no tener que buscar la página de settings enterrada en la navegación.

#### Criterios de Aceptación

1. CUANDO el Dashboard se carga, EL Panel_de_Proveedores_IA DEBERÁ mostrar un resumen con la cantidad de proveedores configurados y cuántos están activos.
2. CUANDO no hay proveedores configurados, EL Panel_de_Proveedores_IA DEBERÁ mostrar un estado vacío con un call-to-action prominente para configurar el primer proveedor.
3. CUANDO el usuario hace clic en el call-to-action del Panel_de_Proveedores_IA, EL Dashboard DEBERÁ navegar a la página `/settings/providers`.
4. CUANDO hay proveedores configurados, EL Panel_de_Proveedores_IA DEBERÁ mostrar el nombre, tipo y estado (activo/inactivo) de cada proveedor con un indicador visual.
5. CUANDO el último test de conectividad de un proveedor falló, EL Panel_de_Proveedores_IA DEBERÁ mostrar una alerta visual junto al proveedor afectado.

### Requisito 2: Visualización clara del flujo de proceso con agentes IA

**Historia de Usuario:** Como usuario, quiero ver claramente los pasos del flujo de análisis de nómina en el dashboard junto con los agentes IA responsables de cada paso, para entender en qué punto del proceso me encuentro, qué agentes están trabajando y qué pasos faltan.

#### Criterios de Aceptación

1. CUANDO el Dashboard se carga, EL Flujo_de_Proceso DEBERÁ mostrar los 4 pasos (carga, mapeo, validación, corrección) con indicadores visuales de estado (pendiente, en progreso, completado).
2. CUANDO un paso del Flujo_de_Proceso está completado, EL Dashboard DEBERÁ mostrar un indicador de check y el avatar del Agente_IA responsable de ese paso (Dianis para carga, Gyoru para mapeo, Juli y Wil para validación/corrección, Ana para reporte).
3. CUANDO el usuario hace clic en un paso completado del Flujo_de_Proceso, EL Dashboard DEBERÁ navegar a la sección correspondiente (upload, reconcile).
4. CUANDO un paso del Flujo_de_Proceso está en progreso, EL Dashboard DEBERÁ mostrar una animación de progreso, el avatar animado del Agente_IA activo y su nombre.
5. EL Flujo_de_Proceso DEBERÁ mostrar debajo de cada paso el nombre y emoji del Agente_IA asignado, utilizando los datos de AGENT_PERSONAS.
6. CUANDO múltiples agentes colaboran en un paso (validación: Juli audita, Wil corrige, Luni consulta normas), EL Flujo_de_Proceso DEBERÁ mostrar los avatares de todos los agentes involucrados con indicadores de comunicación entre ellos.

### Requisito 3: Panel de logs en tiempo real

**Historia de Usuario:** Como usuario, quiero ver los logs de actividad de los agentes IA en tiempo real directamente en el dashboard, para no perder visibilidad cuando cierro el sidebar de chat.

#### Criterios de Aceptación

1. CUANDO un Agente_IA inicia ejecución, EL Panel_de_Logs DEBERÁ agregar una entrada con timestamp, nombre del agente y descripción de la acción.
2. CUANDO un Agente_IA completa su ejecución, EL Panel_de_Logs DEBERÁ actualizar la entrada correspondiente con el resultado (éxito/error), tokens consumidos y latencia.
3. CUANDO ocurre comunicación inter-agente, EL Panel_de_Logs DEBERÁ mostrar una entrada indicando el agente origen, el agente destino y el tipo de mensaje.
4. EL Panel_de_Logs DEBERÁ persistir las entradas de log en el estado del componente para que sobrevivan al cierre y reapertura del sidebar de chat.
5. CUANDO el Panel_de_Logs tiene más de 100 entradas, EL Panel_de_Logs DEBERÁ permitir scroll y mantener auto-scroll hacia la entrada más reciente.
6. CUANDO el usuario hace clic en el botón de limpiar, EL Panel_de_Logs DEBERÁ eliminar todas las entradas de log.

### Requisito 4: Panel de síntesis en tiempo real

**Historia de Usuario:** Como usuario, quiero ver resúmenes y reportes generados por IA en tiempo real en el dashboard, para tener una vista consolidada de los resultados del análisis sin depender del sidebar.

#### Criterios de Aceptación

1. CUANDO el pipeline de agentes completa la ejecución, EL Panel_de_Síntesis DEBERÁ mostrar un resumen consolidado con hallazgos principales, nivel de riesgo y recomendaciones.
2. CUANDO un Agente_IA produce resultados parciales durante la ejecución, EL Panel_de_Síntesis DEBERÁ actualizar su contenido incrementalmente conforme llegan los eventos SSE.
3. CUANDO no hay resultados de síntesis disponibles, EL Panel_de_Síntesis DEBERÁ mostrar un estado vacío indicando que se necesita ejecutar un análisis.
4. EL Panel_de_Síntesis DEBERÁ mostrar qué agentes contribuyeron al resumen con sus avatares y nombres.

### Requisito 5: Layout del dashboard rediseñado

**Historia de Usuario:** Como usuario, quiero un dashboard organizado que integre las nuevas secciones (proveedores IA, flujo de proceso, logs, síntesis) junto con las métricas existentes, para tener una vista completa y coherente.

#### Criterios de Aceptación

1. EL DashboardClient DEBERÁ organizar el contenido en un layout de grid responsivo que incluya: hero section, Panel_de_Proveedores_IA, Flujo_de_Proceso, métricas por rol, Panel_de_Logs, Panel_de_Síntesis, y secciones existentes (gráficos, hallazgos, empresas).
2. MIENTRAS el viewport es menor a 768px, EL DashboardClient DEBERÁ apilar todas las secciones en una sola columna.
3. MIENTRAS el viewport es mayor o igual a 1024px, EL DashboardClient DEBERÁ mostrar el Panel_de_Logs y el Panel_de_Síntesis lado a lado.
4. EL DashboardClient DEBERÁ utilizar los tokens de diseño de Obsidian_Ledger (colores, espaciado, elevación) definidos en `design-tokens.ts` para todas las nuevas secciones.
5. EL DashboardClient DEBERÁ soportar los tres idiomas configurados (en, es, pt) mediante claves de traducción en los archivos de mensajes de next-intl.

### Requisito 6: Rediseño del sidebar de chat IA

**Historia de Usuario:** Como usuario, quiero un sidebar de chat IA simplificado y claro, para poder interactuar con los agentes sin confusión por exceso de información técnica.

#### Criterios de Aceptación

1. EL AiSidebar DEBERÁ mostrar los mensajes de chat con formato limpio, separando claramente mensajes del usuario y respuestas de los agentes.
2. CUANDO un Agente_IA responde, EL AiSidebar DEBERÁ mostrar el avatar y nombre del agente de forma prominente, sin mezclar chips de resultado, métricas de tokens y comunicación inter-agente en el mismo bloque de mensaje.
3. EL AiSidebar DEBERÁ mover la información técnica detallada (tokens consumidos, latencia, comunicación inter-agente) al Panel_de_Logs del dashboard, manteniendo el sidebar enfocado en la conversación.
4. CUANDO el sidebar está abierto, EL AiSidebar DEBERÁ mostrar un máximo de 3 sugerencias rápidas contextuales en lugar de la lista larga actual de 6 sugerencias.
5. EL AiSidebar DEBERÁ mantener un indicador simple de estado (qué agente está procesando) sin mostrar el streaming incremental de texto técnico dentro del sidebar.
6. CUANDO el usuario envía un mensaje, EL AiSidebar DEBERÁ mostrar la respuesta final del agente de forma clara, con un enlace opcional para ver detalles técnicos en el Panel_de_Logs.

### Requisito 7: Integración con infraestructura SSE existente

**Historia de Usuario:** Como desarrollador, quiero que los nuevos paneles de logs y síntesis consuman los mismos eventos SSE del PipelineStreamEmitter existente, para no duplicar infraestructura de streaming.

#### Criterios de Aceptación

1. CUANDO el Dashboard recibe eventos SSE de tipo `agent-start`, EL Panel_de_Logs DEBERÁ procesar el evento y crear una entrada de log.
2. CUANDO el Dashboard recibe eventos SSE de tipo `agent-complete`, EL Panel_de_Logs DEBERÁ actualizar la entrada del agente con resultados y métricas.
3. CUANDO el Dashboard recibe eventos SSE de tipo `pipeline-complete`, EL Panel_de_Síntesis DEBERÁ renderizar el resumen consolidado.
4. CUANDO el Dashboard recibe eventos SSE de tipo `agent-communication`, EL Panel_de_Logs DEBERÁ crear una entrada de comunicación inter-agente.
5. SI la conexión SSE se pierde, ENTONCES EL Dashboard DEBERÁ mostrar un indicador de desconexión y reintentar la conexión con backoff exponencial hasta 3 intentos.
