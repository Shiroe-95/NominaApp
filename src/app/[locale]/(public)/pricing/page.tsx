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
      <Check className="w-4 h-4 text-emerald-light mx-auto" />
    ) : (
      <Minus className="w-4 h-4 text-slate-600 mx-auto" />
    );
  }
  return <span className="text-slate-300 text-sm">{value}</span>;
}

export default function PricingPage() {
  return (
    <div className="relative">
      {/* Header */}
      <section className="pt-20 pb-16 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white">
          Planes y precios
        </h1>
        <p className="mt-4 text-slate-400 max-w-xl mx-auto text-lg">
          Elige el plan que mejor se adapte al tamaño y necesidades de tu empresa.
        </p>
      </section>

      {/* Plans Grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`glass-panel rounded-2xl p-8 flex flex-col relative ${
                plan.highlight
                  ? 'border-violet/40 shadow-[0_0_30px_rgba(124,58,237,0.15)]'
                  : ''
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet to-violet-dark text-white text-xs font-semibold">
                  Más popular
                </div>
              )}

              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-2 text-slate-400 text-sm">{plan.description}</p>

              <div className="mt-6 mb-8">
                {plan.currency ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.currency}{plan.period}</span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                )}
              </div>

              <ul className="space-y-3 flex-1">
                {Object.values(plan.features).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-light mt-0.5 shrink-0" />
                    <span className="text-slate-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={'/login' as never}
                className={`mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 border border-white/10 ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-violet to-violet-dark text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:shadow-[0_0_25px_rgba(124,58,237,0.6)] hover:-translate-y-0.5'
                    : 'glass-panel text-slate-200 hover:bg-white/10 hover:border-violet/50'
                }`}
              >
                {plan.price === 'Personalizado' ? 'Contactar ventas' : 'Comenzar ahora'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-6 pb-24 border-t border-white/5 pt-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            Comparativa de funcionalidades
          </h2>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-sm font-medium text-slate-400 px-6 py-4 w-1/4">
                      Funcionalidad
                    </th>
                    <th className="text-center text-sm font-medium text-slate-400 px-6 py-4">
                      Básico
                    </th>
                    <th className="text-center text-sm font-medium text-violet-light px-6 py-4">
                      Profesional
                    </th>
                    <th className="text-center text-sm font-medium text-slate-400 px-6 py-4">
                      Empresarial
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((row, i) => (
                    <tr
                      key={row.label}
                      className={`border-b border-white/5 ${
                        i % 2 === 0 ? 'bg-white/[0.02]' : ''
                      }`}
                    >
                      <td className="text-sm text-slate-300 px-6 py-3.5">{row.label}</td>
                      <td className="text-center px-6 py-3.5">
                        <CellValue value={row.basic} />
                      </td>
                      <td className="text-center px-6 py-3.5 bg-violet/5">
                        <CellValue value={row.pro} />
                      </td>
                      <td className="text-center px-6 py-3.5">
                        <CellValue value={row.enterprise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 text-center">
        <h2 className="text-2xl font-bold text-white">¿No estás seguro?</h2>
        <p className="mt-3 text-slate-400">
          Solicita una demostración personalizada y te ayudamos a elegir el plan ideal.
        </p>
        <Link
          href={'/contact' as never}
          className="mt-6 inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-semibold bg-gradient-to-r from-emerald to-emerald-dark text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:-translate-y-0.5 transition-all duration-200 border border-white/10"
        >
          Solicitar demo
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  );
}
