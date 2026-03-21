'use client';

import { useState } from 'react';
import { Send, CheckCircle2, Mail, Building2, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="relative">
      {/* Header */}
      <section className="pt-20 pb-16 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white">
          Solicita una demostración
        </h1>
        <p className="mt-4 text-slate-400 max-w-xl mx-auto text-lg">
          Completa el formulario y nuestro equipo te contactará para agendar una demo
          personalizada de NóminaSmart.
        </p>
      </section>

      {/* Form Section */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-xl">
          {submitted ? (
            <div className="glass-panel rounded-2xl p-12 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-light" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                ¡Solicitud enviada!
              </h2>
              <p className="text-slate-400">
                Nuestro equipo se pondrá en contacto contigo en las próximas 24 horas
                para agendar tu demostración personalizada.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="glass-panel rounded-2xl p-8 space-y-6"
            >
              {/* Name */}
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium text-slate-300">
                  Nombre completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet transition-all"
                    placeholder="Tu nombre"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-300">
                  Correo electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="block w-full pl-10 pr-4 h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet transition-all"
                    placeholder="tu@empresa.com"
                  />
                </div>
              </div>

              {/* Company */}
              <div className="space-y-1.5">
                <label htmlFor="company" className="text-sm font-medium text-slate-300">
                  Empresa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet transition-all"
                    placeholder="Nombre de tu empresa"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label htmlFor="message" className="text-sm font-medium text-slate-300">
                  Mensaje
                  <span className="text-slate-500 font-normal"> (opcional)</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3.5 pointer-events-none">
                    <MessageSquare className="h-4 w-4 text-slate-500" />
                  </div>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    className="block w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet transition-all resize-none"
                    placeholder="Cuéntanos sobre tus necesidades de auditoría de nómina..."
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Enviar solicitud
                    <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                Al enviar este formulario aceptas que te contactemos para agendar la demostración.
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
