'use client';

import { useState } from 'react';
import { Send, CheckCircle2, Mail, Building2, User, MessageSquare, Phone } from 'lucide-react';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#7C3AED]/[0.12] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#10B981]/[0.08] rounded-full blur-[100px]" />
      </div>

      <section className="pt-28 pb-16 px-6 text-center relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">Contacto</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">Solicita una demostración</h1>
        <p className="mt-5 text-[#958da1] max-w-xl mx-auto text-lg font-[family-name:var(--font-inter)]">
          Completa el formulario y nuestro equipo te contactará para agendar una demo personalizada.
        </p>
      </section>

      <section className="px-6 pb-32 relative">
        <div className="mx-auto max-w-lg">
          {submitted ? (
            <div
              className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-12 text-center animate-fade-in"
              style={{ border: '1px solid rgba(74,68,85,0.10)' }}
            >
              <div className="w-16 h-16 rounded-full bg-[#181b26] flex items-center justify-center mx-auto mb-6" style={{ boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}>
                <CheckCircle2 className="w-8 h-8 text-[#4edea3]" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#e0e2f1] mb-3">¡Solicitud enviada!</h2>
              <p className="text-[#958da1] font-[family-name:var(--font-inter)]">
                Nuestro equipo se pondrá en contacto contigo en las próximas 24 horas.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 space-y-6"
              style={{ border: '1px solid rgba(74,68,85,0.10)' }}
            >
              {/* Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">Nombre completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-[#958da1]" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 h-11 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none transition-all font-[family-name:var(--font-inter)]"
                    style={{ border: '1px solid rgba(74,68,85,0.15)' }}
                    placeholder="Tu nombre"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">Correo electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-[#958da1]" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="block w-full pl-10 pr-4 h-11 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none transition-all font-[family-name:var(--font-inter)]"
                    style={{ border: '1px solid rgba(74,68,85,0.15)' }}
                    placeholder="tu@empresa.com"
                  />
                </div>
              </div>

              {/* Company */}
              <div className="space-y-2">
                <label htmlFor="company" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">Empresa</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 className="h-4 w-4 text-[#958da1]" />
                  </div>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 h-11 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none transition-all font-[family-name:var(--font-inter)]"
                    style={{ border: '1px solid rgba(74,68,85,0.15)' }}
                    placeholder="Nombre de tu empresa"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label htmlFor="phone" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                  Teléfono <span className="text-[#958da1] font-normal normal-case tracking-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-[#958da1]" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="block w-full pl-10 pr-4 h-11 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none transition-all font-[family-name:var(--font-inter)]"
                    style={{ border: '1px solid rgba(74,68,85,0.15)' }}
                    placeholder="+1 000 000 0000"
                  />
                </div>
              </div>

              {/* Message */}
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
                    className="block w-full pl-10 pr-4 py-3 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none transition-all resize-none font-[family-name:var(--font-inter)]"
                    style={{ border: '1px solid rgba(74,68,85,0.15)' }}
                    placeholder="Cuéntanos sobre tus necesidades de auditoría de nómina..."
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Enviar solicitud
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-xs text-[#958da1] text-center font-[family-name:var(--font-inter)]">
                Al enviar este formulario aceptas que te contactemos para agendar la demostración.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
