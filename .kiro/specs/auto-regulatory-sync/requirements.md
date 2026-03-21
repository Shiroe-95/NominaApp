# Documento de Requisitos — Sincronización Regulatoria Automática Multi-País

## Introducción

NominaSmart cuenta actualmente con un Agente Investigador que consulta normativa laboral por país y año, pero opera de forma manual (botón "Investigar") y utiliza una base de datos simulada (`REGULATION_DB`) en lugar de fuentes reales. El motor de reglas (`rule-engine.ts`) solo tiene constantes hardcodeadas para Colombia.

Esta mejora busca automatizar la detección de cambios regulatorios año a año, reemplazar los datos simulados con investigación web real, generar reglas automáticamente al inicio de cada año fiscal, extender la lógica de cálculo a múltiples países, y agregar notificaciones y auditoría completa sobre los cambios detectados.

## Glosario

- **Sistema_Sync**: Servicio de sincronización regulatoria automática que orquesta la detección periódica de cambios normativos.
- **Agente_Investigador**: Agente de IA que investiga normativa laboral vigente consultando fuentes externas y actualiza las reglas en la base de datos.
- **Motor_Reglas**: Módulo (`rule-engine.ts`) que carga y aplica reglas de validación de nómina por país y año.
- **REGULATION_DB**: Base de datos simulada hardcodeada en `researcher.ts` con datos normativos para CO, MX y PE.
- **country_year_rules**: Tabla en Supabase que almacena reglas normativas con clave compuesta `(country_code, rule_year)`.
- **research_sources**: Tabla en Supabase que registra las fuentes consultadas durante investigaciones regulatorias.
- **Panel_Admin**: Página de administración de países (`/admin/countries`) donde se gestionan países soportados.
- **Registro_Auditoría**: Registro persistente de cada cambio realizado en las reglas normativas, incluyendo autor, fecha, valores anteriores y nuevos, y fuentes consultadas.
- **País_Activo**: País con `is_active = true` en la tabla `supported_countries`.
- **Servicio_Email**: Servicio de envío de correos electrónicos integrado con Resend que gestiona el envío de notificaciones, invitaciones y alertas del sistema.
- **Gestor_Usuarios**: Módulo de administración de usuarios (`/settings/users`) que permite crear, editar, desactivar y gestionar usuarios de la organización.
- **Resend**: Proveedor externo de envío de correos electrónicos transaccionales utilizado por NominaSmart para entregar notificaciones y correos de invitación.

## Requisitos

### Requisito 1: Sincronización Periódica Automática

**Historia de Usuario:** Como administrador de NominaSmart, quiero que el sistema detecte automáticamente cambios regulatorios de forma periódica, para no depender exclusivamente del botón "Investigar" manual.

#### Criterios de Aceptación

1. THE Sistema_Sync SHALL ejecutar una verificación de cambios regulatorios para cada País_Activo al menos una vez por semana de forma automática.
2. WHEN el administrador configura una frecuencia de sincronización personalizada (diaria, semanal, mensual), THE Sistema_Sync SHALL respetar la frecuencia configurada para las ejecuciones posteriores.
3. WHEN una sincronización automática se inicia, THE Sistema_Sync SHALL registrar la fecha y hora de inicio, el país procesado y el estado de la ejecución (en progreso, completada, fallida) en una tabla de historial de sincronización.
4. IF una sincronización automática falla por error de red o timeout, THEN THE Sistema_Sync SHALL reintentar la operación hasta 3 veces con espera exponencial antes de marcar la ejecución como fallida.
5. WHEN una sincronización automática se completa exitosamente, THE Sistema_Sync SHALL registrar la fecha de finalización, la cantidad de cambios detectados y el nivel de confianza de las fuentes consultadas.
6. THE Panel_Admin SHALL mostrar el estado de la última sincronización por país (fecha, resultado, cambios detectados) en la tabla de países soportados.

### Requisito 2: Investigación con Fuentes Web Reales

**Historia de Usuario:** Como administrador de NominaSmart, quiero que el Agente Investigador consulte fuentes gubernamentales reales en lugar de datos simulados, para que las reglas reflejen la normativa vigente con precisión.

#### Criterios de Aceptación

1. WHEN el Agente_Investigador recibe una solicitud de investigación para un país y año, THE Agente_Investigador SHALL consultar al menos 2 fuentes externas verificables (sitios gubernamentales, gacetas oficiales, entidades reguladoras) en lugar de la REGULATION_DB simulada.
2. THE Agente_Investigador SHALL asignar un nivel de confianza (alto, medio, bajo) a cada fuente consultada según su origen: alto para fuentes gubernamentales oficiales, medio para firmas de auditoría reconocidas, bajo para fuentes no verificadas.
3. WHEN el Agente_Investigador no puede acceder a fuentes externas, THE Agente_Investigador SHALL utilizar la REGULATION_DB como respaldo temporal y marcar el resultado con confianza "bajo" e indicar que se usaron datos de respaldo.
4. THE Agente_Investigador SHALL registrar cada fuente consultada en la tabla research_sources con la URL, título, fecha de acceso, nivel de confianza y el ID de la regla asociada.
5. WHEN el Agente_Investigador detecta información contradictoria entre fuentes, THE Agente_Investigador SHALL priorizar la fuente con mayor nivel de confianza y registrar la discrepancia en el resultado de la investigación.

### Requisito 3: Generación Automática de Reglas para Año Nuevo

**Historia de Usuario:** Como administrador de NominaSmart, quiero que el sistema genere automáticamente las reglas del nuevo año fiscal basándose en las reglas del año anterior y los cambios detectados, para reducir el trabajo manual de configuración.

#### Criterios de Aceptación

1. WHEN el Sistema_Sync detecta que no existen reglas en country_year_rules para un País_Activo y el año fiscal siguiente al año actual, THE Sistema_Sync SHALL crear automáticamente un borrador de reglas copiando las reglas del año actual como base.
2. WHEN el Agente_Investigador detecta cambios regulatorios para el año nuevo, THE Sistema_Sync SHALL aplicar los cambios detectados sobre el borrador de reglas y marcar la regla como "pendiente de revisión".
3. THE Panel_Admin SHALL mostrar las reglas con estado "pendiente de revisión" con un indicador visual diferenciado para que el administrador las revise y apruebe.
4. WHEN el administrador aprueba una regla pendiente de revisión, THE Sistema_Sync SHALL cambiar el estado de la regla a "aprobada" y registrar la aprobación en el Registro_Auditoría.
5. WHEN el administrador rechaza una regla pendiente de revisión, THE Panel_Admin SHALL permitir la edición manual de la regla antes de aprobarla.
6. IF no se detectan cambios regulatorios para el año nuevo, THEN THE Sistema_Sync SHALL mantener las reglas del año anterior como vigentes para el nuevo año y notificar al administrador que no se encontraron cambios.

### Requisito 4: Motor de Reglas Multi-País

**Historia de Usuario:** Como desarrollador de NominaSmart, quiero que el motor de reglas soporte lógica de cálculo específica por país, para que las validaciones de nómina sean correctas independientemente del país.

#### Criterios de Aceptación

1. THE Motor_Reglas SHALL cargar constantes de cálculo (salario mínimo, topes, porcentajes de aportes) dinámicamente desde country_year_rules para cada país soportado, sin depender de constantes hardcodeadas en el código fuente.
2. WHEN el Motor_Reglas no encuentra reglas en la base de datos para un país y año solicitados, THE Motor_Reglas SHALL retornar un error descriptivo indicando que no existen reglas configuradas para esa combinación de país y año.
3. THE Motor_Reglas SHALL exponer una interfaz de validación uniforme (`validate`) que acepte datos de nómina y retorne hallazgos (`ValidationFinding`) independientemente del país.
4. WHEN se agregan reglas para un nuevo país en country_year_rules, THE Motor_Reglas SHALL poder validar nóminas de ese país sin requerir cambios en el código fuente del motor.
5. THE Motor_Reglas SHALL parsear los valores numéricos (salario mínimo, porcentajes, topes) desde el campo `checks` de country_year_rules para utilizarlos en las validaciones programáticas.
6. FOR ALL reglas almacenadas en country_year_rules, parsear una regla y formatearla de vuelta a texto SHALL producir un objeto equivalente al original (propiedad de ida y vuelta).

### Requisito 5: Notificaciones de Cambios Regulatorios

**Historia de Usuario:** Como administrador de NominaSmart, quiero recibir notificaciones cuando se detecten cambios regulatorios, para tomar acción oportuna sobre las reglas de nómina.

#### Criterios de Aceptación

1. WHEN el Sistema_Sync detecta cambios regulatorios para un País_Activo, THE Sistema_Sync SHALL generar una notificación en la aplicación con el resumen de cambios detectados, el país afectado y el nivel de confianza.
2. WHEN el Sistema_Sync detecta cambios con confianza "alto", THE Sistema_Sync SHALL clasificar la notificación como informativa.
3. WHEN el Sistema_Sync detecta cambios con confianza "medio" o "bajo", THE Sistema_Sync SHALL clasificar la notificación como advertencia para que el administrador verifique manualmente.
4. THE Panel_Admin SHALL mostrar un indicador de notificaciones pendientes en la interfaz de administración de países.
5. WHEN el administrador visualiza una notificación, THE Panel_Admin SHALL marcar la notificación como leída y registrar la fecha de lectura.

### Requisito 6: Auditoría de Cambios en Reglas

**Historia de Usuario:** Como administrador de NominaSmart, quiero un registro completo de auditoría de todos los cambios en las reglas normativas, para tener trazabilidad sobre quién cambió qué, cuándo y basándose en qué fuentes.

#### Criterios de Aceptación

1. WHEN una regla en country_year_rules es creada o modificada (manual o automáticamente), THE Sistema_Sync SHALL registrar en el Registro_Auditoría: el ID de la regla, la acción realizada (creación, actualización, aprobación), los valores anteriores, los valores nuevos, la fecha y hora, y el origen del cambio (automático o manual).
2. WHEN el cambio es realizado por el Agente_Investigador de forma automática, THE Registro_Auditoría SHALL incluir los IDs de las fuentes consultadas en research_sources que respaldaron el cambio.
3. WHEN el cambio es realizado manualmente por un administrador, THE Registro_Auditoría SHALL incluir el identificador del usuario que realizó el cambio.
4. THE Panel_Admin SHALL permitir consultar el historial de auditoría de una regla específica, mostrando todos los cambios ordenados cronológicamente.
5. THE Registro_Auditoría SHALL retener los registros de auditoría por un mínimo de 5 años para cumplir con requisitos de trazabilidad regulatoria.


### Requisito 7: Creación y Gestión de Usuarios con Invitación

**Historia de Usuario:** Como administrador de NominaSmart, quiero crear usuarios en la plataforma y enviarles un correo de invitación, para que puedan acceder al sistema de forma segura sin necesidad de compartir contraseñas manualmente.

#### Criterios de Aceptación

1. WHEN el administrador completa el formulario de creación de usuario con email, nombre, rol y empresa, THE Gestor_Usuarios SHALL crear el usuario en el sistema de autenticación y registrar su perfil en la tabla user_profiles.
2. WHEN el administrador crea un nuevo usuario, THE Gestor_Usuarios SHALL enviar un correo de invitación al email del usuario a través del Servicio_Email con un enlace seguro para establecer su contraseña.
3. THE Gestor_Usuarios SHALL validar que el email proporcionado no esté registrado previamente en el sistema antes de crear el usuario.
4. IF el envío del correo de invitación falla, THEN THE Gestor_Usuarios SHALL registrar el error, mantener el usuario creado en estado pendiente y permitir al administrador reenviar la invitación.
5. WHEN el usuario invitado accede al enlace de invitación, THE Gestor_Usuarios SHALL permitir al usuario establecer su contraseña y activar su cuenta.
6. THE Gestor_Usuarios SHALL permitir al administrador reenviar el correo de invitación a usuarios que aún no hayan activado su cuenta.
7. WHEN el administrador asigna un rol (admin, analyst, client) al nuevo usuario, THE Gestor_Usuarios SHALL aplicar los permisos correspondientes al rol asignado desde el momento de la activación de la cuenta.

### Requisito 8: Envío de Correos Electrónicos con Resend

**Historia de Usuario:** Como administrador de NominaSmart, quiero que el sistema envíe correos electrónicos transaccionales a través de Resend, para notificar a los usuarios sobre cambios regulatorios, invitaciones y alertas relevantes.

#### Criterios de Aceptación

1. THE Servicio_Email SHALL integrarse con la API de Resend para el envío de todos los correos electrónicos transaccionales del sistema.
2. WHEN el Sistema_Sync detecta cambios regulatorios para un País_Activo, THE Servicio_Email SHALL enviar un correo de alerta a todos los administradores activos con el resumen de cambios detectados, el país afectado y el nivel de confianza.
3. WHEN el Servicio_Email envía un correo, THE Servicio_Email SHALL registrar el resultado del envío (exitoso, fallido, rebotado) junto con el ID de mensaje de Resend, el destinatario y la fecha de envío.
4. IF el envío de un correo falla por error de la API de Resend, THEN THE Servicio_Email SHALL reintentar el envío hasta 3 veces con espera exponencial antes de marcar el envío como fallido.
5. THE Servicio_Email SHALL soportar los siguientes tipos de correo: invitación de usuario, alerta de cambio regulatorio, y resumen semanal de sincronización.
6. WHEN el administrador configura los destinatarios de alertas regulatorias por país, THE Servicio_Email SHALL enviar las alertas únicamente a los destinatarios configurados para el país afectado.
7. THE Servicio_Email SHALL utilizar plantillas de correo con el branding de NominaSmart y contenido localizado según el idioma preferido del destinatario.
