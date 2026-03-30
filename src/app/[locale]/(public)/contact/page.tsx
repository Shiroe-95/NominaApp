'use client';

/**
 * ContactPage — Página de contacto y solicitud de demostración de NóminaSmart.
 *
 * Incluye las siguientes secciones:
 * - Hero con título y descripción
 * - Sidebar con información de contacto (email, teléfono, horario, oficina),
 *   mapa de presencia en LATAM y badge de seguridad
 * - Formulario de solicitud de demo con campos: nombre, email, empresa,
 *   teléfono (opcional), número de empleados (opcional) y mensaje (opcional)
 * - Estado de confirmación post-envío con opción de reenvío
 *
 * @module ContactPage
 */

import { useState } from 'react';
import { Send, CheckCircle2, Mail, Building2, User, MessageSquare, Phone, MapPin, Clock, Shield } from 'lucide-react';

/** Datos de contacto mostrados en el sidebar (email, teléfono, horario, oficina). */
const contactInfo = [
  { icon: Mail, label: 'Email', value: 'hola@nominasmart.com', href: 'mailto:hola@nominasmart.com' },
  { icon: Phone, label: 'Teléfono', value: '+57 601 234 5678', href: 'tel:+576012345678' },
  { icon: Clock, label: 'Horario', value: 'Lun-Vie 8:00 - 18:00 COT' },
  { icon: MapPin, label: 'Oficina', value: 'Bogotá, Colombia' },
];

/** Países con presencia activa de NóminaSmart en Latinoamérica. */
const presenceCountries = ['Colombia', 'México', 'Perú', 'Chile', 'Brasil', 'Argentina', 'Ecuador'];

/**
 * Página de contacto y solicitud de demostración.
 *
 * Renderiza un layout de 2 columnas (sidebar informativo + formulario) con
 * manejo de estado para envío simulado y confirmación visual post-envío.
 *
 * @returns La página de contacto con formulario de solicitud de demo.
 */
export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Maneja el envío del formulario de contacto.
   * Simula una petición al servidor con un delay de 1 segundo.
   * @param e - Evento del formulario.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setSubmitted(true);
  };

  const inputClass = "block w-full pl-10 pr-4 h-11 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none focus:border-[#7C3AED]/60 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all font-[family-name:var(--font-inter)]";
  const inputBorder = { border: '1px solid rgba(74,68,85,0.15)' };

  return (
    <div className="relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#7C3AED]/[0.12] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#10B981]/[0.08] rounded-full blur-[100px]" />
      </div>

      <section className="pt-28 pb-8 px-6 text-center relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">Contacto</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">Solicita una demostración</h1>
        <p className="mt-5 text-[#958da1] max-w-xl mx-auto text-lg font-[family-name:var(--font-inter)]">
          Completa el formulario y nuestro equipo te contactará para agendar una demo personalizada.
        </p>
      </section>

      <section className="px-6 pb-32 pt-8 relative">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Sidebar info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1c1f2a] rounded-[1.5rem] p-6 space-y-5" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
              <h3 className="text-sm font-bold text-[#e0e2f1]">Información de contacto</h3>
              {contactInfo.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#181b26] flex items-center justify-center shrink-0" style={{ boxShadow: '0 0 8px rgba(124,58,237,0.1)' }}>
                    <item.icon className="w-4 h-4 text-[#d2bbff]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-sm text-[#ccc3d8] hover:text-[#e0e2f1] transition-colors font-[family-name:var(--font-inter)]">{item.value}</a>
                    ) : (
                      <p className="text-sm text-[#ccc3d8] font-[family-name:var(--font-inter)]">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#1c1f2a] rounded-[1.5rem] p-6" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
              <h3 className="text-sm font-bold text-[#e0e2f1] mb-4">Presencia en LATAM</h3>
              <div className="flex flex-wrap gap-2">
                {presenceCountries.map((country) => (
                  <span key={country} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181b26] text-xs text-[#ccc3d8] font-medium">
                    <MapPin className="w-3 h-3 text-[#4edea3]" />
                    {country}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#181b26] text-xs text-[#4edea3]" style={{ border: '1px solid rgba(16,185,129,0.1)' }}>
              <Shield className="w-4 h-4" />
              Tus datos están protegidos con cifrado de extremo a extremo
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div
                className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-12 text-center"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="w-16 h-16 rounded-full bg-[#181b26] flex items-center justify-center mx-auto mb-6" style={{ boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}>
                  <CheckCircle2 className="w-8 h-8 text-[#4edea3]" />
                </div>
                <h2 className="text-2xl font-extrabold text-[#e0e2f1] mb-3">¡Solicitud enviada!</h2>
                <p className="text-[#958da1] font-[family-name:var(--font-inter)]">
                  Nuestro equipo se pondrá en contacto contigo en las próximas 24 horas.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-6 text-sm text-[#d2bbff] hover:text-[#e0e2f1] transition-colors"
                >
                  Enviar otra solicitud
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 space-y-5"
                style={{ border: '1px solid rgba(74,68,85,0.10)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">Nombre completo</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-[#958da1]" />
                      </div>
                      <input id="name" name="name" type="text" required className={inputClass} style={inputBorder} placeholder="Tu nombre" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">Correo electrónico</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-[#958da1]" />
                      </div>
                      <input id="email" name="email" type="email" required className={inputClass} style={inputBorder} placeholder="tu@empresa.com" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">Empresa</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Building2 className="h-4 w-4 text-[#958da1]" />
                      </div>
                      <input id="company" name="company" type="text" required className={inputClass} style={inputBorder} placeholder="Nombre de tu empresa" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                      Teléfono <span className="text-[#958da1] font-normal normal-case tracking-normal">(opcional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-[#958da1]" />
                      </div>
                      <input id="phone" name="phone" type="tel" className={inputClass} style={inputBorder} placeholder="+1 000 000 0000" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="employees" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                    Número de empleados <span className="text-[#958da1] font-normal normal-case tracking-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-[#958da1]" />
                    </div>
                    <select id="employees" name="employees" className={`${inputClass} appearance-none cursor-pointer`} style={inputBorder}>
                      <option value="">Selecciona un rango</option>
                      <option value="1-50">1 - 50</option>
                      <option value="51-200">51 - 200</option>
                      <option value="201-500">201 - 500</option>
                      <option value="500+">Más de 500</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                    Mensaje <span className="text-[#958da1] font-normal normal-case tracking-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 pointer-events-none">
                      <MessageSquare className="h-4 w-4 text-[#958da1]" />
                    </div>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      className="block w-full pl-10 pr-4 py-3 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none focus:border-[#7C3AED]/60 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all resize-none font-[family-name:var(--font-inter)]"
                      style={inputBorder}
                      placeholder="Cuéntanos sobre tus necesidades de auditoría de nómina..."
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none group"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Enviar solicitud
                      <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-xs text-[#958da1] text-center font-[family-name:var(--font-inter)]">
                  Al enviar este formulario aceptas que te contactemos para agendar la demostración.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
