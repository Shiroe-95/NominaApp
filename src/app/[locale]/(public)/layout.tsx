'use client';

import { ReactNode } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';

const navLinks = [
  { href: '/' as const, label: 'Inicio' },
  { href: '/pricing' as const, label: 'Precios' },
  { href: '/contact' as const, label: 'Contacto' },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Public Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/5">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
          {/* Logo */}
          <Link href={'/' as never} className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald to-violet rounded-xl flex items-center justify-center shadow-lg">
              <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">NóminaSmart</span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href as never}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-white bg-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Login CTA */}
          <Link
            href={'/login' as never}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-violet to-violet-dark text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] hover:-translate-y-0.5 transition-all duration-150 border border-white/10"
          >
            Iniciar sesión
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald to-violet rounded-lg flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-slate-400 text-sm font-medium">NóminaSmart</span>
            </div>
            <p className="text-slate-600 text-xs">
              © {new Date().getFullYear()} NóminaSmart · Auditoría de nómina con inteligencia artificial
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
