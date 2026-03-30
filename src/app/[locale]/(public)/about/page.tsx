/**
 * AboutPage — Quiénes somos, con timeline, estadísticas y mejor presentación.
 */
'use client';

import { Zap, Brain, ShieldCheck, Users, Lightbulb, GraduationCap, Code2, BarChart3, MapPin, Calendar, Rocket, Award } from 'lucide-react';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { AGENT_PERSONAS } from '@/lib/ai/agent-personas';
import { useTranslations } from 'next-intl';
import { useAutoTranslate } from '@/hooks/useAutoTranslate';

export default function AboutPage() {
  const t = useTranslations('Public');

  const founders = [
    {
      name: t('founder1Name'),
      role: t('founder1Role'),
      avatar: '👩‍💼',
      gradientFrom: '#E11D48',
      gradientTo: '#be123c',
      bio: t('founder1Bio'),
      expertise: [
        { icon: Users, label: t('founder1Exp1') },
        { icon: ShieldCheck, label: t('founder1Exp2') },
        { icon: Lightbulb, label: t('founder1Exp3') },
        { icon: GraduationCap, label: t('founder1Exp4') },
      ],
      quote: t('founder1Quote'),
    },
    {
      name: t('founder2Name'),
      role: t('founder2Role'),
      avatar: '👨‍💻',
      gradientFrom: '#7C3AED',
      gradientTo: '#5B21B6',
      bio: t('founder2Bio'),
      expertise: [
        { icon: Brain, label: t('founder2Exp1') },
        { icon: Code2, label: t('founder2Exp2') },
        { icon: BarChart3, label: t('founder2Exp3') },
        { icon: GraduationCap, label: t('founder2Exp4') },
      ],
      quote: t('founder2Quote'),
    },
  ];

  const values = [
    { icon: ShieldCheck, title: t('value1Title'), description: t('value1Desc'), iconColor: 'text-[#4edea3]', glowColor: 'rgba(16,185,129,0.2)' },
    { icon: Brain, title: t('value2Title'), description: t('value2Desc'), iconColor: 'text-[#d2bbff]', glowColor: 'rgba(124,58,237,0.2)' },
    { icon: Users, title: t('value3Title'), description: t('value3Desc'), iconColor: 'text-[#4cd7f6]', glowColor: 'rgba(6,182,212,0.2)' },
    { icon: Zap, title: t('value4Title'), description: t('value4Desc'), iconColor: 'text-[#ffb3b6]', glowColor: 'rgba(225,29,72,0.2)' },
  ];

  const timeline = [
    { year: t('timeline1Year'), title: t('timeline1Title'), description: t('timeline1Desc'), icon: Lightbulb, color: '#F59E0B' },
    { year: t('timeline2Year'), title: t('timeline2Title'), description: t('timeline2Desc'), icon: Rocket, color: '#7C3AED' },
    { year: t('timeline3Year'), title: t('timeline3Title'), description: t('timeline3Desc'), icon: MapPin, color: '#10B981' },
    { year: t('timeline4Year'), title: t('timeline4Title'), description: t('timeline4Desc'), icon: Award, color: '#E11D48' },
  ];

  const aboutStats = [
    { value: '7', label: t('aboutStat1') },
    { value: '100%', label: t('aboutStat2') },
    { value: '14', label: t('aboutStat3') },
    { value: '<15min', label: t('aboutStat4') },
  ];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-20 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[#7C3AED]/[0.12] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#E11D48]/[0.08] rounded-full blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1c1f2a] backdrop-blur-[12px] text-sm text-[#ccc3d8] mb-8" style={{ border: '1px solid rgba(74,68,85,0.15)' }}>
            <Users className="w-4 h-4 text-[#d2bbff]" />
            {t('aboutHeroBadge')}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#e0e2f1] leading-tight tracking-[-0.03em]">
            {t('aboutHeroTitle').split(' ').slice(0, -2).join(' ')}{' '}
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #4edea3, #d2bbff)' }}>
              {t('aboutHeroTitle').split(' ').slice(-2).join(' ')}
            </span>
          </h1>

          <p className="mt-8 text-lg text-[#958da1] max-w-2xl mx-auto leading-relaxed font-[family-name:var(--font-inter)]">
            {t('aboutHeroSubtitle')}
          </p>

          {/* Stats bar */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {aboutStats.map((stat) => (
              <div key={stat.label} className="bg-[#1c1f2a] rounded-[1.25rem] p-5" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
                <p className="text-2xl sm:text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#958da1] font-[family-name:var(--font-inter)]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">{t('history')}</p>
            <h2 className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">{t('ourTimeline')}</h2>
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#7C3AED]/30 via-[#4edea3]/30 to-[#E11D48]/30" />

            <div className="space-y-12">
              {timeline.map((item, i) => (
                <div key={item.year} className={`relative flex items-start gap-6 sm:gap-12 ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}>
                  <div className={`hidden sm:block flex-1 ${i % 2 === 0 ? 'text-right' : 'text-left'}`}>
                    <div className="bg-[#1c1f2a] rounded-[1.25rem] p-6 inline-block" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: item.color }}>{item.year}</p>
                      <h3 className="text-base font-bold text-[#e0e2f1] mb-1">{item.title}</h3>
                      <p className="text-sm text-[#958da1] font-[family-name:var(--font-inter)]">{item.description}</p>
                    </div>
                  </div>
                  <div className="relative z-10 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#181b26] flex items-center justify-center" style={{ boxShadow: `0 0 12px ${item.color}30`, border: `2px solid ${item.color}40` }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                  </div>
                  {/* Mobile-only content */}
                  <div className="sm:hidden flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: item.color }}>{item.year}</p>
                    <h3 className="text-base font-bold text-[#e0e2f1] mb-1">{item.title}</h3>
                    <p className="text-sm text-[#958da1] font-[family-name:var(--font-inter)]">{item.description}</p>
                  </div>
                  <div className="hidden sm:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Team */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d2bbff] mb-4">{t('aiTeam')}</p>
            <h2 className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">{t('aiTeamTitle')}</h2>
            <p className="mt-4 text-[#958da1] max-w-2xl mx-auto font-[family-name:var(--font-inter)]">
              {t('aiTeamSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {Object.values(AGENT_PERSONAS).map((agent) => (
              <div
                key={agent.id}
                className="flex flex-col items-center text-center bg-[#1c1f2a] rounded-[1.25rem] p-5 hover:bg-[#313440] transition-all duration-300 group hover:-translate-y-1"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="group-hover:scale-105 transition-transform duration-300">
                  <AgentAvatar agentId={agent.id} size={56} animate={false} />
                </div>
                <p className="mt-3 text-sm font-bold text-[#e0e2f1]">{agent.emoji} {agent.name}</p>
                <p className="text-[10px] mt-1 leading-tight" style={{ color: agent.hexColor }}>{agent.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founders */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">{t('team')}</p>
            <h2 className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">{t('founders')}</h2>
            <p className="mt-4 text-[#958da1] max-w-lg mx-auto font-[family-name:var(--font-inter)]">
              {t('foundersSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {founders.map((founder) => (
              <div
                key={founder.name}
                className="relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] overflow-hidden group hover:bg-[#262a35] transition-all duration-300"
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

                  <div className="pl-4 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full" style={{ background: `linear-gradient(to bottom, ${founder.gradientFrom}, ${founder.gradientFrom}30)` }} />
                    <p className="text-sm text-[#958da1] italic leading-relaxed font-[family-name:var(--font-inter)]">&ldquo;{founder.quote}&rdquo;</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">{t('principles')}</p>
            <h2 className="text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">{t('ourValues')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-7 hover:bg-[#313440] transition-all duration-300 group hover:-translate-y-1"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div
                  className="w-11 h-11 rounded-[0.75rem] bg-[#181b26] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300"
                  style={{ boxShadow: `0 0 12px ${value.glowColor}` }}
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
        <div className="mx-auto max-w-4xl">
          <div
            className="relative rounded-[2rem] p-12 sm:p-16 text-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1c1f2a 0%, #181b26 100%)', border: '1px solid rgba(124,58,237,0.15)' }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#7C3AED]/[0.08] rounded-full blur-[120px]" />
            </div>
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-8 rounded-[1rem] bg-[#181b26] flex items-center justify-center" style={{ boxShadow: '0 0 20px rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <Zap className="w-8 h-8 text-[#d2bbff]" />
              </div>
              <h2 className="text-3xl font-extrabold text-[#e0e2f1] mb-8 tracking-[-0.02em]">{t('ourMission')}</h2>
              <p className="text-lg text-[#ccc3d8] leading-relaxed font-[family-name:var(--font-inter)]">
                {t('missionText')}
              </p>
              <p className="mt-5 text-[#958da1] leading-relaxed font-[family-name:var(--font-inter)]">
                {t('missionText2')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
