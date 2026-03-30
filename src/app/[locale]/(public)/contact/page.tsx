'use client';

import { useState } from 'react';
import { Send, CheckCircle2, Mail, Building2, User, MessageSquare, Phone, MapPin, Clock, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ContactPage() {
  const t = useTranslations('Public');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setSubmitted(true);
  };

  const contactInfo = [
    { icon: Mail, label: t('contactEmail'), value: t('contactEmailValue'), href: 'mailto:hola@nominasmart.com' },
    { icon: Phone, label: t('contactPhone'), value: t('contactPhoneValue'), href: 'tel:+576012345678' },
    { icon: Clock, label: t('contactHours'), value: t('contactHoursValue') },
    { icon: MapPin, label: t('contactOffice'), value: t('contactOfficeValue') },
  ];

  const inputClass = "block w-full pl-10 pr-4 h-11 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none focus:border-[#7C3AED]/60 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all font-[family-name:var(--font-inter)]";
  const inputBorder = { border: '1px solid rgba(74,68,85,0.15)' };

  return (
    <div className="relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-[#7C3AED]/[0.12] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#10B981]/[0.08] rounded-full blur-[100px]" />
      </div>

      <section className="pt-28 pb-8 px-6 text-center relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4edea3] mb-4">{t('contact')}</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-[#e0e2f1] tracking-[-0.03em]">{t('contactHeroTitle')}</h1>
        <p className="mt-5 text-[#958da1] max-w-xl mx-auto text-lg font-[family-name:var(--font-inter)]">{t('contactHeroDesc')}</p>
      </section>

      <section className="px-6 pb-32 pt-8 relative">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#1c1f2a] rounded-[1.5rem] p-6 space-y-5" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
              <h3 className="text-sm font-bold text-[#e0e2f1]">{t('contactInfoTitle')}</h3>
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
              <h3 className="text-sm font-bold text-[#e0e2f1] mb-4">{t('presenceTitle')}</h3>
              <div className="flex flex-wrap gap-2">
                {t('presenceCountries').split(', ').map((country) => (
                  <span key={country} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181b26] text-xs text-[#ccc3d8] font-medium">
                    <MapPin className="w-3 h-3 text-[#4edea3]" />{country}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#181b26] text-xs text-[#4edea3]" style={{ border: '1px solid rgba(16,185,129,0.1)' }}>
              <Shield className="w-4 h-4" />{t('securityBadge')}
            </div>
          </div>

          <div className="lg:col-span-3">
            {submitted ? (
              <div className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-12 text-center" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
                <div className="w-16 h-16 rounded-full bg-[#181b26] flex items-center justify-center mx-auto mb-6" style={{ boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}>
                  <CheckCircle2 className="w-8 h-8 text-[#4edea3]" />
                </div>
                <h2 className="text-2xl font-extrabold text-[#e0e2f1] mb-3">{t('formSuccessTitle')}</h2>
                <p className="text-[#958da1] font-[family-name:var(--font-inter)]">{t('formSuccessDesc')}</p>
                <button onClick={() => setSubmitted(false)} className="mt-6 text-sm text-[#d2bbff] hover:text-[#e0e2f1] transition-colors">{t('formSendAnother')}</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#1c1f2a] backdrop-blur-[12px] rounded-[1.5rem] p-8 space-y-5" style={{ border: '1px solid rgba(74,68,85,0.10)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">{t('formName')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><User className="h-4 w-4 text-[#958da1]" /></div>
                      <input id="name" name="name" type="text" required className={inputClass} style={inputBorder} placeholder={t('formNamePlaceholder')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">{t('formEmail')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-4 w-4 text-[#958da1]" /></div>
                      <input id="email" name="email" type="email" required className={inputClass} style={inputBorder} placeholder={t('formEmailPlaceholder')} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">{t('formCompany')}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Building2 className="h-4 w-4 text-[#958da1]" /></div>
                      <input id="company" name="company" type="text" required className={inputClass} style={inputBorder} placeholder={t('formCompanyPlaceholder')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                      {t('formPhone')} <span className="text-[#958da1] font-normal normal-case tracking-normal">({t('optional')})</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Phone className="h-4 w-4 text-[#958da1]" /></div>
                      <input id="phone" name="phone" type="tel" className={inputClass} style={inputBorder} placeholder={t('formPhonePlaceholder')} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="employees" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                    {t('formEmployees')} <span className="text-[#958da1] font-normal normal-case tracking-normal">({t('optional')})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><User className="h-4 w-4 text-[#958da1]" /></div>
                    <select id="employees" name="employees" className={`${inputClass} appearance-none cursor-pointer`} style={inputBorder}>
                      <option value="">{t('formEmployeesPlaceholder')}</option>
                      <option value="1-50">{t('emp1to50')}</option>
                      <option value="51-200">{t('emp51to200')}</option>
                      <option value="201-500">{t('emp201to500')}</option>
                      <option value="500+">{t('emp500plus')}</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="message" className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4cd7f6]">
                    {t('formMessage')} <span className="text-[#958da1] font-normal normal-case tracking-normal">({t('optional')})</span>
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 pointer-events-none"><MessageSquare className="h-4 w-4 text-[#958da1]" /></div>
                    <textarea id="message" name="message" rows={4}
                      className="block w-full pl-10 pr-4 py-3 rounded-[0.75rem] bg-[#0a0e18] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none focus:border-[#7C3AED]/60 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all resize-none font-[family-name:var(--font-inter)]"
                      style={inputBorder} placeholder={t('formMessagePlaceholder')} />
                  </div>
                </div>
                <button type="submit" disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white shadow-[0_0_12px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none group">
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>{t('formSubmit')}<Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                  )}
                </button>
                <p className="text-xs text-[#958da1] text-center font-[family-name:var(--font-inter)]">{t('formDisclaimer')}</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
