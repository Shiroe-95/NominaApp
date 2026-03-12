# ⚠️ IMPORTANTE: Cómo Ejecutar el Proyecto

## El Problema

El proyecto **NO está ejecutando automáticamente** en v0 preview porque:
1. Las dependencias (`node_modules`) no están instaladas
2. Las variables de entorno no están configuradas
3. El servidor dev no se ha iniciado

## La Solución (3 pasos simples)

### Paso 1: Instalar Dependencias
Abre una terminal en el directorio del proyecto y ejecuta:
```bash
npm install
```
**¿Qué hace?** Descarga todas las librerías necesarias (Supabase, Next.js, React, etc.)
**Tiempo:** ~2-3 minutos

### Paso 2: Configurar Supabase
1. Ve a [supabase.com](https://supabase.com) (es gratis)
2. Crea una nueva cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Ve a **Settings → API**
5. Copia estos valores:
   - **Project URL**
   - **Anon Public Key**
   - **Service Role Key**

6. Abre el archivo `.env.local` en el proyecto
7. Pega los valores:
```ini
NEXT_PUBLIC_SUPABASE_URL=<Project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Anon Public Key>
SUPABASE_SERVICE_ROLE_KEY=<Service Role Key>
```

### Paso 3: Ejecutar
```bash
npm run dev
```
**Resultado:** El servidor estará disponible en `http://localhost:3000/es`

---

## ¿Ya Completaste los Pasos?

Si ya ejecutaste `npm install` y configuraste `.env.local`:

**Opción A: En Terminal Local**
```bash
cd /ruta/al/proyecto
npm run dev
# Abre http://localhost:3000/es en tu navegador
```

**Opción B: En v0 Preview**
- El preview debería mostrar la aplicación automáticamente
- Si no funciona, recarga la página (F5)

---

## Verificar Instalación

```bash
# Verifica que npm esté instalado
npm --version

# Verifica Node v20+
node --version

# Verifica que dependencias están instaladas
ls node_modules | head -5  # Linux/Mac
dir node_modules | head -5  # Windows
```

---

## Si Algo Falla

**Error: "Cannot find module"**
→ Ejecuta `npm install`

**Error: "Supabase URL not found"**
→ Edita `.env.local` con tus credenciales

**Puerto 3000 en uso**
→ `npm run dev -- -p 3001`

**Más ayuda:** Lee `SETUP.md`

---

## Archivos Importantes

| Archivo | Propósito |
|---------|-----------|
| `.env.local` | Tus credenciales Supabase (crear copiando `.env.local.example`) |
| `package.json` | Lista de dependencias |
| `SETUP.md` | Guía detallada de instalación |
| `FUNCIONAL_STATUS.md` | Features implementadas |

---

## ¡Ya Está Listo!

Una vez ejecutes `npm run dev`, tendrás acceso a:
- 📊 **Dashboard:** Visualización de nóminas
- 📤 **Upload:** Cargar archivos Excel
- 🔍 **Reconcile:** Validación con IA
- 📋 **Reports:** Generación de reportes
- 🌍 **Multilenguaje:** ES/EN

¡Disfruta! 🚀
