'use client';

import { ArrowRight, Check, Minus } from 'lucide-react';
import { Link } from '@/i18n/routing';

const plans = [
  {
    name: 'Básico',
    price: '99',
    currency: 'USD',
    period: '/mes',
    description: 'Para pequeñas empresas que inician con auditoría de nómina.',
    highlight: false,
    features: {
      employees: 'Hasta 50 empleados',
      uploads: '5 cargas/mes',
      agents: 'Auditor + Mapeador',
      reports: 'Reportes básicos',
      providers: '1 proveedor de IA',
      countries: '1 país',
      support: 'Email',
    },
  },
  {
    name: 'Profesional',
    price: '299',
    currency: 'USD',
    period: '/mes',
    description: 'Para empresas medianas con necesidades avanzadas de cumplimiento.',
    highlight: true,
    features: {
      employees: 'Hasta 500 empleados',
      uploads: 'Cargas ilimitadas',
      agents: 'Todos los agentes IA',
      reports: 'Reportes ejecutivos completos',
      providers: '3 proveedores de IA',
      countries: '3 países',
      support: 'Chat prioritario',
    },
  },
  {
    name: 'Empresarial',
    price: 'Personalizado',
    currency: '',
    period: '',
    description: 'Para grandes corporaciones y multinacionales.',
    highlight: false,
    features: {
      employees: 'Empleados ilimitados',
      uploads: 'Cargas ilimitadas',
      agents: 'Todos los agentes + Investigador',
      reports: 'Reportes personalizados',
      providers: 'Proveedores ilimitados',
      countries: 'Todos los países',
      support: 'Dedicado 24/7',
    },
  },
];

const comparisonFeatures = [
  { label: 'Empleados', basic: 'Hasta 50', pro: 'Hasta 500', enterprise: 'Ilimitados' },
  { label: 'Cargas mensuales', basic: '5', pro: 'Ilimitadas', enterprise: 'Ilimitadas' },
  { label: 'Agente Auditor', basic: true, pro: true, enterprise: true },
  { label: 'Agente Mapeador', basic: true, pro: true, enterprise: true },
  { label: 'Agente Corrector', basic: false, pro: true, enterprise: true },
  { label: 'Agente Redactor', basic: false, pro: true, enterprise: true },
  { label: 'Agente Nómina', basic: false, pro: true, enterprise: true },
  { label: 'Agente Investigador', basic: false, pro: false, enterprise: true },
  { label: 'Bus de Agentes', basic: false, pro: false, enterprise: true },
  { label: 'Multi-país', basic: '1 país', pro: '3 países', enterprise: 'Todos' },
  { label: 'Multi-moneda', basic: false, pro: true, enterprise: true },
  { label: 'Panel financiero', basic: false, pro: false, enterprise: true },
  { label: 'Gestión de usuarios', basic: false, pro: true, enterprise: true },
  { label: 'API access', basic: false, pro: false, enterprise: true },
  { label: 'Soporte', basic: 'Email', pro: 'Chat prioritario', enterprise: 'Dedicado 24/7' },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-4 h-4 text-[#4edea3] mx-auto" />
    ) : (
      <Minus className="w-4 h-4 text-[#4a4455] mx-auto" />
    );
  }
  return <span className="text-[#ccc3d8] text-sm font-[family-name:var(--font-inter)]">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="relative">
      <section className="pt-28 pb-16 px-6 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">Precios</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">Planes y precios</h1>
        <p className="mt-5 text-[#958da1] max-w-xl mx-auto text-lg font-[family-name:var(--font-inter)]">
          Elige el plan que mejor se adapte al tamaño y necesidades de tu empresa.
        </p>
      </section>

      {/* Plan cards — Glass cards with ghost borders */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 flex flex-col transition-all duration-300 ${
                plan.highlight
                  ? 'hover:bg-[#313440]'
                  : 'hover:bg-[#313440]'
              }`}
              style={{
                border: plan.highlight
                  ? '1px solid rgba(124,58,237,0.25)'
                  : '1px solid rgba(74,68,85,0.10)',
                boxShadow: plan.highlight
                  ? '0 0 40px rgba(124,58,237,0.12)'
                  : 'none',
              }}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#7C3AED] text-white text-xs font-semibold shadow-[0_0_12px_rgba(124,58,237,0.4)]">
                  Más popular
                </div>
              )}

              <h3 className="text-xl font-extrabold text-[#e0e2f1]">{plan.name}</h3>
              <p className="mt-2 text-[#958da1] text-sm font-[family-name:var(--font-inter)]">{plan.description}</p>

              <div className="mt-8 mb-8">
                {plan.currency ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">${plan.price}</span>
                    <span className="text-[#4cd7f6] text-xs font-semibold uppercase tracking-[0.1em]">{plan.currency}{plan.period}</span>
                  </div>
                ) : (
                  <span className="text-2xl font-extrabold text-[#e0e2f1]">{plan.price}</span>
                )}
              </div>

              <ul className="space-y-3.5 flex-1">
                {Object.values(plan.features).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#4edea3] mt-0.5 shrink-0" />
                    <span className="text-[#ccc3d8] text-sm font-[family-name:var(--font-inter)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.price === 'Personalizado' ? ('/contact' as never) : ('/login' as never)}
                className={`mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  plan.highlight
                    ? 'bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5'
                    : 'text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35]'
                }`}
              >
                {plan.price === 'Personalizado' ? 'Contactar ventas' : 'Comenzar ahora'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table — Zebra striping with tonal shifts, no horizontal dividers */}
      <section className="px-6 pb-32 pt-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d2bbff] mb-4 text-center">Comparativa</p>
          <h2 className="text-2xl font-extrabold text-[#e0e2f1] text-center mb-16 tracking-[-0.02em]">Comparativa de funcionalidades</h2>

          <div
            className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] overflow-hidden"
            style={{ border: '1px solid rgba(74,68,85,0.10)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#181b26]">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] px-6 py-5 w-1/4">Funcionalidad</th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-[#958da1] px-6 py-5">Básico</th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d2bbff] px-6 py-5">Profesional</th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-[#958da1] px-6 py-5">Empresarial</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-[#0a0e18]/40' : 'bg-[#181b26]/40'}>
                      <td className="text-sm text-[#ccc3d8] px-6 py-4 font-[family-name:var(--font-inter)]">{row.label}</td>
                      <td className="text-center px-6 py-4"><CellValue value={row.basic} /></td>
                      <td className="text-center px-6 py-4 bg-[#7C3AED]/[0.04]"><CellValue value={row.pro} /></td>
                      <td className="text-center px-6 py-4"><CellValue value={row.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-32 text-center">
        <h2 className="text-2xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">¿No estás seguro?</h2>
        <p className="mt-4 text-[#958da1] font-[family-name:var(--font-inter)]">Solicita una demostración personalizada y te ayudamos a elegir el plan ideal.</p>
        <Link
          href={'/contact' as never}
          className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold bg-gradient-to-r from-[#10B981] to-[#047857] text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 transition-all duration-200"
        >
          Solicitar demo
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  );
}
