/**
 * Página pública "Quiénes somos" de NóminaSmart.
 *
 * Presenta la misión de la empresa, los perfiles de los cofundadores
 * y los valores corporativos. Es una página estática sin dependencias
 * de datos del servidor ni autenticación.
 *
 * Ruta: `/[locale]/about`
 */
'use client';

import { Zap, Brain, ShieldCheck, Users, Lightbulb, GraduationCap, Code2, BarChart3 } from 'lucide-react';

/** Perfiles de los cofundadores mostrados en la sección de equipo. */
const founders = [
  {
    name: 'Diana Granados',
    role: 'Co-fundadora & CEO',
    avatar: '👩‍💼',
    color: 'from-rose-500 to-pink-600',
    glow: 'shadow-[0_0_30px_rgba(244,63,94,0.3)]',
    bio: 'Administradora de Empresas con especialización en Desarrollo Organizacional. Experta en gestión de nómina y cumplimiento normativo laboral con más de una década de experiencia liderando equipos de RRHH y auditoría en empresas de múltiples sectores.',
    expertise: [
      { icon: Users, label: 'Gestión de Nómina & RRHH' },
      { icon: ShieldCheck, label: 'Cumplimiento Normativo UGPP' },
      { icon: Lightbulb, label: 'Desarrollo Organizacional' },
      { icon: GraduationCap, label: 'Administración de Empresas' },
    ],
    quote: 'La nómina no es solo números, es el bienestar de las personas. NóminaSmart nació de la necesidad real de hacer auditoría inteligente, accesible y confiable.',
  },
  {
    name: 'Wilson Vargas',
    role: 'Co-fundador & CTO',
    avatar: '👨‍💻',
    color: 'from-violet-500 to-indigo-600',
    glow: 'shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    bio: 'Ingeniero de Sistemas con especialización en Gerencia de Proyectos y Magíster en Inteligencia de Negocios. Experto en inteligencia artificial, ciencia de datos y desarrollo de software. Arquitecto de la plataforma multi-agente de NóminaSmart.',
    expertise: [
      { icon: Brain, label: 'Inteligencia Artificial & Datos' },
      { icon: Code2, label: 'Arquitectura de Software' },
      { icon: BarChart3, label: 'Inteligencia de Negocios' },
      { icon: GraduationCap, label: 'Gerencia de Proyectos' },
    ],
    quote: 'Construimos IA que entiende la normativa laboral de cada país. Nuestros agentes no reemplazan al experto, lo potencian con precisión y velocidad.',
  },
];

/** Valores corporativos mostrados en la sección inferior de la página. */
const values = [
  {
    icon: ShieldCheck,
    title: 'Seguridad primero',
    description: 'Tus datos de nómina están cifrados y protegidos. Nunca compartimos información con terceros.',
  },
  {
    icon: Brain,
    title: 'IA responsable',
    description: 'Nuestros agentes de IA son transparentes, auditables y siempre bajo supervisión humana.',
  },
  {
    icon: Users,
    title: 'Centrados en el usuario',
    description: 'Diseñamos cada funcionalidad pensando en contadores, auditores y equipos de RRHH reales.',
  },
  {
    icon: Zap,
    title: 'Innovación continua',
    description: 'Actualizamos constantemente las reglas normativas y mejoramos los modelos de IA.',
  },
];

export default function AboutPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-violet/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-rose/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300 mb-8">
            <Users className="w-4 h-4 text-violet-light" />
            Quiénes somos
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
            Expertos en nómina e{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-violet-light">
              inteligencia artificial
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            NóminaSmart nació de la unión entre el conocimiento profundo en gestión de nómina
            y la tecnología de inteligencia artificial más avanzada. Creamos la herramienta
            que siempre quisimos tener.
          </p>
        </div>
      </section>

      {/* Founders */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Los fundadores</h2>
            <p className="mt-3 text-slate-400 max-w-xl mx-auto">
              Combinamos experiencia en nómina con ingeniería de IA para resolver
              un problema real.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {founders.map((founder) => (
              <div
                key={founder.name}
                className={`glass-panel rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-500 group ${founder.glow}`}
              >
                {/* Header gradient */}
                <div className={`h-2 bg-gradient-to-r ${founder.color}`} />

                <div className="p-8">
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-5 mb-6">
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${founder.color} flex items-center justify-center text-4xl shadow-lg group-hover:scale-105 transition-transform duration-300`}>
                      {founder.avatar}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{founder.name}</h3>
                      <p className="text-sm font-medium text-slate-400 mt-0.5">{founder.role}</p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-slate-300 text-sm leading-relaxed mb-6">
                    {founder.bio}
                  </p>

                  {/* Expertise tags */}
                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {founder.expertise.map((exp) => (
                      <div
                        key={exp.label}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5"
                      >
                        <exp.icon className="w-3.5 h-3.5 text-violet-light shrink-0" />
                        <span className="text-xs text-slate-300 font-medium">{exp.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Quote */}
                  <div className="border-l-2 border-violet/30 pl-4">
                    <p className="text-sm text-slate-400 italic leading-relaxed">
                      &ldquo;{founder.quote}&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Nuestros valores</h2>
            <p className="mt-3 text-slate-400">
              Los principios que guían cada decisión en NóminaSmart.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="glass-panel rounded-xl p-6 hover:border-violet/20 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet/20 to-emerald/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <value.icon className="w-5 h-5 text-emerald-light" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{value.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="mx-auto max-w-3xl text-center">
          <div className="w-16 h-16 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-emerald/20 to-violet/20 flex items-center justify-center border border-white/10">
            <Zap className="w-8 h-8 text-violet-light" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-6">Nuestra misión</h2>
          <p className="text-lg text-slate-300 leading-relaxed">
            Democratizar la auditoría de nómina con inteligencia artificial, haciendo que
            cada empresa, sin importar su tamaño, pueda garantizar el cumplimiento normativo
            laboral de forma rápida, precisa y accesible.
          </p>
          <p className="mt-4 text-slate-400 leading-relaxed">
            Creemos que la tecnología debe servir a las personas. Por eso nuestros agentes de IA
            trabajan como un equipo de expertos que potencia las capacidades de contadores,
            auditores y profesionales de RRHH.
          </p>
        </div>
      </section>
    </div>
  );
}
