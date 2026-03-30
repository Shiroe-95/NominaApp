'use client';

import { useState } from 'react';
import { ArrowRight, Check, Minus, ChevronDown, Sparkles, Shield, Zap } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#1c1f2a] rounded-[1.25rem] overflow-hidden transition-all duration-200" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-5 text-left">
        <span className="text-sm font-semibold text-[#e0e2f1] pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-[#958da1] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-6 pb-5 text-sm text-[#958da1] leading-relaxed font-[family-name:var(--font-inter)]">{a}</p>
      </div>
    </div>
  );
}

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? <Check className="w-4 h-4 text-[#4edea3] mx-auto" /> : <Minus className="w-4 h-4 text-[#4a4455] mx-auto" />;
  }
  return <span className="text-[#ccc3d8] text-sm font-[family-name:var(--font-inter)]">{value}</span>;
}

export default function PricingPage() {
  const t = useTranslations('Pricing');

  const plans = [
    {
      name: t('starterName'),
      priceUSD: 49,
      priceCOP: 199000,
      description: t('starterDesc'),
      highlight: false,
      features: [
        t('starterEmp'),
        t('starterAudits'),
        t('starterAgents'),
        t('starterReports'),
        t('starterProviders'),
        t('starterCountry'),
        t('starterSupport'),
      ],
    },
    {
      name: t('proName'),
      priceUSD: 149,
      priceCOP: 599000,
      description: t('proDesc'),
      highlight: true,
      features: [
        t('proEmp'),
        t('proAudits'),
        t('proAgents'),
        t('proReports'),
        t('proProviders'),
        t('proCountry'),
        t('proSupport'),
      ],
    },
    {
      name: t('enterpriseName'),
      priceUSD: 0,
      priceCOP: 0,
      description: t('enterpriseDesc'),
      highlight: false,
      isCustom: true,
      features: [
        t('enterpriseEmp'),
        t('enterpriseAudits'),
        t('enterpriseAgents'),
        t('enterpriseReports'),
        t('enterpriseProviders'),
        t('enterpriseCountry'),
        t('enterpriseSupport'),
      ],
    },
  ];

  const comparison = [
    { label: t('compEmployees'), basic: t('starterEmp'), pro: t('proEmp'), enterprise: t('enterpriseEmp') },
    { label: t('compAudits'), basic: '3/mes', pro: t('unlimited'), enterprise: t('unlimited') },
    { label: '🔍 Juli (' + t('auditor') + ')', basic: true, pro: true, enterprise: true },
    { label: '🐈‍⬛ Gyoru (' + t('mapper') + ')', basic: true, pro: true, enterprise: true },
    { label: '⚙️ Wil (' + t('corrector') + ')', basic: false, pro: true, enterprise: true },
    { label: '📝 Ana (' + t('writer') + ')', basic: false, pro: true, enterprise: true },
    { label: '🐰 Luni (' + t('expert') + ')', basic: false, pro: true, enterprise: true },
    { label: '🐕 Soul (' + t('researcher') + ')', basic: false, pro: false, enterprise: true },
    { label: '👑 Dianis (' + t('orchestrator') + ')', basic: true, pro: true, enterprise: true },
    { label: t('compMultiCountry'), basic: '1', pro: '3', enterprise: t('all') },
    { label: t('compMultiCurrency'), basic: false, pro: true, enterprise: true },
    { label: t('compApi'), basic: false, pro: false, enterprise: true },
    { label: t('compSupport'), basic: 'Email', pro: t('priorityChat'), enterprise: t('dedicated') },
  ];

  const faqs = [
    { q: t('faq1Q'), a: t('faq1A') },
    { q: t('faq2Q'), a: t('faq2A') },
    { q: t('faq3Q'), a: t('faq3A') },
    { q: t('faq4Q'), a: t('faq4A') },
    { q: t('faq5Q'), a: t('faq5A') },
  ];

  return (
    <div className="relative">
      <section className="pt-28 pb-8 px-6 text-center relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#7C3AED]/[0.1] rounded-full blur-[150px]" />
        </div>
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">{t('label')}</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">{t('title')}</h1>
          <p className="mt-5 text-[#958da1] max-w-xl mx-auto text-lg font-[family-name:var(--font-inter)]">{t('subtitle')}</p>
        </div>
      </section>

      <section className="px-6 pb-32 pt-12">
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCustom = 'isCustom' in plan && plan.isCustom;
            return (
              <div key={plan.name} className={`relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${plan.highlight ? 'md:-mt-4 md:mb-4' : ''}`}
                style={{ border: plan.highlight ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(74,68,85,0.10)', boxShadow: plan.highlight ? '0 0 40px rgba(124,58,237,0.12), 0 20px 60px rgba(0,0,0,0.3)' : 'none' }}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#7C3AED] text-white text-xs font-semibold shadow-[0_0_12px_rgba(124,58,237,0.4)] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />{t('mostPopular')}
                  </div>
                )}
                <h3 className="text-xl font-extrabold text-[#e0e2f1]">{plan.name}</h3>
                <p className="mt-2 text-[#958da1] text-sm font-[family-name:var(--font-inter)]">{plan.description}</p>
                <div className="mt-8 mb-2">
                  {isCustom ? (
                    <span className="text-2xl font-extrabold text-[#e0e2f1]">{t('custom')}</span>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">${plan.priceUSD}</span>
                        <span className="text-[#4cd7f6] text-xs font-semibold uppercase tracking-[0.1em]">USD/{t('month')}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#958da1]">
                        ${plan.priceCOP.toLocaleString('es-CO')} COP/{t('month')}
                      </p>
                    </>
                  )}
                </div>
                <ul className="space-y-3.5 flex-1 mt-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#4edea3] mt-0.5 shrink-0" />
                      <span className="text-[#ccc3d8] text-sm font-[family-name:var(--font-inter)]">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link href={isCustom ? ('/contact' as never) : ('/login' as never)}
                  className={`mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${plan.highlight ? 'bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5' : 'text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35]'}`}
                  style={!plan.highlight ? { border: '1px solid rgba(124,58,237,0.15)' } : undefined}>
                  {isCustom ? t('contactSales') : t('startNow')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1c1f2a] text-sm text-[#958da1]" style={{ border: '1px solid rgba(74,68,85,0.1)' }}>
            <Shield className="w-4 h-4 text-[#4edea3]" />{t('guarantee')}
          </div>
        </div>
      </section>

      <section className="px-6 pb-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#e0e2f1] text-center mb-12 tracking-[-0.02em]">{t('comparisonTitle')}</h2>
          <div className="overflow-x-auto rounded-[1.5rem] bg-[#1c1f2a]" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#4a4455]/10">
                  <th className="text-left px-6 py-4 text-[#958da1] font-medium">{t('feature')}</th>
                  <th className="text-center px-6 py-4 text-[#958da1] font-medium">{t('starterName')}</th>
                  <th className="text-center px-6 py-4 text-[#d2bbff] font-semibold">{t('proName')}</th>
                  <th className="text-center px-6 py-4 text-[#958da1] font-medium">{t('enterpriseName')}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-[#4a4455]/5 hover:bg-[#181b26]/50 transition-colors">
                    <td className="px-6 py-3.5 text-[#ccc3d8] font-[family-name:var(--font-inter)]">{row.label}</td>
                    <td className="px-6 py-3.5 text-center"><CellValue value={row.basic} /></td>
                    <td className="px-6 py-3.5 text-center"><CellValue value={row.pro} /></td>
                    <td className="px-6 py-3.5 text-center"><CellValue value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="px-6 pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">{t('faqTitle')}</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => <FaqItem key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>
    </div>
  );
}
