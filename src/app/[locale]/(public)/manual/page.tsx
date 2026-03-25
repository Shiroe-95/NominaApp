'use client';

/**
 * Manual de Usuario — Guía completa de NóminaSmart.
 *
 * Página pública con documentación detallada de todas las funcionalidades
 * de la plataforma, organizada por secciones con navegación lateral.
 *
 * Ruta: /[locale]/manual (pública, sin autenticación requerida).
 */

import { useState } from 'react';
import {
  BookOpen, LayoutDashboard, UploadCloud, GitMerge, FileCheck2,
  BookOpenCheck, Settings, Brain, Shield, ChevronRight,
  Sparkles, Zap, HelpCircle, ArrowRight,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

/* ── Secciones del manual ─────────────────────────────────────────── */

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

/**
 * Encabezado de sección dentro del contenido del manual.
 * Renderiza un `<h3>` con estilos violeta del design system Obsidian Ledger.
 *
 * @param props.children - Texto o nodos del encabezado.
 * @returns Elemento `<h3>` estilizado.
 */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-[#d2bbff] mt-6 mb-3">{children}</h3>;
}

/**
 * Caja de consejo/tip destacada con ícono de chispa.
 * Usa fondo violeta translúcido para resaltar recomendaciones al usuario.
 *
 * @param props.children - Contenido del consejo.
 * @returns Contenedor estilizado con ícono Sparkles.
 */
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl px-4 py-3 text-sm text-[#d2bbff] my-3 flex items-start gap-2">
      <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

/**
 * Paso numerado para instrucciones secuenciales.
 * Muestra un círculo con el número y el contenido descriptivo al lado.
 *
 * @param props.number  - Número del paso (se muestra en el círculo).
 * @param props.title   - Título breve del paso.
 * @param props.children - Descripción detallada del paso.
 * @returns Fila con indicador numérico y texto.
 */
function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 my-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#7C3AED]/20 text-[#d2bbff] flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      <div>
        <p className="font-semibold text-[#e0e2f1] text-sm">{title}</p>
        <p className="text-[#958da1] text-sm mt-1">{children}</p>
      </div>
    </div>
  );
}

const sections: Section[] = [
  {
    id: 'introduccion',
    title: 'Introducción',
    icon: BookOpen,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          NóminaSmart es una plataforma de auditoría inteligente de nómina impulsada por inteligencia artificial.
          Está diseñada para empresas que operan en múltiples países de Latinoamérica y necesitan garantizar
          el cumplimiento normativo laboral de sus planillas de nómina.
        </p>
        <SectionHeading>¿Qué hace NóminaSmart?</SectionHeading>
        <p className="text-[#958da1] text-sm leading-relaxed">
          La plataforma ejecuta un proceso de <strong className="text-[#e0e2f1]">&quot;Triple Match&quot;</strong> que cruza tres fuentes de información:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          {[
            { title: 'Nómina Interna', desc: 'Archivos Excel/CSV exportados desde tu ERP o sistema de nómina.' },
            { title: 'Pago PILA / Seguridad Social', desc: 'Planilla de aportes del país correspondiente (PILA en Colombia, IMSS en México, etc.).' },
            { title: 'Estándar Regulatorio', desc: 'Cálculo normativo oficial según las leyes laborales vigentes del país.' },
          ].map((item) => (
            <div key={item.title} className="bg-[#181b26] rounded-xl p-4 border border-[#4a4455]/10">
              <p className="text-sm font-semibold text-[#e0e2f1] mb-1">{item.title}</p>
              <p className="text-xs text-[#958da1]">{item.desc}</p>
            </div>
          ))}
        </div>
        <SectionHeading>Flujo general de trabajo</SectionHeading>
        <Step number={1} title="Cargar nómina">
          Sube tus archivos Excel o CSV. El agente Gyoru mapea automáticamente las columnas a campos estándar.
        </Step>
        <Step number={2} title="Auditar y corregir">
          Juli ejecuta 14 verificaciones matemáticas y normativas. Wil propone correcciones automáticas.
        </Step>
        <Step number={3} title="Generar reporte">
          Ana redacta un reporte ejecutivo con hallazgos priorizados y recomendaciones accionables.
        </Step>
        <Step number={4} title="Reconciliar y cerrar">
          Revisa hallazgos por empleado, asigna acciones correctivas y marca resoluciones.
        </Step>
        <SectionHeading>Países soportados</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Colombia, México, Perú, Chile, Brasil, Argentina y Estados Unidos. Las reglas normativas se cargan
          dinámicamente por país y año, y se sincronizan automáticamente con cambios regulatorios.
        </p>
        <SectionHeading>Idiomas disponibles</SectionHeading>
        <p className="text-[#958da1] text-sm">
          La interfaz está disponible en Español, Inglés y Portugués. Puedes cambiar el idioma desde
          Configuración o desde el selector de idioma en la barra superior.
        </p>
      </div>
    ),
  },
  {
    id: 'agentes-ia',
    title: 'Agentes de IA',
    icon: Brain,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          NóminaSmart cuenta con 7 agentes de IA especializados que trabajan en equipo para procesar tu nómina.
          Cada agente tiene un rol específico y una personalidad única.
        </p>
        <div className="space-y-4 mt-4">
          {[
            { emoji: '👩', name: 'Dianis', role: 'Directora de Orquestación (Master)', desc: 'Coordina a todo el equipo. Clasifica la intención del usuario, construye el plan de ejecución y consolida los resultados de todos los agentes. Es quien decide qué agentes participan en cada tarea.' },
            { emoji: '👩', name: 'Juli', role: 'Auditora de Nómina (Auditor)', desc: 'Ejecuta 14 verificaciones matemáticas y normativas sobre cada registro de nómina. Detecta inconsistencias en IBC, aportes de salud, pensión, prestaciones sociales, parafiscales y más. Adapta sus verificaciones al país y año del contexto.' },
            { emoji: '👩', name: 'Ana', role: 'Redactora de Reportes (Writer)', desc: 'Genera reportes ejecutivos narrativos con hallazgos agrupados por categoría (IBC, Seguridad Social, Prestaciones, etc.) y priorizados por severidad (alta, media, baja). Incluye referencias normativas específicas del país.' },
            { emoji: '👨', name: 'Wil', role: 'Ingeniero de Correcciones (Corrector)', desc: 'Propone correcciones numéricas determinísticas usando fórmulas normativas. Para hallazgos que no pueden corregirse automáticamente, proporciona una guía experta paso a paso.' },
            { emoji: '🐱', name: 'Gyoru', role: 'Mapeadora de Campos (Mapper)', desc: 'Mapea las columnas de tus archivos Excel a campos estándar del sistema. Usa un diccionario de sinónimos y fuzzy matching con IA para identificar correspondencias incluso cuando los nombres de columna varían.' },
            { emoji: '🐰', name: 'Luni', role: 'Experta en Nómina Multi-País (Payroll Expert)', desc: 'Asistente conversacional especializada en normativa laboral de 7 países. Responde preguntas sobre cálculos, leyes y regulaciones. También gestiona las reglas normativas (crear, editar, eliminar).' },
            { emoji: '🐕', name: 'Soul', role: 'Investigadora Regulatoria (Researcher)', desc: 'Investiga normativa laboral vigente por país y año. Busca actualizaciones regulatorias en fuentes oficiales y resuelve conflictos entre fuentes de información.' },
          ].map((agent) => (
            <div key={agent.name} className="bg-[#181b26] rounded-xl p-4 border border-[#4a4455]/10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{agent.emoji}</span>
                <span className="font-bold text-[#e0e2f1]">{agent.name}</span>
                <span className="text-xs text-[#958da1]">— {agent.role}</span>
              </div>
              <p className="text-sm text-[#958da1] leading-relaxed">{agent.desc}</p>
            </div>
          ))}
        </div>
        <Tip>
          Puedes interactuar con los agentes a través del chat de IA (panel lateral derecho).
          Dianis clasificará tu mensaje y delegará al agente más adecuado.
        </Tip>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Tablero (Dashboard)',
    icon: LayoutDashboard,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          El tablero es tu centro de control principal. Muestra métricas clave de auditoría,
          estado de certificación y tendencias de riesgo. La vista se adapta según tu rol.
        </p>
        <SectionHeading>Vistas por rol</SectionHeading>
        <div className="space-y-3">
          {[
            { role: 'Administrador', desc: 'Ve todas las empresas, métricas globales de cumplimiento, proveedores de IA configurados y acceso al panel de administración (finanzas, países, consumo de tokens, optimización).' },
            { role: 'Analista', desc: 'Centro de trabajo con nóminas pendientes, hallazgos recientes y acceso rápido a correcciones.' },
            { role: 'Cliente', desc: 'Vista ejecutiva del estado de certificación, hallazgos y tendencias de riesgo de su empresa.' },
          ].map((v) => (
            <div key={v.role} className="bg-[#181b26] rounded-xl p-3 border border-[#4a4455]/10">
              <p className="text-sm font-semibold text-[#e0e2f1]">{v.role}</p>
              <p className="text-xs text-[#958da1] mt-1">{v.desc}</p>
            </div>
          ))}
        </div>
        <SectionHeading>Métricas principales</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1.5 list-disc list-inside">
          <li><strong className="text-[#e0e2f1]">Total Planillas:</strong> Cantidad de nóminas procesadas.</li>
          <li><strong className="text-[#e0e2f1]">Tasa de Certificación:</strong> Porcentaje de planillas que cumplen todos los requisitos normativos.</li>
          <li><strong className="text-[#e0e2f1]">Riesgo Promedio:</strong> Nivel de riesgo promedio calculado sobre todas las planillas.</li>
          <li><strong className="text-[#e0e2f1]">Hallazgos Críticos:</strong> Número de hallazgos de severidad alta que requieren atención inmediata.</li>
          <li><strong className="text-[#e0e2f1]">Empleados en Riesgo:</strong> Empleados con puntaje de riesgo elevado.</li>
        </ul>
        <SectionHeading>Filtros</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Puedes filtrar las métricas por empresa, país, año y mes usando los selectores en la parte superior del tablero.
        </p>
        <SectionHeading>Flujo de proceso</SectionHeading>
        <p className="text-[#958da1] text-sm">
          El panel de flujo de proceso muestra los 4 pasos (Carga → Mapeo → Validación → Reporte) con indicadores
          visuales de progreso. Cada paso muestra el agente responsable.
        </p>
        <SectionHeading>Proveedores de IA</SectionHeading>
        <p className="text-[#958da1] text-sm">
          El panel de proveedores muestra cuántos proveedores de IA tienes configurados y cuántos están activos.
          Desde aquí puedes acceder rápidamente a la configuración de proveedores.
        </p>
        <Tip>
          Si ves &quot;Sin proveedores configurados&quot;, ve a Configuración → Proveedores de IA para agregar tu primer proveedor.
          Recomendamos empezar con OpenRouter usando modelos gratuitos.
        </Tip>
      </div>
    ),
  },
  {
    id: 'carga',
    title: 'Carga de Nómina',
    icon: UploadCloud,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          La página de Ingesta Inteligente de Datos te permite subir archivos de nómina y procesarlos
          en 4 pasos guiados por los agentes de IA.
        </p>
        <SectionHeading>Paso 1: Carga de archivos</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Arrastra y suelta tus archivos Excel (.xlsx, .xls) o CSV en la zona de carga, o haz clic para seleccionarlos.
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Puedes subir múltiples archivos a la vez.</li>
          <li>El sistema detecta automáticamente las hojas de cada archivo Excel.</li>
          <li>Selecciona las hojas que contienen datos de nómina (puedes deseleccionar hojas de resumen o portada).</li>
          <li>El periodo (mes/año) se detecta automáticamente del contenido del archivo cuando es posible.</li>
        </ul>
        <SectionHeading>Paso 2: Mapeo inteligente con IA</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          El agente Gyoru analiza los encabezados de tus columnas y los mapea automáticamente a campos estándar del sistema.
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Revisa las sugerencias de mapeo y ajusta manualmente si es necesario.</li>
          <li>Los campos obligatorios se marcan con indicadores visuales.</li>
          <li>Gyoru usa sinónimos y fuzzy matching para identificar columnas incluso con nombres diferentes.</li>
          <li>Puedes crear campos calculados que no existen en tu archivo original.</li>
        </ul>
        <SectionHeading>Paso 3: Verificación normativa</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Selecciona el país, año y empresa. El sistema carga las reglas normativas correspondientes y ejecuta las verificaciones.
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Se validan campos obligatorios y cálculos requeridos.</li>
          <li>Se ejecutan las 14 verificaciones matemáticas del auditor Juli.</li>
          <li>Se calcula el puntaje de riesgo por empleado.</li>
          <li>Se determina si la planilla es certificable o no.</li>
        </ul>
        <SectionHeading>Paso 4: Corrección y exportación</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Revisa los hallazgos y aplica correcciones. Puedes corregir manualmente o usar las sugerencias del agente Wil.
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Las correcciones se aplican celda por celda con fórmulas normativas.</li>
          <li>Puedes exportar la planilla corregida a Excel.</li>
          <li>Al guardar, la planilla queda disponible en Reportes y Reconciliación.</li>
        </ul>
        <Tip>
          Asegúrate de tener al menos un proveedor de IA configurado antes de usar el mapeo inteligente.
          El mapeo funciona mejor con modelos de alta calidad (GPT-4.1, Claude Sonnet 4, Gemini 2.5).
        </Tip>
      </div>
    ),
  },
  {
    id: 'reconciliacion',
    title: 'Reconciliación',
    icon: GitMerge,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          La página de Reconciliación es donde revisas en detalle las planillas procesadas,
          gestionas hallazgos por empleado y cierras acciones correctivas.
        </p>
        <SectionHeading>Flujo de revisión en 3 pasos</SectionHeading>
        <Step number={1} title="Prioriza">
          Revisa primero los empleados con riesgo alto y hallazgos críticos. La tabla de riesgo por empleado
          muestra el puntaje, los hallazgos principales y las acciones sugeridas.
        </Step>
        <Step number={2} title="Asigna">
          Crea acciones correctivas y asígnalas a un responsable con fecha de seguimiento.
          Puedes asignar automáticamente a un responsable predeterminado.
        </Step>
        <Step number={3} title="Cierra">
          Marca las acciones como resueltas para consolidar la evidencia de cumplimiento.
          Las acciones cerradas quedan registradas en la bitácora de auditoría.
        </Step>
        <SectionHeading>Panel normativo</SectionHeading>
        <p className="text-[#958da1] text-sm">
          El panel lateral muestra los campos requeridos, cálculos obligatorios y verificaciones
          normativas del país/año seleccionado. Los campos faltantes se resaltan en rojo.
        </p>
        <SectionHeading>Cobertura de variables</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Muestra cuántas variables fueron detectadas, cuántas se mapearon correctamente,
          cuántas se crearon como campos calculados y cuántas categorías se clasificaron.
        </p>
        <SectionHeading>Validación matemática</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Detalle de cada verificación ejecutada: filas que pasaron, filas que fallaron y
          ejemplos de hallazgos. Incluye dependencias faltantes y posibles coincidencias.
        </p>
        <SectionHeading>Workbench en vivo</SectionHeading>
        <p className="text-[#958da1] text-sm">
          El componente LivePayrollWorkbench permite ejecutar análisis interactivos en tiempo real
          sobre la planilla seleccionada, con logs de agentes y síntesis de IA.
        </p>
        <Tip>
          Selecciona una planilla de la lista para cargar su revisión completa. Si no ves planillas,
          primero carga una desde la página de Cargar Nómina.
        </Tip>
      </div>
    ),
  },
  {
    id: 'reportes',
    title: 'Reportes',
    icon: FileCheck2,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          La página de Reportes muestra el histórico de todas las auditorías realizadas,
          con métricas agregadas y detalle por planilla.
        </p>
        <SectionHeading>Métricas de resumen</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li><strong className="text-[#e0e2f1]">Planillas:</strong> Total de planillas procesadas.</li>
          <li><strong className="text-[#e0e2f1]">Certificables:</strong> Planillas que cumplen todos los requisitos.</li>
          <li><strong className="text-[#e0e2f1]">Fallas Críticas:</strong> Planillas con hallazgos de severidad alta.</li>
          <li><strong className="text-[#e0e2f1]">Cola Abierta:</strong> Acciones correctivas pendientes de resolución.</li>
        </ul>
        <SectionHeading>Detalle por planilla</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Cada planilla muestra: empresa, periodo, estado de certificación, riesgo global,
          cobertura de campos, variables detectadas, resumen de conceptos clasificados,
          riesgo por empleado y resultados de validación matemática.
        </p>
        <SectionHeading>Exportación</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Puedes exportar los reportes a Excel (.xlsx) para compartirlos con tu equipo o
          adjuntarlos como evidencia de auditoría.
        </p>
        <SectionHeading>Eliminación</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Las planillas pueden eliminarse individualmente. Esta acción es irreversible y
          elimina también las acciones correctivas asociadas.
        </p>
        <Tip>
          Los reportes se generan automáticamente al guardar una planilla desde la página de Carga.
          No necesitas ejecutar ninguna acción adicional.
        </Tip>
      </div>
    ),
  },
  {
    id: 'reglas',
    title: 'Reglas Normativas',
    icon: BookOpenCheck,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          Las reglas normativas definen los campos obligatorios, cálculos requeridos y verificaciones
          que se aplican a cada planilla según el país y año.
        </p>
        <SectionHeading>Estructura de una regla</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li><strong className="text-[#e0e2f1]">País y año:</strong> Cada regla aplica a un país y año específico (ej: Colombia 2026).</li>
          <li><strong className="text-[#e0e2f1]">Etiqueta:</strong> Nombre descriptivo con referencia legal (ej: &quot;Normativa Colombia 2026 - Ley 1393&quot;).</li>
          <li><strong className="text-[#e0e2f1]">Campos requeridos:</strong> Campos estructurales obligatorios para certificación (ej: document_number, base_salary).</li>
          <li><strong className="text-[#e0e2f1]">Cálculos requeridos:</strong> Cálculos numéricos obligatorios (ej: ibc_total, health_employee_deduction).</li>
          <li><strong className="text-[#e0e2f1]">Verificaciones:</strong> Reglas de validación con fórmulas y valores de referencia (ej: SMMLV 2026, topes de IBC).</li>
        </ul>
        <SectionHeading>Gestión de reglas</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Crear nuevas reglas para países y años no cubiertos.</li>
          <li>Editar reglas existentes para actualizar valores (ej: nuevo SMMLV).</li>
          <li>Eliminar reglas obsoletas.</li>
          <li>Filtrar por país para encontrar reglas rápidamente.</li>
        </ul>
        <SectionHeading>Flujo de aprobación</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Las reglas nuevas o editadas pueden requerir aprobación antes de activarse.
          El estado puede ser: borrador, pendiente de aprobación, aprobada o rechazada.
          Cada cambio queda registrado en la bitácora de auditoría.
        </p>
        <SectionHeading>Sincronización regulatoria</SectionHeading>
        <p className="text-[#958da1] text-sm">
          El agente Soul puede investigar automáticamente cambios regulatorios y proponer
          actualizaciones a las reglas. La sincronización se puede ejecutar manualmente
          desde el panel de administración de países.
        </p>
        <Tip>
          Las reglas se cargan dinámicamente cuando procesas una planilla. Si no hay reglas
          para el país/año seleccionado, el sistema usa reglas de respaldo predefinidas para Colombia y México.
        </Tip>
      </div>
    ),
  },
  {
    id: 'configuracion',
    title: 'Configuración',
    icon: Settings,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          La página de Configuración te permite personalizar tu experiencia en NóminaSmart.
        </p>
        <SectionHeading>Cuenta</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Muestra tu nombre y correo electrónico. Puedes ver tu rol activo (Administrador, Nómina o Auditor)
          y cambiar entre roles si tienes permisos.
        </p>
        <SectionHeading>Idioma</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Selecciona el idioma de la interfaz: Español, Inglés o Portugués. El cambio se aplica inmediatamente
          a toda la aplicación.
        </p>
        <SectionHeading>Notificaciones</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Configura qué tipos de alertas deseas recibir:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside mt-2">
          <li>Hallazgos de severidad alta</li>
          <li>Planilla guardada correctamente</li>
          <li>Reporte de certificación listo</li>
          <li>Hallazgos de severidad media</li>
        </ul>
        <SectionHeading>Proveedores de IA</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Desde Configuración puedes acceder a la gestión de proveedores de IA. Esta es una de las
          configuraciones más importantes de la plataforma.
        </p>
        <Tip>
          Accede rápidamente a Proveedores de IA desde el botón destacado en la parte superior de Configuración.
        </Tip>
      </div>
    ),
  },
  {
    id: 'proveedores-ia',
    title: 'Proveedores de IA',
    icon: Sparkles,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          Los proveedores de IA son los servicios que alimentan a los agentes inteligentes de NóminaSmart.
          Necesitas al menos un proveedor configurado para usar las funciones de IA.
        </p>
        <SectionHeading>Proveedores disponibles</SectionHeading>
        <div className="space-y-2 mt-2">
          {[
            { icon: '🌐', name: 'OpenRouter', desc: 'Acceso a múltiples modelos con una sola API key. Incluye modelos gratuitos. Recomendado para empezar.' },
            { icon: '🤖', name: 'OpenAI', desc: 'Modelos GPT directamente desde OpenAI (GPT-4.1, GPT-4.1 Mini, o4-mini).' },
            { icon: '🧠', name: 'Anthropic', desc: 'Modelos Claude de Anthropic (Claude Sonnet 4, Claude Opus 4, Claude 3.5 Haiku).' },
            { icon: '⚡', name: 'Groq', desc: 'Inferencia ultra-rápida con modelos open-source acelerados (Llama 3.3, DeepSeek R1).' },
            { icon: '🔮', name: 'Google AI', desc: 'Modelos Gemini directamente desde Google (Gemini 2.5 Flash, Gemini 2.5 Pro).' },
          ].map((p) => (
            <div key={p.name} className="flex items-start gap-3 bg-[#181b26] rounded-xl p-3 border border-[#4a4455]/10">
              <span className="text-lg">{p.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[#e0e2f1]">{p.name}</p>
                <p className="text-xs text-[#958da1]">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <SectionHeading>Cómo agregar un proveedor</SectionHeading>
        <Step number={1} title="Selecciona el proveedor">
          Elige entre OpenRouter, OpenAI, Anthropic, Groq o Google AI.
        </Step>
        <Step number={2} title="Elige un modelo">
          Selecciona el modelo de IA. Los modelos gratuitos se marcan en verde. Los recomendados tienen un asterisco.
        </Step>
        <Step number={3} title="Ingresa tu API Key">
          Pega tu API key del proveedor. Se cifra con AES-256-GCM antes de almacenarse.
        </Step>
        <Step number={4} title="Prueba la conectividad">
          Usa el botón de test para verificar que la conexión funciona correctamente.
        </Step>
        <SectionHeading>Prioridad y fallback</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Puedes configurar múltiples proveedores y ordenarlos por prioridad. Si el proveedor principal
          falla, el sistema automáticamente intenta con el siguiente en la lista (fallback chain).
          Usa las flechas arriba/abajo para reordenar.
        </p>
        <SectionHeading>Modelos gratuitos recomendados</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Para empezar sin costo, recomendamos OpenRouter con:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside mt-2">
          <li><strong className="text-[#4edea3]">Gemini 2.5 Flash (gratis)</strong> — 1M tokens de contexto, excelente para mapeo y auditoría.</li>
          <li><strong className="text-[#4edea3]">DeepSeek V3 (gratis)</strong> — 64K tokens, muy bueno para análisis y correcciones.</li>
        </ul>
        <Tip>
          Tu API key nunca se muestra en texto plano después de guardarla. Solo se muestra una versión enmascarada.
          Si necesitas cambiarla, edita el proveedor e ingresa la nueva key.
        </Tip>
      </div>
    ),
  },
  {
    id: 'admin',
    title: 'Administración',
    icon: Shield,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          Las páginas de administración están disponibles solo para usuarios con rol de Administrador.
          Permiten gestionar la plataforma a nivel global.
        </p>
        <SectionHeading>Gestión de usuarios</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Desde Configuración → Usuarios puedes:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Invitar nuevos usuarios por correo electrónico.</li>
          <li>Asignar roles: Administrador, Analista o Cliente.</li>
          <li>Asociar usuarios a empresas específicas.</li>
          <li>Activar o desactivar cuentas.</li>
          <li>Reenviar invitaciones pendientes.</li>
          <li>Filtrar por rol, estado o buscar por nombre/correo.</li>
        </ul>
        <SectionHeading>Gestión de países</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Desde Admin → Países puedes configurar los países soportados:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Agregar nuevos países con su moneda, formato de localización y separadores numéricos.</li>
          <li>Editar configuración de países existentes.</li>
          <li>Activar o desactivar países.</li>
          <li>Ejecutar sincronización regulatoria manual (el agente Soul investiga cambios normativos).</li>
        </ul>
        <SectionHeading>Panel financiero</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Admin → Finanzas muestra métricas financieras de la operación de IA:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Costo total de IA, ingresos, márgenes bruto y neto.</li>
          <li>Costo promedio por nómina procesada.</li>
          <li>Tendencia temporal de costos e ingresos.</li>
          <li>Desglose por proveedor, agente y cliente.</li>
          <li>Exportación a CSV.</li>
        </ul>
        <SectionHeading>Consumo de tokens</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Admin → Consumo muestra análisis multidimensional del uso de IA:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Total de llamadas, tokens consumidos, tasa de error y latencia promedio.</li>
          <li>Desglose por proveedor, agente, tipo de tarea y cliente.</li>
          <li>Gráficos de barras interactivos.</li>
          <li>Filtros por proveedor, agente y rango de fechas.</li>
        </ul>
        <SectionHeading>Optimización de modelos</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          Admin → Configuración → Optimización permite ajustar cómo se seleccionan los modelos de IA:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li><strong className="text-[#e0e2f1]">Estrategia:</strong> Costo primero, Balanceado o Calidad primero.</li>
          <li><strong className="text-[#e0e2f1]">Pesos:</strong> Importancia relativa de costo vs calidad (deben sumar 1.0).</li>
          <li><strong className="text-[#e0e2f1]">Umbral de calidad:</strong> Modelos por debajo de este umbral se descartan.</li>
          <li><strong className="text-[#e0e2f1]">Auto-routing:</strong> Asigna modelos preferidos por tipo de tarea, agente y complejidad.</li>
          <li><strong className="text-[#e0e2f1]">Reglas de enrutamiento:</strong> Reglas explícitas para asignar modelos específicos a tareas específicas.</li>
        </ul>
        <Tip>
          La estrategia &quot;Balanceado&quot; es la recomendada para uso general. Usa &quot;Costo primero&quot; si procesas
          alto volumen de planillas simples, y &quot;Calidad primero&quot; para auditorías complejas o multi-país.
        </Tip>
      </div>
    ),
  },
  {
    id: 'chat-ia',
    title: 'Chat con IA',
    icon: Zap,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          El panel lateral de chat con IA te permite interactuar directamente con los agentes de NóminaSmart
          en cualquier momento. Se abre desde el botón flotante en la esquina inferior derecha.
        </p>
        <SectionHeading>¿Qué puedes hacer?</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Hacer preguntas sobre normativa laboral de cualquier país soportado.</li>
          <li>Solicitar cálculos paso a paso (ej: &quot;¿Cómo se calcula el IBC en Colombia?&quot;).</li>
          <li>Pedir que analicen datos de nómina cargados.</li>
          <li>Solicitar correcciones o explicaciones de hallazgos.</li>
          <li>Gestionar reglas normativas (crear, editar, consultar).</li>
        </ul>
        <SectionHeading>¿Cómo funciona?</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Cuando envías un mensaje, Dianis (la directora) clasifica tu intención y decide qué agentes
          deben participar. Puede ser una consulta simple (solo Luni responde) o un análisis completo
          (Juli audita, Wil corrige, Ana redacta).
        </p>
        <SectionHeading>Acciones rápidas</SectionHeading>
        <p className="text-[#958da1] text-sm mb-2">
          El panel de bienvenida incluye botones de acciones rápidas que invocan directamente a agentes específicos
          sin necesidad de escribir un mensaje:
        </p>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li><strong className="text-[#e0e2f1]">🔄 Actualizar reglas normativas:</strong> Soul investiga cambios regulatorios y actualiza las reglas de todos los países.</li>
          <li><strong className="text-[#e0e2f1]">🔍 Auditar última nómina:</strong> Juli ejecuta las 14 verificaciones sobre la última planilla cargada.</li>
          <li><strong className="text-[#e0e2f1]">📋 Consultar normativa vigente:</strong> Luni responde con un resumen de la normativa laboral vigente.</li>
          <li><strong className="text-[#e0e2f1]">📝 Generar reporte ejecutivo:</strong> Ana redacta un reporte con hallazgos priorizados de la última auditoría.</li>
        </ul>
        <Tip>
          Las acciones rápidas son atajos para las tareas más comunes. Cada una invoca al agente especializado
          correspondiente con un prompt optimizado.
        </Tip>
        <SectionHeading>Tipos de interacción</SectionHeading>
        <div className="space-y-2 mt-2">
          {[
            { type: 'Chat', desc: 'Conversación libre con Luni sobre normativa laboral.' },
            { type: 'Validación', desc: 'Juli ejecuta verificaciones sobre datos cargados.' },
            { type: 'Mapeo', desc: 'Gyoru mapea columnas de archivos a campos estándar.' },
            { type: 'Corrección', desc: 'Wil propone correcciones numéricas.' },
            { type: 'Análisis completo', desc: 'Pipeline completo: mapeo → auditoría → corrección → reporte.' },
          ].map((i) => (
            <div key={i.type} className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 text-[#7C3AED] shrink-0 mt-1" />
              <p className="text-sm text-[#958da1]"><strong className="text-[#e0e2f1]">{i.type}:</strong> {i.desc}</p>
            </div>
          ))}
        </div>
        <Tip>
          El chat muestra en tiempo real qué agentes están trabajando, cuántos tokens consumen
          y la latencia de cada operación en el panel de logs en vivo.
        </Tip>
      </div>
    ),
  },
  {
    id: 'seguridad',
    title: 'Seguridad',
    icon: Shield,
    content: (
      <div>
        <p className="text-[#ccc3d8] leading-relaxed">
          NóminaSmart implementa múltiples capas de seguridad para proteger tus datos.
        </p>
        <SectionHeading>Cifrado de datos</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Las API keys de proveedores de IA se cifran con AES-256-GCM antes de almacenarse.</li>
          <li>Las contraseñas se gestionan a través de Supabase Auth con hashing seguro.</li>
          <li>Las comunicaciones se realizan sobre HTTPS.</li>
        </ul>
        <SectionHeading>Control de acceso</SectionHeading>
        <ul className="text-sm text-[#958da1] space-y-1 list-disc list-inside">
          <li>Autenticación basada en Supabase Auth (email + contraseña).</li>
          <li>Control de acceso basado en roles (RBAC) en middleware y API routes.</li>
          <li>Row Level Security (RLS) en PostgreSQL para aislamiento de datos por empresa.</li>
          <li>Rate limiting por IP para prevenir abuso de APIs.</li>
        </ul>
        <SectionHeading>Roles del sistema</SectionHeading>
        <div className="space-y-2 mt-2">
          {[
            { role: 'Administrador', perms: 'Acceso total: configuración, usuarios, finanzas, países, reglas, todas las empresas.' },
            { role: 'Analista', perms: 'Cargar nóminas, ejecutar auditorías, gestionar acciones, ver reportes de todas las empresas asignadas.' },
            { role: 'Cliente', perms: 'Solo lectura: ver reportes, estado de certificación y hallazgos de su propia empresa.' },
          ].map((r) => (
            <div key={r.role} className="bg-[#181b26] rounded-xl p-3 border border-[#4a4455]/10">
              <p className="text-sm font-semibold text-[#e0e2f1]">{r.role}</p>
              <p className="text-xs text-[#958da1] mt-1">{r.perms}</p>
            </div>
          ))}
        </div>
        <SectionHeading>Auditoría</SectionHeading>
        <p className="text-[#958da1] text-sm">
          Todas las acciones sobre reglas normativas quedan registradas en una bitácora de auditoría
          con retención de 5 años. Incluye: acción realizada, origen (usuario o sistema), fecha y hora.
        </p>
      </div>
    ),
  },
  {
    id: 'faq',
    title: 'Preguntas frecuentes',
    icon: HelpCircle,
    content: (
      <div>
        <div className="space-y-4">
          {[
            { q: '¿Necesito una API key para usar NóminaSmart?', a: 'Sí, necesitas al menos un proveedor de IA configurado con su API key. Recomendamos OpenRouter que ofrece modelos gratuitos como Gemini 2.5 Flash y DeepSeek V3.' },
            { q: '¿Qué formatos de archivo acepta?', a: 'Excel (.xlsx, .xls) y CSV. Puedes subir múltiples archivos a la vez. El sistema detecta automáticamente las hojas y el periodo.' },
            { q: '¿Puedo usar NóminaSmart para varios países?', a: 'Sí, la plataforma soporta Colombia, México, Perú, Chile, Brasil, Argentina y Estados Unidos. Las reglas normativas se cargan dinámicamente por país y año.' },
            { q: '¿Qué pasa si el proveedor de IA falla?', a: 'Si tienes múltiples proveedores configurados, el sistema automáticamente intenta con el siguiente en la lista de prioridad (fallback chain). Las verificaciones matemáticas funcionan sin IA.' },
            { q: '¿Mis datos están seguros?', a: 'Sí. Las API keys se cifran con AES-256-GCM, el acceso se controla por roles (RBAC), y los datos se aíslan por empresa con Row Level Security en PostgreSQL.' },
            { q: '¿Puedo exportar los resultados?', a: 'Sí, puedes exportar planillas corregidas a Excel y reportes financieros a CSV desde las páginas correspondientes.' },
            { q: '¿Cómo se actualizan las reglas normativas?', a: 'Puedes crear y editar reglas manualmente, o usar la sincronización regulatoria automática que investiga cambios normativos con el agente Soul.' },
            { q: '¿Qué significa "certificable"?', a: 'Una planilla es certificable cuando todos los campos obligatorios están mapeados, todos los cálculos requeridos están presentes y no hay hallazgos críticos sin resolver.' },
            { q: '¿Puedo cambiar el idioma?', a: 'Sí, la interfaz está disponible en Español, Inglés y Portugués. Cambia el idioma desde Configuración o el selector en la barra superior.' },
            { q: '¿Cuántos empleados puedo procesar?', a: 'Depende de tu plan. El plan Básico soporta hasta 50 empleados, el Profesional hasta 500, y el Empresarial es ilimitado.' },
          ].map((faq, i) => (
            <div key={i} className="bg-[#181b26] rounded-xl p-4 border border-[#4a4455]/10">
              <p className="text-sm font-semibold text-[#e0e2f1] mb-2">{faq.q}</p>
              <p className="text-sm text-[#958da1]">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

/* ── Componente principal ─────────────────────────────────────────── */

/**
 * Página del Manual de Usuario de NóminaSmart.
 *
 * Renderiza una guía completa con 13 secciones navegables:
 * Introducción, Agentes de IA, Dashboard, Carga de Nómina,
 * Reconciliación, Reportes, Reglas Normativas, Configuración,
 * Proveedores de IA, Administración, Chat con IA, Seguridad y FAQ.
 *
 * Incluye navegación lateral sticky en desktop y selector `<select>`
 * en móvil. El estado de sección activa se gestiona con `useState`.
 *
 * @returns Página pública del manual con layout de dos columnas.
 */
export default function ManualPage() {
  const [activeSection, setActiveSection] = useState('introduccion');
  const current = sections.find((s) => s.id === activeSection) ?? sections[0];

  return (
    <div className="relative">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#7C3AED]/[0.08] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] bg-[#10B981]/[0.06] rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <section className="pt-28 pb-12 px-6 text-center relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">
          Documentación
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">
          Manual de Usuario
        </h1>
        <p className="mt-5 text-[#958da1] max-w-2xl mx-auto text-lg font-[family-name:var(--font-inter)]">
          Guía completa para aprovechar al máximo NóminaSmart. Aprende a cargar nóminas,
          configurar agentes de IA, auditar planillas y generar reportes ejecutivos.
        </p>
      </section>

      {/* Content */}
      <section className="px-6 pb-32 relative">
        <div className="mx-auto max-w-6xl flex gap-8">
          {/* Sidebar navigation */}
          <nav className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a4455] mb-3 px-3">
                Contenido
              </p>
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-left ${
                      isActive
                        ? 'bg-[#7C3AED]/10 text-[#d2bbff]'
                        : 'text-[#958da1] hover:text-[#ccc3d8] hover:bg-[#1c1f2a]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {section.title}
                  </button>
                );
              })}
              <div className="mt-6 pt-4 border-t border-[#4a4455]/10">
                <Link
                  href={'/contact' as never}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#958da1] hover:text-[#4edea3] transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Solicitar demo
                </Link>
                <Link
                  href={'/pricing' as never}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#958da1] hover:text-[#4edea3] transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Ver planes
                </Link>
              </div>
            </div>
          </nav>

          {/* Mobile section selector */}
          <div className="lg:hidden w-full mb-6">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full px-4 py-3 bg-[#1c1f2a] border border-[#4a4455]/15 rounded-xl text-sm text-[#e0e2f1] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50"
              aria-label="Seleccionar sección del manual"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div
              className="bg-[#1c1f2a]/60 backdrop-blur-[12px] rounded-[1.5rem] p-8 sm:p-10"
              style={{ border: '1px solid rgba(74,68,85,0.10)' }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/15 flex items-center justify-center">
                  <current.icon className="w-5 h-5 text-[#d2bbff]" />
                </div>
                <h2 className="text-2xl font-bold text-[#e0e2f1]">{current.title}</h2>
              </div>
              {current.content}

              {/* Navigation between sections */}
              <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#4a4455]/10">
                {(() => {
                  const idx = sections.findIndex((s) => s.id === activeSection);
                  const prev = idx > 0 ? sections[idx - 1] : null;
                  const next = idx < sections.length - 1 ? sections[idx + 1] : null;
                  return (
                    <>
                      {prev ? (
                        <button
                          onClick={() => setActiveSection(prev.id)}
                          className="text-sm text-[#958da1] hover:text-[#d2bbff] transition-colors"
                        >
                          ← {prev.title}
                        </button>
                      ) : <span />}
                      {next ? (
                        <button
                          onClick={() => setActiveSection(next.id)}
                          className="text-sm text-[#958da1] hover:text-[#d2bbff] transition-colors"
                        >
                          {next.title} →
                        </button>
                      ) : <span />}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
