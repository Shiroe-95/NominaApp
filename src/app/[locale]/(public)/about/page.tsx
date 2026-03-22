'use client';

import { Zap, Brain, ShieldCheck, Users, Lightbulb, GraduationCap, Code2, BarChart3 } from 'lucide-react';

const founders = [
  {
    name: 'Diana Granados',
    role: 'Co-fundadora & CEO',
    avatar: '👩‍💼',
    gradientFrom: '#E11D48',
    gradientTo: '#be123c',
    bio: 'Administradora de Empresas con especialización en Desarrollo Organizacional. Experta en gestión de nómina y cumplimiento normativo laboral con más de una década de experiencia.',
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
    gradientFrom: '#7C3AED',
    gradientTo: '#5B21B6',
    bio: 'Ingeniero de Sistemas con especialización en Gerencia de Proyectos y Magíster en Inteligencia de Negocios. Experto en IA, ciencia de datos y arquitectura de software.',
    expertise: [
      { icon: Brain, label: 'Inteligencia Artificial & Datos' },
      { icon: Code2, label: 'Arquitectura de Software' },
      { icon: BarChart3, label: 'Inteligencia de Negocios' },
      { icon: GraduationCap, label: 'Gerencia de Proyectos' },
    ],
    quote: 'Construimos IA que entiende la normativa laboral de cada país. Nuestros agentes no reemplazan al experto, lo potencian con precisión y velocidad.',
  },
];

const values = [
  { icon: ShieldCheck, title: 'Seguridad primero', description: 'Tus datos de nómina están cifrados y protegidos. Nunca compartimos información con terceros.', iconColor: 'text-[#4edea3]', glowColor: 'rgba(16,185,129,0.2)' },
  { icon: Brain, title: 'IA responsable', description: 'Nuestros agentes de IA son transparentes, auditables y siempre bajo supervisión humana.', iconColor: 'text-[#d2bbff]', glowColor: 'rgba(124,58,237,0.2)' },
  { icon: Users, title: 'Centrados en el usuario', description: 'Diseñamos cada funcionalidad pensando en contadores, auditores y equipos de RRHH reales.', iconColor: 'text-[#4cd7f6]', glowColor: 'rgba(6,182,212,0.2)' },
  { icon: Zap, title: 'Innovación continua', description: 'Actualizamos constantemente las reglas normativas y mejoramos los modelos de IA.', iconColor: 'text-[#ffb3b6]', glowColor: 'rgba(225,29,72,0.2)' },
];

export default function AboutPage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#7C3AED]/[0.12] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#E11D48]/[0.08] rounded-full blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1c1f2a] backdrop-blur-[12px] text-sm text-[#ccc3d8] mb-8">
            <Users className="w-4 h-4 text-[#d2bbff]" />
            Quiénes somos
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#e0e2f1] leading-tight tracking-[-0.03em]">
            Expertos en nómina e{' '}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #4edea3, #d2bbff)' }}>
              inteligencia artificial
            </span>
          </h1>

          <p className="mt-8 text-lg text-[#958da1] max-w-2xl mx-auto leading-relaxed font-[family-name:var(--font-inter)]">
            NóminaSmart nació de la unión entre el conocimiento profundo en gestión de nómina
            y la tecnología de inteligencia artificial más avanzada.
          </p>
        </div>
      </section>

      {/* Founders — Glass cards, gradient accent bar, no explicit borders */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">Equipo</p>
            <h2 className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">Los fundadores</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {founders.map((founder) => (
              <div
                key={founder.name}
                className="relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] overflow-hidden group hover:bg-[#313440] transition-all duration-300"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="h-1.5" style={{ background: `linear-gradient(to right, ${founder.gradientFrom}, ${founder.gradientTo})` }} />
                <div className="p-8">
                  <div className="flex items-center gap-5 mb-6">
                    <div
                      className="w-16 h-16 rounded-[1rem] flex items-center justify-center text-3xl group-hover:scale-105 transition-transform duration-300"
                      style={{
                        background: `linear-gradient(135deg, ${founder.gradientFrom}, ${founder.gradientTo})`,
                        boxShadow: `0 0 20px ${founder.gradientFrom}40`,
                      }}
                    >
                      {founder.avatar}
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-[#e0e2f1]">{founder.name}</h3>
                      <p className="text-sm text-[#4cd7f6] mt-0.5">{founder.role}</p>
                    </div>
                  </div>

                  <p className="text-[#ccc3d8] text-sm leading-relaxed mb-6 font-[family-name:var(--font-inter)]">{founder.bio}</p>

                  <div className="grid grid-cols-2 gap-2 mb-6">
                    {founder.expertise.map((exp) => (
                      <div key={exp.label} className="flex items-center gap-2 px-3 py-2.5 rounded-[0.75rem] bg-[#181b26]">
                        <exp.icon className="w-3.5 h-3.5 text-[#d2bbff] shrink-0" />
                        <span className="text-xs text-[#ccc3d8] font-medium font-[family-name:var(--font-inter)]">{exp.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Quote — left accent using primary color glow, not a hard border */}
                  <div className="pl-4 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-gradient-to-b from-[#7C3AED] to-[#7C3AED]/20" />
                    <p className="text-sm text-[#958da1] italic leading-relaxed font-[family-name:var(--font-inter)]">&ldquo;{founder.quote}&rdquo;</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values — Glass cards with ambient icon glow */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">Principios</p>
            <h2 className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">Nuestros valores</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-7 hover:bg-[#313440] transition-all duration-300 group"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div
                  className="w-11 h-11 rounded-[0.75rem] bg-[#181b26] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: `0 0 8px ${value.glowColor}` }}
                >
                  <value.icon className={`w-5 h-5 ${value.iconColor}`} />
                </div>
                <h3 className="text-base font-bold text-[#e0e2f1] mb-2">{value.title}</h3>
                <p className="text-[#958da1] text-sm leading-relaxed font-[family-name:var(--font-inter)]">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="w-16 h-16 mx-auto mb-8 rounded-[1rem] bg-[#1c1f2a] flex items-center justify-center" style={{ boxShadow: '0 0 20px rgba(124,58,237,0.2)' }}>
            <Zap className="w-8 h-8 text-[#d2bbff]" />
          </div>
          <h2 className="text-3xl font-extrabold text-[#e0e2f1] mb-8 tracking-[-0.02em]">Nuestra misión</h2>
          <p className="text-lg text-[#ccc3d8] leading-relaxed font-[family-name:var(--font-inter)]">
            Democratizar la auditoría de nómina con inteligencia artificial, haciendo que
            cada empresa pueda garantizar el cumplimiento normativo laboral de forma rápida, precisa y accesible.
          </p>
          <p className="mt-5 text-[#958da1] leading-relaxed font-[family-name:var(--font-inter)]">
            Creemos que la tecnología debe servir a las personas. Por eso nuestros agentes de IA
            trabajan como un equipo de expertos que potencia las capacidades de contadores,
            auditores y profesionales de RRHH.
          </p>
        </div>
      </section>
    </div>
  );
}
