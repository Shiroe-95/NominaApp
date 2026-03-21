'use client';

import {
  Zap,
  ShieldCheck,
  BarChart3,
  Brain,
  Globe,
  ArrowRight,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

const benefits = [
  {
    icon: ShieldCheck,
    title: 'Cumplimiento UGPP garantizado',
    description:
      'Valida automáticamente 14 verificaciones normativas colombianas incluyendo IBC, Ley 1393 y aportes.',
  },
  {
    icon: Brain,
    title: 'Agentes de IA especializados',
    description:
      'Auditor, Corrector, Redactor y Mapeador trabajan en equipo para analizar tu nómina con precisión.',
  },
  {
    icon: BarChart3,
    title: 'Reportes ejecutivos instantáneos',
    description:
      'Genera reportes narrativos con hallazgos priorizados, referencias normativas y recomendaciones.',
  },
  {
    icon: Globe,
    title: 'Multi-país y multi-moneda',
    description:
      'Soporta nóminas de Colombia, México, Perú, Chile, Brasil y más con reglas normativas por país.',
  },
];

const features = [
  'Mapeo inteligente de columnas Excel con IA',
  'Correcciones numéricas con fórmulas normativas',
  'Pipeline guiado paso a paso',
  'Múltiples proveedores de IA con fallback automático',
  'Dashboard con métricas de riesgo en tiempo real',
  'Cifrado de datos y API keys',
];

const testimonials = [
  {
    name: 'María González',
    role: 'Directora de RRHH',
    company: 'TechCorp Colombia',
    quote:
      'NóminaSmart redujo nuestro tiempo de auditoría de 3 días a 15 minutos. Los hallazgos son precisos y los reportes impecables.',
    rating: 5,
  },
  {
    name: 'Carlos Ramírez',
    role: 'Contador Senior',
    company: 'Grupo Financiero Andino',
    quote:
      'La detección automática de inconsistencias en IBC y aportes nos ha evitado sanciones de la UGPP en múltiples ocasiones.',
    rating: 5,
  },
  {
    name: 'Ana Martínez',
    role: 'Gerente de Nómina',
    company: 'Industrias del Pacífico',
    quote:
      'El mapeo inteligente de columnas es increíble. Subimos archivos de cualquier formato y el sistema los entiende al instante.',
    rating: 5,
  },
];

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-28 px-6">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet/15 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 mb-8">
            <Zap className="w-4 h-4 text-emerald-light" />
            Plataforma de auditoría de nómina con IA
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Audita tu nómina con{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-light to-violet-light">
              inteligencia artificial
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Detecta inconsistencias, garantiza cumplimiento UGPP y genera reportes ejecutivos
            en minutos. Agentes de IA especializados trabajan en equipo para analizar cada
            registro de tu nómina.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={'/login' as never}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-violet to-violet-dark text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)] hover:-translate-y-0.5 transition-all duration-200 border border-white/10"
            >
              Comenzar gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href={'/contact' as never}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-medium glass-panel text-slate-200 hover:bg-white/10 hover:border-violet/50 transition-all duration-200"
            >
              Solicitar demo
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">
              ¿Por qué elegir NóminaSmart?
            </h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Tecnología de punta para simplificar la auditoría de nómina más compleja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit) => (
              <div
                key={benefit.title}
                className="glass-panel rounded-2xl p-8 hover:border-violet/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet/20 to-emerald/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <benefit.icon className="w-6 h-6 text-violet-light" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">
              Todo lo que necesitas para auditar nómina
            </h2>
            <p className="mt-3 text-slate-400">
              Funcionalidades diseñadas para equipos de RRHH, contadores y auditores.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-start gap-3 p-4 rounded-xl hover:bg-white/5 transition-colors"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-light mt-0.5 shrink-0" />
                <span className="text-slate-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">
              Lo que dicen nuestros clientes
            </h2>
            <p className="mt-3 text-slate-400">
              Empresas que ya confían en NóminaSmart para su auditoría de nómina.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="glass-panel rounded-2xl p-6 flex flex-col"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber fill-amber" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 pt-4 border-t border-white/5">
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-slate-500 text-xs">
                    {t.role} · {t.company}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Empieza a auditar tu nómina hoy
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Únete a cientos de empresas que ya usan NóminaSmart para garantizar el
            cumplimiento normativo de su nómina.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={'/login' as never}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-emerald to-emerald-dark text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 transition-all duration-200 border border-white/10"
            >
              Crear cuenta gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href={'/pricing' as never}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-medium glass-panel text-slate-200 hover:bg-white/10 transition-all duration-200"
            >
              Ver planes y precios
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
