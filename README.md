<div align="center">
  <img src="https://img.icons8.com/color/144/artificial-intelligence.png" alt="Nomina Smart Logo" width="120" />
  
  # 🧠 Nomina Smart
  
  **Plataforma Avanzada de Auditoría, Validación y Conciliación de Nómina con Inteligencia Artificial**

  <p align="center">
    <a href="#-características">Características</a> •
    <a href="#-arquitectura">Arquitectura</a> •
    <a href="#-tecnologías">Tecnologías</a> •
    <a href="#-guía-de-inicio">Inicio Rápido</a>
  </p>

  ![Status](https://img.shields.io/badge/Estado-Activo-success?style=for-the-badge)
  ![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)
  ![React](https://img.shields.io/badge/React-19.2-00d8ff?style=for-the-badge&logo=react)
  ![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?style=for-the-badge&logo=supabase)
  ![OpenAI](https://img.shields.io/badge/AI-OpenAI%20/%20Anthropic-blue?style=for-the-badge&logo=openai)
</div>

---

## 🎯 ¿Qué es Nomina Smart?

**Nomina Smart** revoluciona el proceso de auditoría salarial. Realiza una verificación de **"Triple Match"**, cruzando inteligentemente información entre:

1. 💼 **Nómina Interna** (Archivos fuente extraídos desde tu ERP).
2. 🏛️ **Pago PILA** (Planilla Integrada de Liquidación de Aportes).
3. ⚖️ **Estándar UGPP** (Cálculo normativo oficial y regulatorio).

El sistema utiliza algoritmos impulsados por Inteligencia Artificial para inferir mapeos automáticos de datos atípicos, detectar inconsistencias críticas, calcular el **Nivel de Riesgo por Empleado**, sugerir reparaciones proactivas y gestionar hallazgos a través de un moderno panel colaborativo para equipos de Recursos Humanos y Auditoría.

---

## ✨ Características Principales

<table>
  <tr>
    <td width="50%">
      <h3>🔍 Reconciliador "Triple Match"</h3>
      <p>Compara múltiples fuentes de datos. El motor analiza el cumplimiento de las bases de cotización. Cruza diferencias en fórmulas (Ej. Ley 1393) de manera heurística, evitando falsos positivos comunes en auditorías manuales.</p>
    </td>
    <td width="50%">
      <h3>🤖 Mapping Inteligente con IA</h3>
      <p>Sube Excels de distintos ERPs. La IA infiere qué columnas representan el Sueldo Base, Auxilio de Transporte o Días Laborados basándose en "fuzzy matching", acoplándose al vocabulario único de tu empresa.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📈 Tablero Ejecutivo (Dashboard)</h3>
      <p>Visualiza el estado global de la nómina con métricas clave como: <strong>Tasa de Certificación</strong>, <strong>Riesgo Promedio</strong>, <strong>Hallazgos</strong>, y el impacto correctivo según filtros precisos (País, Empresa, Año).</p>
    </td>
    <td width="50%">
      <h3>🛠️ Matriz de Resoluciones</h3>
      <p>No solo detecta el error; sugiere la solución. Acciona un flujo de trabajo para que el analista "Asigne", "Priorice" y "Cierre" los casos (Tickets), manteniendo una traza histórica y de cumplimiento totalmente auditable.</p>
    </td>
  </tr>
</table>

### 🌍 Internacionalización Completa (i18n)
La plataforma es totalmente multilenguaje (*Inglés/Español*). Todo el enrutamiento (ej. `/es/reconcile` vs `/en/reconcile`) de menús, reportes, alertas IA, y el propio motor se adaptan al país o rol de operador.

---

## 💻 Tecnologías (Tech Stack)

Esta plataforma ha sido construida con lo último en desarrollo Fullstack Server-Side Rendering (SSR).

* **Frontend:**
  * ⚛️ **React 19** & **Next.js 16 (App Router)**: Velocidad extrema con *Turbopack*.
  * 🎨 **Tailwind CSS** + **Lucide React** + **Tailwind Merge**: Interfaz limpia, responsiva y orientada a diseño utilitario.
  * 📊 **Recharts**: Creación de gráficos ejecutivos históricos fluidos.

* **Backend & APIs:**
  * 🐘 **Supabase (PostgreSQL)**: DB Transaccional de alto rendimiento para guardar matrices de auditoría gigantes vía SSR.
  * 🧠 **Anthropic / OpenAI SDK**: LLMs dedicados al mapeo de campos, generación de texto de acción correctiva y alertas lógicas.

* **Herramientas Core:**
  * 🌐 **next-intl**: Gestión rigurosa para rutas y diccionarios estáticos de idiomas.
  * 📐 **XLSX**: Manejo seguro y rápido en memoria de Sabanas (hojas de cálculo) pesadas en JS/TS.

---

## 📂 Arquitectura del Proyecto

```markdown
📦 nomina-smart
 ┣ 📂 messages/         # 🌍 Diccionarios Multi-Idioma (es.json, en.json)
 ┣ 📂 src/
 ┃ ┣ 📂 app/
 ┃ ┃ ┣ 📂 [locale]/     # 🛡️ Rutas con enrutador de lenguaje
 ┃ ┃ ┃ ┣ 📂 reconcile/  # ➡️ Pantalla de Validación IA Inmediata
 ┃ ┃ ┃ ┣ 📂 reports/    # ➡️ Panel de Reportes Históricos Consolidados
 ┃ ┃ ┃ ┗ 📂 upload/     # ➡️ Ingesta de Nómina con Carga Automática
 ┃ ┃ ┗ 📂 api/          # ⚙️ Endpoints Serverless (Supabase Admin, OpenAI)
 ┃ ┣ 📂 components/
 ┃ ┃ ┗ 📂 ui/           # 🧩 Componentes reutilizables (Dashboard, Editor)
 ┃ ┣ 📂 i18n/           # 🌐 Configurador nativo de idioma
 ┃ ┣ 📂 lib/            # 🧠 Lógicas de Motor: ruleValidation.ts, db, utils
 ┃ ┗ 📜 middleware.ts   # 🚦 Interceptor y balanceador de idioma principal
 ┣ 📜 package.json
 ┗ 📜 tailwind.config.ts
```

---

## � Guía de Inicio Rápido

### 1. Prerrequisitos
- 🟢 **Node.js** V20+ y NPM instalados.
- 🔑 Keys de validación para **Supabase** y **OpenAI / Anthropic**.

### 2. Instalación

Clona el repositorio e instala los paquetes:

```bash
git clone https://github.com/usuario/NominaApp.git
cd NominaApp
npm install
```

### 3. Variables de Entorno

Duplica `.env.example` o configura `.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
```

### 4. Lanzamiento de Entornos

Para correr el proyecto en modo **Desarrollo**:

```bash
# Servidor local (Normalmente arranca en http://localhost:3000)
npm run dev
```

Para ensamblar la versión en modo **Producción**:

```bash
npm run build
npm start
```

---

## 💡 ¿Cómo funciona una Auditoría en Vivo?

1. 📥 **Carga y Mapeo**: Ve a `/upload`, carga el dataset original (Excel). La Inteligencia Artificial intentará catalogar tus columnas de "Sueldo", "Prestaciones", etc.
2. 🔬 **Análisis Normativo**: Salta al módulo **Reconciliador**, donde el motor revisará, fila a fila, violaciones de leyes fiscales (Ej: Límite del 40% Ley 1393 para salarios).
3. 📝 **Gestión Accionable**: En la visual, da click en un error y pulsa **Asignar Acción** a un equipo contable, transformando un caos de datos en Tareas Operativas concretas.
4. 📊 **Ecosistema**: Ingresa al **Dashboard** principal y mira tu *Scoring de Salud de Nómina* subir a medida que mitigas los riesgos de la organización.
