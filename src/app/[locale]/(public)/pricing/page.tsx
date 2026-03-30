/**
 * PricingPage — Página de planes y precios de NóminaSmart.
 *
 * Incluye las siguientes secciones:
 * - Hero con título y toggle de facturación mensual/anual (descuento 20%)
 * - Tarjetas de planes (Básico, Profesional, Empresarial) con precios dinámicos
 * - Tabla comparativa de funcionalidades por plan (agentes IA, países, soporte)
 * - Sección de preguntas frecuentes (FAQ) con acordeón animado
 * - Badge de garantía (14 días de prueba gratis)
 *
 * @module PricingPage
 */
'use client';

import { useState } from 'react';
import { ArrowRight, Check, Minus, ChevronDown, Sparkles, Shield } from 'lucide-react';
import { Link } from '@/i18n/routing';

/** Definición de los 3 planes de suscripción con precios mensuales/anuales y funcionalidades incluidas. */
const plans = [
  {
    name: 'Básico',
    monthlyPrice: 399000,
    yearlyPrice: 319000,
    currency: 'COP',
    description: 'Para pequeñas empresas que inician con auditoría de nómina en Colombia.',
    highlight: false,
    features: {
      employees: 'Hasta 50 empleados',
      uploads: '5 cargas/mes',
      agents: 'Juli (Auditora) + Gyoru (Mapeador)',
      reports: 'Reportes básicos',
      providers: '1 proveedor de IA',
      countries: 'Colombia',
      support: 'Email',
    },
  },
  {
    name: 'Profesional',
    monthlyPrice: 1190000,
    yearlyPrice: 949000,
    currency: 'COP',
    description: 'Para empresas medianas con necesidades avanzadas de cumplimiento.',
    highlight: true,
    features: {
      employees: 'Hasta 500 empleados',
      uploads: 'Cargas ilimitadas',
      agents: 'Todos los 7 agentes IA',
      reports: 'Reportes ejecutivos completos',
      providers: '3 proveedores de IA',
      countries: 'Colombia + 2 países',
      support: 'Chat prioritario',
    },
  },
  {
    name: 'Empresarial',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: '',
    description: 'Para grandes empresas y multinacionales con operación en Colombia.',
    highlight: false,
    isCustom: true,
    features: {
      employees: 'Empleados ilimitados',
      uploads: 'Cargas ilimitadas',
      agents: 'Todos los agentes + Soul (Investigadora)',
      reports: 'Reportes personalizados',
      providers: 'Proveedores ilimitados',
      countries: 'Todos los países',
      support: 'Dedicado 24/7',
    },
  },
];

/** Filas de la tabla comparativa de funcionalidades entre los 3 planes (Básico, Profesional, Empresarial). */
const comparisonFeatures = [
  { label: 'Empleados', basic: 'Hasta 50', pro: 'Hasta 500', enterprise: 'Ilimitados' },
  { label: 'Cargas mensuales', basic: '5', pro: 'Ilimitadas', enterprise: 'Ilimitadas' },
  { label: '🔍 Juli (Auditora)', basic: true, pro: true, enterprise: true },
  { label: '🐈‍⬛ Gyoru (Mapeador)', basic: true, pro: true, enterprise: true },
  { label: '⚙️ Wil (Corrector)', basic: false, pro: true, enterprise: true },
  { label: '📝 Ana (Redactora)', basic: false, pro: true, enterprise: true },
  { label: '🐰 Luni (Experta Nómina)', basic: false, pro: true, enterprise: true },
  { label: '🐕 Soul (Investigadora)', basic: false, pro: false, enterprise: true },
  { label: '👑 Dianis (Orquestadora)', basic: true, pro: true, enterprise: true },
  { label: 'Bus de Agentes', basic: false, pro: false, enterprise: true },
  { label: 'Multi-país', basic: '1 país', pro: '3 países', enterprise: 'Todos' },
  { label: 'Multi-moneda', basic: false, pro: true, enterprise: true },
  { label: 'Panel financiero', basic: false, pro: false, enterprise: true },
  { label: 'Gestión de usuarios', basic: false, pro: true, enterprise: true },
  { label: 'API access', basic: false, pro: false, enterprise: true },
  { label: 'Soporte', basic: 'Email', pro: 'Chat prioritario', enterprise: 'Dedicado 24/7' },
];

/** Preguntas frecuentes sobre planes, pagos, prueba gratuita, seguridad y expansión multi-país. */
const faqs = [
  {
    q: '¿Puedo cambiar de plan en cualquier momento?',
    a: 'Sí, puedes actualizar o reducir tu plan cuando quieras. Los cambios se aplican de forma prorrateada en tu próximo ciclo de facturación.',
  },
  {
    q: '¿Qué métodos de pago aceptan?',
    a: 'Aceptamos tarjetas de crédito y débito (Visa, Mastercard, Amex), transferencia bancaria y facturación corporativa para el plan Empresarial.',
  },
  {
    q: '¿Hay un período de prueba gratuito?',
    a: 'Sí, todos los planes incluyen 14 días de prueba gratuita con acceso completo a las funcionalidades del plan seleccionado.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Absolutamente. Usamos cifrado AES-256 en reposo y TLS 1.3 en tránsito. Cumplimos con estándares SOC 2 y las regulaciones de protección de datos de cada país.',
  },
  {
    q: '¿Puedo agregar más países después?',
    a: 'Sí, puedes agregar países adicionales en cualquier momento. El plan Empresarial incluye todos los países sin costo adicional.',
  },
];

/**
 * Celda de la tabla comparativa que renderiza un check/minus para booleanos
 * o texto para valores string.
 *
 * @param props.value - Valor booleano (check/minus) o string a mostrar.
 * @returns Icono de check/minus o texto con estilo.
 */
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

/**
 * Elemento de FAQ con acordeón animado (expand/collapse).
 *
 * @param props.q - Pregunta a mostrar como título del acordeón.
 * @param props.a - Respuesta que se revela al expandir.
 * @returns Acordeón con animación de altura y opacidad.
 */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="bg-[#1c1f2a] rounded-[1.25rem] overflow-hidden transition-all duration-200"
      style={{ border: '1px solid rgba(74,68,85,0.10)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-sm font-semibold text-[#e0e2f1] pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-[#958da1] shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-6 pb-5 text-sm text-[#958da1] leading-relaxed font-[family-name:var(--font-inter)]">{a}</p>
      </div>
    </div>
  );
}

/**
 * Página de planes y precios de NóminaSmart.
 *
 * Renderiza hero con toggle mensual/anual, tarjetas de planes con precios
 * dinámicos, tabla comparativa de funcionalidades, FAQ con acordeón y badge
 * de garantía de prueba gratuita.
 *
 * @returns La página de precios completa con todas las secciones.
 */
export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="relative">
      {/* Hero */}
      <section className="pt-28 pb-8 px-6 text-center relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#7C3AED]/[0.1] rounded-full blur-[150px]" />
        </div>
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">Precios</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">Planes y precios</h1>
          <p className="mt-5 text-[#958da1] max-w-xl mx-auto text-lg font-[family-name:var(--font-inter)]">
            Elige el plan que mejor se adapte al tamaño y necesidades de tu empresa.
          </p>

          {/* Billing toggle */}
          <div className="mt-10 inline-flex items-center gap-4 bg-[#1c1f2a] rounded-full p-1.5" style={{ border: '1px solid rgba(74,68,85,0.15)' }}>
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !annual ? 'bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]' : 'text-[#958da1] hover:text-[#ccc3d8]'
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                annual ? 'bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)]' : 'text-[#958da1] hover:text-[#ccc3d8]'
              }`}
            >
              Anual
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                annual ? 'bg-white/20 text-white' : 'bg-[#10B981]/15 text-[#4edea3]'
              }`}>
                -20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-6 pb-32 pt-12">
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const price = annual ? plan.yearlyPrice : plan.monthlyPrice;
            const isCustom = 'isCustom' in plan && plan.isCustom;
            return (
              <div
                key={plan.name}
                className={`relative bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  plan.highlight ? 'md:-mt-4 md:mb-4' : ''
                }`}
                style={{
                  border: plan.highlight
                    ? '1px solid rgba(124,58,237,0.25)'
                    : '1px solid rgba(74,68,85,0.10)',
                  boxShadow: plan.highlight
                    ? '0 0 40px rgba(124,58,237,0.12), 0 20px 60px rgba(0,0,0,0.3)'
                    : 'none',
                }}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#7C3AED] text-white text-xs font-semibold shadow-[0_0_12px_rgba(124,58,237,0.4)] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    Más popular
                  </div>
                )}

                <h3 className="text-xl font-extrabold text-[#e0e2f1]">{plan.name}</h3>
                <p className="mt-2 text-[#958da1] text-sm font-[family-name:var(--font-inter)]">{plan.description}</p>

                <div className="mt-8 mb-8">
                  {isCustom ? (
                    <span className="text-2xl font-extrabold text-[#e0e2f1]">Personalizado</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">${price}</span>
                      <span className="text-[#4cd7f6] text-xs font-semibold uppercase tracking-[0.1em]">
                        {plan.currency}/{annual ? 'mes (anual)' : 'mes'}
                      </span>
                    </div>
                  )}
                  {annual && !isCustom && (
                    <p className="mt-1 text-xs text-[#4edea3]">
                      Ahorras ${(plan.monthlyPrice - plan.yearlyPrice) * 12}/año
                    </p>
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
                  href={isCustom ? ('/contact' as never) : ('/login' as never)}
                  className={`mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                    plan.highlight
                      ? 'bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5'
                      : 'text-[#d2bbff] hover:text-[#e0e2f1] hover:bg-[#262a35]'
                  }`}
                  style={!plan.highlight ? { border: '1px solid rgba(124,58,237,0.15)' } : undefined}
                >
                  {isCustom ? 'Contactar ventas' : 'Comenzar ahora'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Guarantee badge */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1c1f2a] text-sm text-[#958da1]" style={{ border: '1px solid rgba(74,68,85,0.1)' }}>
            <Shield className="w-4 h-4 text-[#4edea3]" />
            14 días de prueba gratis · Sin tarjeta de crédito
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#e0e2f1] text-center mb-12 tracking-[-0.02em]">
            Comparación detallada
          </h2>
          <div className="overflow-x-auto rounded-[1.5rem] bg-[#1c1f2a]" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#4a4455]/10">
                  <th className="text-left px-6 py-4 text-[#958da1] font-medium">Funcionalidad</th>
                  <th className="text-center px-6 py-4 text-[#958da1] font-medium">Básico</th>
                  <th className="text-center px-6 py-4 text-[#d2bbff] font-semibold">Profesional</th>
                  <th className="text-center px-6 py-4 text-[#958da1] font-medium">Empresarial</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row) => (
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

      {/* FAQ */}
      <section className="px-6 pb-32">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4cd7f6] mb-4">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#e0e2f1] tracking-[-0.02em]">
              Preguntas frecuentes
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
