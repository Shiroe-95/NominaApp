# 🚀 Guía de Configuración - NóminaSmart

## ¡No está ejecutando? Sigue estos pasos:

### 1. Instalar Dependencias
```bash
npm install
```
Este paso es **crítico**. Sin las dependencias, el proyecto no puede ejecutarse.

### 2. Configurar Variables de Entorno
Copia el archivo `.env.local.example` a `.env.local` y rellena con tus credenciales:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` con:
```ini
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon
SUPABASE_SERVICE_ROLE_KEY=tu_clave_service_role
```

### 3. Obtener Credenciales de Supabase
1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto o usa uno existente
3. En Settings → API, copia:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon Public Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Inicializar Base de Datos (Opcional)
```bash
node scripts/setup-db.mjs
```
Esto crea las tablas necesarias en Supabase.

### 5. Ejecutar en Desarrollo
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

#### Idiomas Soportados:
- **Español (predeterminado):** http://localhost:3000/es
- **Inglés:** http://localhost:3000/en

### 6. Credenciales de Demostración (si aplica)
Para probar sin Supabase:
- Email: `demo@empresa.com`
- Contraseña: `Demo123!`

---

## Troubleshooting

### Error: "Cannot find module '@supabase/ssr'"
**Solución:** Ejecuta `npm install`

### Error: "NEXT_PUBLIC_SUPABASE_URL is not defined"
**Solución:** Copia `.env.local.example` a `.env.local` y completa los valores

### Puerto 3000 ya en uso
**Solución:** 
```bash
npm run dev -- -p 3001
```
O mata el proceso anterior:
```bash
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows
```

### Build fail: "Unexpected token"
**Solución:** Asegúrate de estar usando Node v20+
```bash
node --version
```

---

## Desarrollo Rápido

### Estructura del Proyecto
```
src/
├── app/[locale]/          # Páginas por idioma
│   ├── page.tsx          # Dashboard
│   ├── login/            # Login
│   ├── upload/           # Cargar nómina
│   ├── reconcile/        # Reconciliación
│   ├── reports/          # Reportes
│   └── rules/            # Configurar reglas
├── components/
│   ├── layout/           # Header, Sidebar
│   └── ui/               # Componentes reutilizables
├── lib/
│   ├── supabase/         # Clientes Supabase
│   ├── payroll/          # Lógica de negocio
│   └── db/               # Schemas y queries
└── middleware.ts         # Autenticación & i18n
```

### Comandos Útiles
```bash
npm run dev              # Iniciar servidor desarrollo
npm run build            # Build producción
npm run lint             # Verificar código
node scripts/setup-db.mjs  # Crear tablas BD
```

---

## Próximos Pasos

1. ✅ Instalar dependencias (`npm install`)
2. ✅ Configurar `.env.local` con Supabase
3. ✅ Ejecutar `npm run dev`
4. 📋 Ir a `http://localhost:3000/es` o `/en`
5. 🔐 Iniciar sesión (o registrarse si está habilitado)
6. 📊 Explorar el dashboard

---

**¿Necesitas ayuda?** Revisa `FUNCIONAL_STATUS.md` para más detalles sobre características implementadas.
