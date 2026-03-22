'use client';

import { ReactNode, useState } from 'react';
import { Zap, ArrowRight, Menu, X, Github, Twitter, Linkedin } from 'lucide-react';
import { Link, usePathname } from '@/i18n/routing';

const navLinks = [
  { href: '/' as const, label: 'Inicio' },
  { href: '/about' as const, label: 'Nosotros' },
  { href: '/pricing' as const, label: 'Precios' },
  { href: '/contact' as const, label: 'Contacto' },
];

const footerLinks = [
  { label: 'Producto', items: ['Auditoría IA', 'Multi-país', 'Reportes', 'API'] },
  { label: 'Empresa', items: ['Nosotros', 'Blog', 'Carreras', 'Prensa'] },
  { label: 'Legal', items: ['Privacidad', 'Términos', 'Seguridad', 'GDPR'] },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — Glassmorphism: surface_variant 40% + 20px blur, no border */}
      <header className="sticky top-0 z-50 bg-[#313440]/40 backdrop-blur-[20px]">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
          <Link href={'/' as never} className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)] group-hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-shadow">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[#e0e2f1] font-bold text-lg tracking-tight">NóminaSmart</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href as never}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-[#e0e2f1] bg-[#4a4455]/25'
                      : 'text-[#ccc3d8] hover:text-[#e0e2f1] hover:bg-[#4a4455]/15'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={'/login' as never}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all duration-200"
            >
              Iniciar sesión
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              className="md:hidden p-2 rounded-lg text-[#ccc3d8] hover:bg-[#4a4455]/20 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-[#363944]/90 backdrop-blur-[12px] px-6 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 rounded-lg text-sm font-medium text-[#ccc3d8] hover:text-[#e0e2f1] hover:bg-[#4a4455]/20 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={'/login' as never}
              onClick={() => setMobileOpen(false)}
              className="block mt-2 text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white"
            >
              Iniciar sesión
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer — Level 1 surface, no border-top, tonal shift */}
      <footer className="bg-[#181b26]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.3)]">
                  <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[#e0e2f1] font-bold tracking-tight">NóminaSmart</span>
              </div>
              <p className="text-[#958da1] text-sm leading-relaxed max-w-xs">
                Plataforma de auditoría de nómina con inteligencia artificial para empresas de Latinoamérica.
              </p>
              <div className="flex items-center gap-3 mt-6">
                <span className="w-8 h-8 rounded-lg bg-[#1c1f2a] flex items-center justify-center text-[#958da1] hover:text-[#d2bbff] hover:bg-[#262a35] cursor-pointer transition-all">
                  <Twitter className="w-4 h-4" />
                </span>
                <span className="w-8 h-8 rounded-lg bg-[#1c1f2a] flex items-center justify-center text-[#958da1] hover:text-[#d2bbff] hover:bg-[#262a35] cursor-pointer transition-all">
                  <Linkedin className="w-4 h-4" />
                </span>
                <span className="w-8 h-8 rounded-lg bg-[#1c1f2a] flex items-center justify-center text-[#958da1] hover:text-[#d2bbff] hover:bg-[#262a35] cursor-pointer transition-all">
                  <Github className="w-4 h-4" />
                </span>
              </div>
            </div>
            {footerLinks.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">{group.label}</p>
                <ul className="space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item}>
                      <span className="text-sm text-[#958da1] hover:text-[#e0e2f1] cursor-pointer transition-colors">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* No border-t, use spacing for separation */}
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[#4a4455] text-xs">© {new Date().getFullYear()} NóminaSmart · Auditoría inteligente de nómina</p>
            <div className="flex items-center gap-4 text-xs text-[#958da1]">
              <span className="hover:text-[#e0e2f1] cursor-pointer transition-colors">Privacidad</span>
              <span className="hover:text-[#e0e2f1] cursor-pointer transition-colors">Términos</span>
              <span className="hover:text-[#e0e2f1] cursor-pointer transition-colors">Seguridad</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
