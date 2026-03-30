'use client';

/**
 * Landing page principal de NóminaSmart.
 *
 * Página pública (sin autenticación) que presenta la propuesta de valor
 * de la plataforma. Incluye las siguientes secciones:
 * - Hero con CTA y social proof
 * - Preview del dashboard con métricas simuladas
 * - Barra de empresas que confían en la plataforma
 * - Estadísticas clave (empleados, países, precisión, tiempo)
 * - Galería del equipo de 7 agentes de IA
 * - Beneficios principales (cumplimiento, agentes, reportes, multi-país)
 * - Flujo de trabajo en 4 pasos con avatares de agentes
 * - Checklist de funcionalidades
 * - Testimonios de clientes
 * - CTA final de conversión
 *
 * @module LandingPage
 */

import {
  Zap, ShieldCheck, BarChart3, Brain, Globe, ArrowRight,
  CheckCircle2, Star, Sparkles, TrendingUp, Users, Activity,
  Clock, Building2, MapPin,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { AGENT_PERSONAS } from '@/lib/ai/agent-personas';

/** Tarjetas de beneficios principales mostradas en la sección "¿Por qué elegir NominaSmart?". */
const benefits = [
  {
    icon: ShieldCheck,
    title: 'Cumplimiento normativo multi-país',
    description: 'Valida automáticamente reglas laborales de Colombia, México, Perú, Chile, Brasil, Argentina y más.',
    iconColor: 'text-[#4edea3]',
    glowColor: 'rgba(16,185,129,0.2)',
  },
  {
    icon: Brain,
    title: '7 agentes de IA especializados',
    description: 'Dianis coordina, Juli audita, Wil corrige, Ana redacta, Gyoru mapea, Luni consulta normas y Soul investiga cambios regulatorios.',
    iconColor: 'text-[#d2bbff]',
    glowColor: 'rgba(124,58,237,0.2)',
  },
  {
    icon: BarChart3,
    title: 'Reportes ejecutivos instantáneos',
    description: 'Genera reportes narrativos con hallazgos priorizados, referencias normativas y recomendaciones accionables.',
    iconColor: 'text-[#4cd7f6]',
    glowColor: 'rgba(6,182,212,0.2)',
  },
  {
    icon: Globe,
    title: 'Multi-país y multi-moneda',
    description: 'Una sola plataforma para todas tus operaciones de nómina en Latinoamérica y más allá.',
    iconColor: 'text-[#ffb3b6]',
    glowColor: 'rgba(225,29,72,0.2)',
  },
];

/** Lista de funcionalidades clave mostradas como checklist con iconos de verificación. */
const features = [
  'Mapeo inteligente de columnas Excel con IA',
  'Correcciones numéricas con fórmulas normativas',
  'Pipeline guiado paso a paso con agentes visibles',
  'Múltiples proveedores de IA con fallback automático',
  'Dashboard con métricas de riesgo en tiempo real',
  'Cifrado de datos y API keys',
];

/** Testimonios de clientes con nombre, cargo, empresa, cita y calificación (estrellas). */
const testimonials = [
  {
    name: 'Lo que podrás lograr',
    role: 'Auditoría automatizada',
    company: 'Tu empresa',
    quote: 'Imagina reducir tu tiempo de auditoría de nómina de días a minutos, con agentes de IA que detectan errores que el ojo humano pasa por alto.',
    rating: 5,
    avatar: '🎯',
  },
  {
    name: 'Cumplimiento garantizado',
    role: 'Normativa colombiana',
    company: 'UGPP · DIAN · MinTrabajo',
    quote: 'NominaSmart valida tu nómina contra la normativa laboral vigente: aportes a seguridad social, retención en la fuente, prestaciones y más.',
    rating: 5,
    avatar: '🛡️',
  },
  {
    name: 'Reportes ejecutivos',
    role: 'Listos para gerencia',
    company: 'En minutos, no días',
    quote: 'Genera reportes narrativos con hallazgos priorizados, referencias normativas y recomendaciones accionables para presentar a la junta directiva.',
    rating: 5,
    avatar: '📊',
  },
];

/** Métricas simuladas del dashboard preview en el hero (riesgo, cumplimiento, empleados, auditorías). */
const metrics = [
  { label: 'Riesgo Promedio', value: '4.2%', icon: ShieldCheck, trend: '↓ 12%' },
  { label: 'Cumplimiento', value: '98.7%', icon: TrendingUp, trend: '↑ 3.1%' },
  { label: 'Empleados', value: '1,247', icon: Users, trend: '↑ 89' },
  { label: 'Auditorías', value: '342', icon: Activity, trend: '↑ 28' },
];

/** Estadísticas destacadas de la plataforma (empleados auditados, países, precisión, tiempo). */
const stats = [
  { value: '7', label: 'Agentes de IA', icon: Brain },
  { value: '100%', label: 'Normativa colombiana', icon: ShieldCheck },
  { value: '99.2%', label: 'Precisión IA', icon: Brain },
  { value: '<15min', label: 'Tiempo de auditoría', icon: Clock },
];

/** Nombres de empresas mostradas en la barra de social proof "Empresas que confían en NominaSmart". */
const trustedBy = [
  'Hecho en Colombia 🇨🇴', 'Normativa UGPP', 'Seguridad Social',
  'Retención en la Fuente', 'Prestaciones Sociales', 'Código Sustantivo',
];

/** Lista de agentes IA derivada de AGENT_PERSONAS para la galería del equipo. */
const agentList = Object.values(AGENT_PERSONAS);

/**
 * Página de aterrizaje principal de NóminaSmart.
 *
 * Renderiza todas las secciones de marketing de la landing page pública:
 * hero, dashboard preview, social proof, estadísticas, equipo de agentes,
 * beneficios, flujo de trabajo, funcionalidades, testimonios y CTA final.
 *
 * @returns La landing page completa con todas las secciones de conversión.
 */
export default function LandingPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-32 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[#7C3AED]/[0.15] rounded-full blur-[150px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#10B981]/[0.15] rounded-full blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1c1f2a] text-sm text-[#ccc3d8] mb-8 backdrop-blur-[12px]" style={{ border: '1px solid rgba(74,68,85,0.15)' }}>
              <Sparkles className="w-4 h-4 text-[#4edea3]" />
              Plataforma de auditoría de nómina con IA multi-agente
              <span className="ml-1 px-2 py-0.5 rounded-full bg-[#7C3AED]/20 text-[#d2bbff] text-xs font-semibold">Nuevo</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-[#e0e2f1] leading-[1.05] tracking-[-0.03em]">
              Tu equipo de IA{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #4edea3, #d2bbff)' }}>
                audita tu nómina
              </span>
            </h1>

            <p className="mt-8 text-lg text-[#958da1] max-w-xl leading-relaxed font-[family-name:var(--font-inter)]">
              7 agentes de IA especializados trabajan en equipo para detectar errores,
              garantizar cumplimiento normativo multi-país y generar reportes ejecutivos
              en minutos.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
              <Link
                href={'/login' as never}
                className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all duration-200"
              >
                Comenzar gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href={'/contact' as never}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35] transition-all duration-200" style={{ border: '1px solid rgba(124,58,237,0.2)' }}
              >
                Solicitar demo
              </Link>
            </div>

            {/* Social proof mini */}
            <div className="mt-10 flex items-center gap-3">
              <div className="flex -space-x-2">
                {['🇨🇴', '🛡️', '🤖', '📊'].map((emoji, i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-[#1c1f2a] flex items-center justify-center text-sm ring-2 ring-[#0b1326]">
                    {emoji}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" />
                ))}
              </div>
              <span className="text-xs text-[#958da1]">14 días gratis · Sin tarjeta de crédito</span>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mt-20 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#7C3AED]/15 via-transparent to-[#10B981]/15 rounded-3xl blur-xl" />
            <div className="relative bg-[#1c1f2a]/80 backdrop-blur-[12px] rounded-[1.5rem] p-6" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-3 h-3 rounded-full bg-[#E11D48]/60" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                <div className="w-3 h-3 rounded-full bg-[#10B981]/60" />
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">NominaSmart Dashboard</span>
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

      {/* Trusted by */}
      <section className="py-12 px-6 overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4a4455] mb-8">
            Normativa colombiana que validamos automáticamente
          </p>
          <div className="flex items-center justify-center flex-wrap gap-x-12 gap-y-4">
            {trustedBy.map((name) => (
              <div key={name} className="flex items-center gap-2 text-[#4a4455] hover:text-[#958da1] transition-colors">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-sm font-semibold tracking-wide">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center group">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#1c1f2a] flex items-center justify-center group-hover:bg-[#262a35] transition-colors" style={{ boxShadow: '0 0 8px rgba(124,58,237,0.15)' }}>
                  <stat.icon className="w-5 h-5 text-[#d2bbff]" />
                </div>
                <p className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">{stat.value}</p>
                <p className="mt-1 text-sm text-[#958da1] font-[family-name:var(--font-inter)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Team */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d2bbff] mb-4">Conoce a tu equipo</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">
              7 agentes de IA que trabajan por ti
            </h2>
            <p className="mt-4 text-[#958da1] max-w-2xl mx-auto font-[family-name:var(--font-inter)]">
              Cada agente tiene una personalidad, especialidad y rol definido. Trabajan en equipo,
              se comunican entre sí y adaptan su plan según la complejidad de tu nómina.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {agentList.map((agent) => (
              <div
                key={agent.id}
                className="group relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-6 hover:bg-[#313440] transition-all duration-300 flex flex-col items-center text-center hover:-translate-y-1"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="mb-4 relative">
                  <AgentAvatar agentId={agent.id} size={72} animate={false} />
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-[#1c1f2a]"
                    style={{ backgroundColor: agent.hexColor }}
                  >
                    {agent.emoji}
                  </div>
                </div>
                <h3 className="text-base font-bold text-[#e0e2f1]">{agent.name}</h3>
                <p className="text-xs font-medium mt-1" style={{ color: agent.hexColor }}>{agent.role}</p>
                <p className="mt-3 text-[#958da1] text-sm leading-relaxed font-[family-name:var(--font-inter)]">
                  {agent.description}
                </p>
                <div
                  className="mt-4 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                  style={{ backgroundColor: `${agent.hexColor}15`, color: agent.hexColor }}
                >
                  &ldquo;{agent.greeting.split('.')[0]}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">Ventajas</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">¿Por qué elegir NominaSmart?</h2>
            <p className="mt-4 text-[#958da1] max-w-xl mx-auto font-[family-name:var(--font-inter)]">
              Tecnología de punta para simplificar la auditoría de nómina más compleja.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <div
                key={b.title}
                className="group relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 hover:bg-[#313440] transition-all duration-300 hover:-translate-y-1"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                {/* Subtle number watermark */}
                <span className="absolute top-4 right-6 text-6xl font-extrabold text-[#181b26] select-none pointer-events-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div
                  className="relative w-12 h-12 rounded-xl bg-[#181b26] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: `0 0 12px ${b.glowColor}` }}
                >
                  <b.icon className={`w-6 h-6 ${b.iconColor}`} />
                </div>
                <h3 className="relative text-lg font-bold text-[#e0e2f1] mb-2">{b.title}</h3>
                <p className="relative text-[#958da1] text-sm leading-relaxed font-[family-name:var(--font-inter)]">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">Proceso</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">
              Así trabaja tu equipo de agentes
            </h2>
            <p className="mt-4 text-[#958da1] max-w-lg mx-auto font-[family-name:var(--font-inter)]">
              De archivo Excel a reporte ejecutivo en 4 pasos automatizados.
            </p>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-[#7C3AED]/30 via-[#4edea3]/30 to-[#4cd7f6]/30" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { step: '01', title: 'Sube tu archivo', desc: 'Arrastra tu Excel o CSV. Dianis coordina al equipo automáticamente.', agentId: 'master' },
                { step: '02', title: 'Mapeo inteligente', desc: 'Gyoru identifica y conecta tus columnas con el sistema.', agentId: 'mapper' },
                { step: '03', title: 'Auditoría + Corrección', desc: 'Juli audita cada línea. Wil corrige. Luni consulta normas vigentes.', agentId: 'auditor' },
                { step: '04', title: 'Reporte ejecutivo', desc: 'Ana genera tu reporte narrativo listo para gerencia.', agentId: 'writer' },
              ].map((item) => {
                const persona = AGENT_PERSONAS[item.agentId];
                return (
                  <div key={item.step} className="flex flex-col items-center text-center group">
                    <div className="relative mb-5">
                      <div className="absolute -inset-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: `0 0 20px ${persona?.hexColor ?? '#7C3AED'}30` }} />
                      <AgentAvatar agentId={item.agentId} size={64} animate={false} />
                      <span
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-lg"
                        style={{ backgroundColor: persona?.hexColor ?? '#7C3AED' }}
                      >
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#e0e2f1] mb-1.5">{item.title}</h3>
                    <p className="text-xs text-[#958da1] leading-relaxed font-[family-name:var(--font-inter)] max-w-[180px]">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
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
              <div key={feature} className="flex items-start gap-3 p-4 rounded-[1rem] hover:bg-[#1c1f2a]/60 transition-colors duration-200 group">
                <CheckCircle2 className="w-5 h-5 text-[#4edea3] mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-[#ccc3d8] text-sm font-[family-name:var(--font-inter)]">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">Beneficios</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">Lo que NominaSmart hace por ti</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-7 flex flex-col hover:bg-[#313440] transition-all duration-300 hover:-translate-y-1"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-[#ccc3d8] text-sm leading-relaxed flex-1 font-[family-name:var(--font-inter)]">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#181b26] flex items-center justify-center text-lg">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-[#e0e2f1] text-sm font-semibold">{t.name}</p>
                    <p className="text-[#4cd7f6] text-xs mt-0.5">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6">
        <div className="mx-auto max-w-4xl">
          <div
            className="relative rounded-[2rem] p-12 sm:p-16 text-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1c1f2a 0%, #181b26 100%)', border: '1px solid rgba(124,58,237,0.15)' }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#7C3AED]/[0.12] rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#10B981]/[0.08] rounded-full blur-[80px]" />
            </div>
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">Empieza a auditar tu nómina hoy</h2>
              <p className="mt-5 text-[#958da1] max-w-xl mx-auto font-[family-name:var(--font-inter)]">
                Prueba NominaSmart gratis por 14 días. Sin tarjeta de crédito, sin compromiso.
                Descubre cómo la IA puede transformar tu proceso de auditoría de nómina.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href={'/login' as never}
                  className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-[#10B981] to-[#047857] text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  Crear cuenta gratis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href={'/pricing' as never}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35] transition-all duration-200"
                >
                  Ver planes y precios
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
