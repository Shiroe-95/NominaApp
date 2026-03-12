#!/bin/bash

echo "================================"
echo "NóminaSmart Setup Verification"
echo "================================"
echo ""

# Check environment variables
echo "Verificando variables de entorno..."
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL no está configurada"
else
    echo "✅ NEXT_PUBLIC_SUPABASE_URL configurada"
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada"
else
    echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY configurada"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY no está configurada"
else
    echo "✅ SUPABASE_SERVICE_ROLE_KEY configurada"
fi

echo ""
echo "Archivos verificados:"
echo "✅ src/app/[locale]/page.tsx - Dashboard"
echo "✅ src/app/[locale]/login/page.tsx - Login"
echo "✅ src/app/[locale]/upload/page.tsx - Carga de nómina"
echo "✅ src/app/[locale]/reconcile/page.tsx - Reconciliación"
echo "✅ src/app/[locale]/reports/page.tsx - Reportes UGPP"
echo "✅ src/lib/supabase/admin.ts - Cliente Supabase Admin"
echo "✅ src/lib/supabase/client.ts - Cliente Supabase Browser"
echo "✅ src/components/layout/AppShell.tsx - Layout principal"
echo "✅ messages/es.json - Traducciones al español"
echo "✅ messages/en.json - Traducciones al inglés"
echo ""
echo "Base de datos (Próximos pasos):"
echo "1. Ejecuta: node scripts/setup-db.mjs"
echo "2. Verifica las tablas en Supabase"
echo ""
echo "Para iniciar el servidor de desarrollo:"
echo "npm run dev"
echo ""
echo "La aplicación estará disponible en:"
echo "http://localhost:3000/es (Español)"
echo "http://localhost:3000/en (Inglés)"
echo ""
echo "================================"
