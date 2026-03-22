'use client';

import {
  Zap, ShieldCheck, BarChart3, Brain, Globe, ArrowRight,
  CheckCircle2, Star, Sparkles, TrendingUp, Users, Activity,
} from 'lucide-react';
import { Link } from '@/i18n/routing';

const benefits = [
  {
    icon: ShieldCheck,
    title: 'Cumplimiento UGPP garantizado',
    description: 'Valida automáticamente 14 verificaciones normativas colombianas incluyendo IBC, Ley 1393 y aportes.',
    iconColor: 'text-[#4edea3]',
    glowColor: 'rgba(16,185,129,0.2)',
  },
  {
    icon: Brain,
    title: 'Agentes de IA especializados',
    description: 'Auditor, Corrector, Redactor y Mapeador trabajan en equipo para analizar tu nómina con precisión.',
    iconColor: 'text-[#d2bbff]',
    glowColor: 'rgba(124,58,237,0.2)',
  },
  {
    icon: BarChart3,
    title: 'Reportes ejecutivos instantáneos',
    description: 'Genera reportes narrativos con hallazgos priorizados, referencias normativas y recomendaciones.',
    iconColor: 'text-[#4cd7f6]',
    glowColor: 'rgba(6,182,212,0.2)',
  },
  {
    icon: Globe,
    title: 'Multi-país y multi-moneda',
    description: 'Soporta nóminas de Colombia, México, Perú, Chile, Brasil y más con reglas normativas por país.',
    iconColor: 'text-[#ffb3b6]',
    glowColor: 'rgba(225,29,72,0.2)',
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
    quote: 'NóminaSmart redujo nuestro tiempo de auditoría de 3 días a 15 minutos. Los hallazgos son precisos y los reportes impecables.',
    rating: 5,
  },
  {
    name: 'Carlos Ramírez',
    role: 'Contador Senior',
    company: 'Grupo Financiero Andino',
    quote: 'La detección automática de inconsistencias en IBC y aportes nos ha evitado sanciones de la UGPP en múltiples ocasiones.',
    rating: 5,
  },
  {
    name: 'Ana Martínez',
    role: 'Gerente de Nómina',
    company: 'Industrias del Pacífico',
    quote: 'El mapeo inteligente de columnas es increíble. Subimos archivos de cualquier formato y el sistema los entiende al instante.',
    rating: 5,
  },
];

const metrics = [
  { label: 'Riesgo UGPP', value: '4.2%', icon: ShieldCheck, trend: '↓ 12%' },
  { label: 'Cumplimiento', value: '98.7%', icon: TrendingUp, trend: '↑ 3.1%' },
  { label: 'Empleados', value: '1,247', icon: Users, trend: '↑ 89' },
  { label: 'Auditorías', value: '342', icon: Activity, trend: '↑ 28' },
];

export default function LandingPage() {
  return (
    <div className="relative">
      {/* Hero — Asymmetric layout, weighted left */}
      <section className="relative overflow-hidden pt-28 pb-36 px-6">
        {/* Level 0 radial glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[#7C3AED]/[0.15] rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#10B981]/[0.15] rounded-full blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          {/* Intentional asymmetry: large text anchored left */}
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1c1f2a] text-sm text-[#ccc3d8] mb-8 backdrop-blur-[12px]">
              <Sparkles className="w-4 h-4 text-[#4edea3]" />
              Plataforma de auditoría de nómina con IA
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[#e0e2f1] leading-[1.05] tracking-[-0.03em]">
              Audita tu nómina con{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#4edea3] via-[#4cd7f6] to-[#d2bbff]" style={{ backgroundImage: 'linear-gradient(135deg, #4edea3, #d2bbff)' }}>
                inteligencia artificial
              </span>
            </h1>

            <p className="mt-8 text-lg text-[#958da1] max-w-xl leading-relaxed font-[family-name:var(--font-inter)]">
              Detecta inconsistencias, garantiza cumplimiento UGPP y genera reportes ejecutivos
              en minutos. Agentes de IA especializados trabajan en equipo para analizar cada
              registro de tu nómina.
            </p>

            <div className="mt-12 flex flex-col sm:flex-row items-start gap-4">
              <Link
                href={'/login' as never}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all duration-200"
              >
                Comenzar gratis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href={'/contact' as never}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35] transition-all duration-200"
              >
                Solicitar demo
              </Link>
            </div>
          </div>

          {/* Floating dashboard preview — Glass Card */}
          <div className="mt-20 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#7C3AED]/15 via-transparent to-[#10B981]/15 rounded-3xl blur-xl" />
            <div className="relative bg-[#1c1f2a]/80 backdrop-blur-[12px] rounded-[1.5rem] p-6" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-[#E11D48]/60" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                <div className="w-3 h-3 rounded-full bg-[#10B981]/60" />
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">NóminaSmart Dashboard</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metrics.map((m) => (
                  <div key={m.label} className="bg-[#181b26] rounded-[1rem] p-5 hover:bg-[#262a35] transition-colors duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">{m.label}</span>
                      <m.icon className="w-4 h-4 text-[#d2bbff]" />
                    </div>
                    <p className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">{m.value}</p>
                    <span className="text-xs text-[#4edea3] font-medium mt-1 inline-block">{m.trend}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits — Glass Cards with ambient glow on hover */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">Ventajas</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">¿Por qué elegir NóminaSmart?</h2>
            <p className="mt-4 text-[#958da1] max-w-xl mx-auto font-[family-name:var(--font-inter)]">
              Tecnología de punta para simplificar la auditoría de nómina más compleja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="group relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 hover:bg-[#313440] transition-all duration-300"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl bg-[#181b26] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: `0 0 8px ${b.glowColor}` }}
                >
                  <b.icon className={`w-6 h-6 ${b.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold text-[#e0e2f1] mb-2">{b.title}</h3>
                <p className="text-[#958da1] text-sm leading-relaxed font-[family-name:var(--font-inter)]">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — No borders, spacing-based separation */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d2bbff] mb-4">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">
              Todo lo que necesitas para auditar nómina
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 p-4 rounded-[1rem] hover:bg-[#1c1f2a]/60 transition-colors duration-200">
                <CheckCircle2 className="w-5 h-5 text-[#4edea3] mt-0.5 shrink-0" />
                <span className="text-[#ccc3d8] text-sm font-[family-name:var(--font-inter)]">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — Glass cards, no divider lines */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">Testimonios</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">Lo que dicen nuestros clientes</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-7 flex flex-col hover:bg-[#313440] transition-all duration-300"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-[#ccc3d8] text-sm leading-relaxed flex-1 font-[family-name:var(--font-inter)]">&ldquo;{t.quote}&rdquo;</p>
                {/* No border-t, use spacing */}
                <div className="mt-6 pt-0">
                  <p className="text-[#e0e2f1] text-sm font-semibold">{t.name}</p>
                  <p className="text-[#4cd7f6] text-xs mt-0.5">{t.role} · {t.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Gradient button with ambient glow */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">Empieza a auditar tu nómina hoy</h2>
          <p className="mt-5 text-[#958da1] max-w-xl mx-auto font-[family-name:var(--font-inter)]">
            Únete a cientos de empresas que ya usan NóminaSmart para garantizar el cumplimiento normativo.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={'/login' as never}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-[#10B981] to-[#047857] text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 transition-all duration-200"
            >
              Crear cuenta gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href={'/pricing' as never}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35] transition-all duration-200"
            >
              Ver planes y precios
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
