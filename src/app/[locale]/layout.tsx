import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import "../globals.css";
import AppShell from '@/components/layout/AppShell';

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NóminaSmart - Payroll Audit & UGPP Compliance",
  description: "Automated payroll auditing and UGPP compliance SaaS in Colombia.",
};

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
    <html lang={locale}>
      <body className={`${jakarta.variable} antialiased font-sans bg-background text-foreground`}>
        <NextIntlClientProvider messages={messages}>
          <AppShell>
            {children}
          </AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
