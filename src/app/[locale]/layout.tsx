/**
 * Layout raíz para rutas localizadas ([locale]).
 *
 * Responsabilidades:
 * - Carga las fuentes tipográficas (Plus Jakarta Sans + Inter).
 * - Valida que el locale solicitado esté soportado; redirige a 404 si no.
 * - Provee el contexto de internacionalización (next-intl) a toda la app.
 * - Envuelve el contenido en el AppShell (Sidebar + Header).
 *
 * Metadata SEO: título y descripción en español reflejando la propuesta
 * de valor multi-país con agentes de IA especializados.
 */
import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import "../globals.css";
import AppShell from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

/** Fuente principal para títulos y UI. */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

/** Fuente secundaria para cuerpo de texto. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/** Metadata SEO global de la aplicación. */
export const metadata: Metadata = {
  title: "NominaSmart - Auditoría Inteligente de Nómina con IA",
  description: "Plataforma multi-país de auditoría de nómina con agentes de IA especializados. Detecta riesgos, corrige errores y genera reportes ejecutivos.",
};

/**
 * Layout raíz con soporte i18n.
 * @param children - Contenido de la página actual.
 * @param params - Parámetros de ruta; incluye `locale` (es | en | pt).
 * @returns Estructura HTML completa con providers de i18n y shell de la app.
 */
export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const availableLocales = routing.locales as readonly string[];

  if (!availableLocales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply theme class before first render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nominasmart-theme');var r=t==='light'?'light':t==='dark'?'dark':window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';document.documentElement.classList.add(r)}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className={`${jakarta.variable} ${inter.variable} antialiased font-sans bg-background text-foreground`}>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <AppShell>
              {children}
            </AppShell>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
