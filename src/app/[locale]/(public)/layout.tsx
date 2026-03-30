'use client';

/**
 * Layout público de NóminaSmart.
 *
 * Header sticky con glassmorphism, navegación responsive, selector de idioma,
 * y footer con enlaces, redes sociales y badge de seguridad.
 *
 * @module PublicLayout
 */

import { ReactNode, useState, useEffect } from 'react';
import { Zap, ArrowRight, Menu, X, Github, Twitter, Linkedin, Globe, ChevronDown } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';

/** Enlaces de navegación principal del header. */
const navLinks = [
  { href: '/' as const, label: 'Inicio' },
  { href: '/about' as const, label: 'Nosotros' },
  { href: '/pricing' as const, label: 'Precios' },
  { href: '/manual' as const, label: 'Manual' },
  { href: '/contact' as const, label: 'Contacto' },
];

/** Grupos de enlaces del footer organizados por categoría (Producto, Empresa, Legal). */
const footerLinks = [
  { label: 'Producto', items: [
    { text: 'Auditoría IA', href: '/pricing' },
    { text: 'Multi-país', href: '/about' },
    { text: 'Reportes', href: '/pricing' },
    { text: 'Manual', href: '/manual' },
  ]},
  { label: 'Empresa', items: [
    { text: 'Nosotros', href: '/about' },
    { text: 'Precios', href: '/pricing' },
    { text: 'Contacto', href: '/contact' },
  ]},
  { label: 'Legal', items: [
    { text: 'Privacidad', href: '/contact' },
    { text: 'Términos', href: '/contact' },
    { text: 'Seguridad', href: '/contact' },
  ]},
];

/** Etiquetas cortas para el selector de idioma del header. */
const localeLabels: Record<string, string> = {
  es: 'ES',
  en: 'EN',
  pt: 'PT',
};

/**
 * Layout compartido por todas las páginas públicas (sin autenticación).
 *
 * Incluye header sticky con glassmorphism y efecto de sombra al hacer scroll,
 * navegación responsive (desktop + menú mobile), selector de idioma (ES/EN/PT)
 * y footer con branding, redes sociales y enlaces legales.
 *
 * @param props.children - Contenido de la página pública renderizada dentro del layout.
 * @returns El layout público con header, contenido y footer.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Aplica sombra al header cuando el usuario hace scroll (> 20px)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  /**
   * Cambia el idioma activo y navega a la misma ruta en el nuevo locale.
   * @param newLocale - Código del idioma destino ('es' | 'en' | 'pt').
   */
  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as 'es' | 'en' | 'pt' });
    setLangOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* Header */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0b1326]/80 backdrop-blur-[20px] shadow-[0_1px_0_rgba(74,68,85,0.1)]'
          : 'bg-[#313440]/40 backdrop-blur-[20px]'
      }`}>
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
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-[#e0e2f1] bg-[#4a4455]/25'
                      : 'text-[#ccc3d8] hover:text-[#e0e2f1] hover:bg-[#4a4455]/15'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-[#7C3AED]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#958da1] hover:text-[#e0e2f1] hover:bg-[#4a4455]/15 transition-all"
                aria-label="Cambiar idioma"
              >
                <Globe className="w-3.5 h-3.5" />
                {localeLabels[locale] || 'ES'}
                <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-[#1c1f2a] backdrop-blur-[12px] rounded-xl py-1 min-w-[80px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" style={{ border: '1px solid rgba(74,68,85,0.15)' }}>
                    {Object.entries(localeLabels).map(([code, label]) => (
                      <button
                        key={code}
                        onClick={() => switchLocale(code)}
                        className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                          locale === code
                            ? 'text-[#7C3AED] font-semibold'
                            : 'text-[#ccc3d8] hover:text-[#e0e2f1] hover:bg-[#4a4455]/15'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

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

        {/* Mobile nav — animated slide */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-[#0b1326]/95 backdrop-blur-[16px] px-6 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as never}
                className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-[#e0e2f1] bg-[#4a4455]/25'
                    : 'text-[#ccc3d8] hover:text-[#e0e2f1] hover:bg-[#4a4455]/20'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={'/login' as never}
              className="block mt-3 text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-[#0b1326] relative">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C3AED]/20 to-transparent" />
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
                {[
                  { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
                  { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
                  { icon: Github, href: 'https://github.com/Shiroe-95/NominaApp', label: 'GitHub' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-9 h-9 rounded-lg bg-[#181b26] flex items-center justify-center text-[#958da1] hover:text-[#d2bbff] hover:bg-[#262a35] hover:shadow-[0_0_12px_rgba(124,58,237,0.15)] transition-all duration-200"
                  >
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>

              {/* Trust badge */}
              <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181b26] text-xs text-[#4edea3]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse" />
                Datos cifrados · SOC 2
              </div>
            </div>
            {footerLinks.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">{group.label}</p>
                <ul className="space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item.text}>
                      <Link href={item.href as never} className="text-sm text-[#958da1] hover:text-[#e0e2f1] transition-colors">{item.text}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[#4a4455] text-xs">© {new Date().getFullYear()} NóminaSmart · Auditoría inteligente de nómina</p>
            <div className="flex items-center gap-4 text-xs text-[#958da1]">
              <Link href={'/contact' as never} className="hover:text-[#e0e2f1] transition-colors">Privacidad</Link>
              <Link href={'/contact' as never} className="hover:text-[#e0e2f1] transition-colors">Términos</Link>
              <Link href={'/contact' as never} className="hover:text-[#e0e2f1] transition-colors">Seguridad</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
