/**
 * Localized email templates for NominaSmart.
 *
 * Each template function returns `{ subject, html }` in the requested locale.
 * Supported locales: en, es, pt. Falls back to "es" for unknown locales.
 *
 * Validates: Requirements 8.5, 8.7
 */

export interface EmailTemplate {
  subject: string;
  html: string;
}

type Locale = 'en' | 'es' | 'pt';

// ── Shared helpers ──────────────────────────────────────────────────

function resolveLocale(locale: string): Locale {
  if (locale === 'en' || locale === 'es' || locale === 'pt') return locale;
  return 'es'; // default fallback per design doc
}

function wrapLayout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f7;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background-color:#2563eb;padding:20px 24px;">
            <span style="color:#ffffff;font-size:22px;font-weight:bold;">NominaSmart</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;font-size:12px;color:#888;border-top:1px solid #eee;text-align:center;">
            &copy; ${new Date().getFullYear()} NominaSmart
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── User Invitation Template ────────────────────────────────────────

const invitationStrings: Record<Locale, { subject: string; greeting: string; body: string; cta: string }> = {
  en: {
    subject: 'You have been invited to NominaSmart',
    greeting: 'Hello',
    body: 'You have been invited to join NominaSmart. Click the button below to set up your account.',
    cta: 'Accept Invitation',
  },
  es: {
    subject: 'Has sido invitado a NominaSmart',
    greeting: 'Hola',
    body: 'Has sido invitado a unirte a NominaSmart. Haz clic en el botón de abajo para configurar tu cuenta.',
    cta: 'Aceptar Invitación',
  },
  pt: {
    subject: 'Você foi convidado para o NominaSmart',
    greeting: 'Olá',
    body: 'Você foi convidado a se juntar ao NominaSmart. Clique no botão abaixo para configurar sua conta.',
    cta: 'Aceitar Convite',
  },
};

export function userInvitationTemplate(data: {
  displayName: string;
  inviteUrl: string;
  locale: 'en' | 'es' | 'pt';
}): EmailTemplate {
  const loc = resolveLocale(data.locale);
  const s = invitationStrings[loc];

  const body = `
    <p style="font-size:16px;">${s.greeting}, <strong>${data.displayName}</strong>!</p>
    <p>${s.body}</p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${data.inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">${s.cta}</a>
    </p>`;

  return { subject: s.subject, html: wrapLayout(body) };
}

// ── Regulatory Alert Template ───────────────────────────────────────

const alertStrings: Record<Locale, {
  subject: (country: string) => string;
  heading: string;
  country: string;
  changes: string;
  confidence: string;
  details: string;
}> = {
  en: {
    subject: (c) => `Regulatory changes detected — ${c}`,
    heading: 'Regulatory Alert',
    country: 'Country',
    changes: 'Changes detected',
    confidence: 'Confidence',
    details: 'Details',
  },
  es: {
    subject: (c) => `Cambios regulatorios detectados — ${c}`,
    heading: 'Alerta Regulatoria',
    country: 'País',
    changes: 'Cambios detectados',
    confidence: 'Confianza',
    details: 'Detalles',
  },
  pt: {
    subject: (c) => `Alterações regulatórias detectadas — ${c}`,
    heading: 'Alerta Regulatória',
    country: 'País',
    changes: 'Alterações detectadas',
    confidence: 'Confiança',
    details: 'Detalhes',
  },
};

export function regulatoryAlertTemplate(data: {
  countryName: string;
  changesCount: number;
  confidence: string;
  changesDetail: string;
  locale: 'en' | 'es' | 'pt';
}): EmailTemplate {
  const loc = resolveLocale(data.locale);
  const s = alertStrings[loc];

  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;">${s.heading}</h2>
    <table cellpadding="4" cellspacing="0" style="width:100%;font-size:14px;">
      <tr><td style="font-weight:bold;width:140px;">${s.country}:</td><td>${data.countryName}</td></tr>
      <tr><td style="font-weight:bold;">${s.changes}:</td><td>${data.changesCount}</td></tr>
      <tr><td style="font-weight:bold;">${s.confidence}:</td><td>${data.confidence}</td></tr>
    </table>
    <h3 style="margin:16px 0 8px;font-size:16px;">${s.details}</h3>
    <p style="white-space:pre-line;">${data.changesDetail}</p>`;

  return { subject: s.subject(data.countryName), html: wrapLayout(body) };
}

// ── Weekly Summary Template ─────────────────────────────────────────

const summaryStrings: Record<Locale, {
  subject: string;
  heading: string;
  country: string;
  status: string;
  changes: string;
  noSyncs: string;
}> = {
  en: {
    subject: 'NominaSmart — Weekly Sync Summary',
    heading: 'Weekly Synchronization Summary',
    country: 'Country',
    status: 'Status',
    changes: 'Changes',
    noSyncs: 'No synchronizations were executed this week.',
  },
  es: {
    subject: 'NominaSmart — Resumen Semanal de Sincronización',
    heading: 'Resumen Semanal de Sincronización',
    country: 'País',
    status: 'Estado',
    changes: 'Cambios',
    noSyncs: 'No se ejecutaron sincronizaciones esta semana.',
  },
  pt: {
    subject: 'NominaSmart — Resumo Semanal de Sincronização',
    heading: 'Resumo Semanal de Sincronização',
    country: 'País',
    status: 'Status',
    changes: 'Alterações',
    noSyncs: 'Nenhuma sincronização foi executada esta semana.',
  },
};

export function weeklySummaryTemplate(data: {
  syncs: Array<{ country: string; status: string; changes: number }>;
  locale: 'en' | 'es' | 'pt';
}): EmailTemplate {
  const loc = resolveLocale(data.locale);
  const s = summaryStrings[loc];

  let tableHtml: string;
  if (data.syncs.length === 0) {
    tableHtml = `<p>${s.noSyncs}</p>`;
  } else {
    const rows = data.syncs
      .map(
        (sync) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${sync.country}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${sync.status}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${sync.changes}</td>
          </tr>`,
      )
      .join('');

    tableHtml = `
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse;">
        <thead>
          <tr style="background-color:#f8f9fa;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">${s.country}</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #dee2e6;">${s.status}</th>
            <th style="padding:8px;text-align:center;border-bottom:2px solid #dee2e6;">${s.changes}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const body = `
    <h2 style="margin:0 0 16px;font-size:20px;">${s.heading}</h2>
    ${tableHtml}`;

  return { subject: s.subject, html: wrapLayout(body) };
}
