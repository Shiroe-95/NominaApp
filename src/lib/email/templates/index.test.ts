import { describe, it, expect } from 'vitest';
import {
  userInvitationTemplate,
  regulatoryAlertTemplate,
  weeklySummaryTemplate,
} from './index';

describe('userInvitationTemplate', () => {
  const base = { displayName: 'Ana', inviteUrl: 'https://app.test/invite/abc' };

  it('returns subject and html in English', () => {
    const result = userInvitationTemplate({ ...base, locale: 'en' });
    expect(result.subject).toBe('You have been invited to NominaSmart');
    expect(result.html).toContain('Ana');
    expect(result.html).toContain('https://app.test/invite/abc');
    expect(result.html).toContain('Accept Invitation');
  });

  it('returns subject and html in Spanish', () => {
    const result = userInvitationTemplate({ ...base, locale: 'es' });
    expect(result.subject).toBe('Has sido invitado a NominaSmart');
    expect(result.html).toContain('Aceptar Invitación');
  });

  it('returns subject and html in Portuguese', () => {
    const result = userInvitationTemplate({ ...base, locale: 'pt' });
    expect(result.subject).toContain('convidado');
    expect(result.html).toContain('Aceitar Convite');
  });

  it('includes NominaSmart branding', () => {
    const result = userInvitationTemplate({ ...base, locale: 'en' });
    expect(result.html).toContain('NominaSmart');
  });
});

describe('regulatoryAlertTemplate', () => {
  const base = {
    countryName: 'Colombia',
    changesCount: 3,
    confidence: 'high',
    changesDetail: 'SMMLV updated to $1,423,500',
  };

  it('returns localized subject with country name (en)', () => {
    const result = regulatoryAlertTemplate({ ...base, locale: 'en' });
    expect(result.subject).toBe('Regulatory changes detected — Colombia');
    expect(result.html).toContain('Colombia');
    expect(result.html).toContain('3');
    expect(result.html).toContain('high');
    expect(result.html).toContain('SMMLV updated');
  });

  it('returns localized subject with country name (es)', () => {
    const result = regulatoryAlertTemplate({ ...base, locale: 'es' });
    expect(result.subject).toBe('Cambios regulatorios detectados — Colombia');
    expect(result.html).toContain('Alerta Regulatoria');
  });

  it('returns localized subject with country name (pt)', () => {
    const result = regulatoryAlertTemplate({ ...base, locale: 'pt' });
    expect(result.subject).toContain('Alterações regulatórias');
    expect(result.html).toContain('Alerta Regulatória');
  });
});

describe('weeklySummaryTemplate', () => {
  const syncs = [
    { country: 'Colombia', status: 'completed', changes: 2 },
    { country: 'Mexico', status: 'failed', changes: 0 },
  ];

  it('returns localized subject and table rows (en)', () => {
    const result = weeklySummaryTemplate({ syncs, locale: 'en' });
    expect(result.subject).toContain('Weekly Sync Summary');
    expect(result.html).toContain('Colombia');
    expect(result.html).toContain('Mexico');
    expect(result.html).toContain('completed');
    expect(result.html).toContain('failed');
  });

  it('returns localized subject and table rows (es)', () => {
    const result = weeklySummaryTemplate({ syncs, locale: 'es' });
    expect(result.subject).toContain('Resumen Semanal');
  });

  it('returns localized subject and table rows (pt)', () => {
    const result = weeklySummaryTemplate({ syncs, locale: 'pt' });
    expect(result.subject).toContain('Resumo Semanal');
  });

  it('handles empty syncs array', () => {
    const result = weeklySummaryTemplate({ syncs: [], locale: 'en' });
    expect(result.html).toContain('No synchronizations were executed this week.');
  });

  it('handles empty syncs array (es)', () => {
    const result = weeklySummaryTemplate({ syncs: [], locale: 'es' });
    expect(result.html).toContain('No se ejecutaron sincronizaciones esta semana.');
  });
});
