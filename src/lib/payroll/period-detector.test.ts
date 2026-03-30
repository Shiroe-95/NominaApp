import { describe, it, expect } from 'vitest';
import { detectPeriodFromValues, SPANISH_MONTHS } from './period-detector';

describe('detectPeriodFromValues', () => {
  it('detects month name "enero" as month 1', () => {
    const result = detectPeriodFromValues(['Periodo: enero 2025']);
    expect(result.month).toBe(1);
    expect(result.year).toBe(2025);
  });

  it('detects month name "diciembre" as month 12', () => {
    const result = detectPeriodFromValues(['diciembre', '2024']);
    expect(result.month).toBe(12);
    expect(result.year).toBe(2024);
  });

  it('detects all 12 Spanish month names', () => {
    for (let i = 0; i < SPANISH_MONTHS.length; i++) {
      const result = detectPeriodFromValues([SPANISH_MONTHS[i]]);
      expect(result.month).toBe(i + 1);
    }
  });

  it('detects year 2020 (lower bound)', () => {
    const result = detectPeriodFromValues(['Año 2020']);
    expect(result.year).toBe(2020);
  });

  it('detects year 2030 (upper bound)', () => {
    const result = detectPeriodFromValues(['Periodo 2030']);
    expect(result.year).toBe(2030);
  });

  it('ignores years outside 2020-2030 range', () => {
    const result = detectPeriodFromValues(['Año 2019', 'Periodo 2031']);
    expect(result.year).toBeNull();
  });

  it('returns null for empty input', () => {
    const result = detectPeriodFromValues([]);
    expect(result.month).toBeNull();
    expect(result.year).toBeNull();
  });

  it('returns null when no period info found', () => {
    const result = detectPeriodFromValues(['Nombre', 'Salario', 'Cargo']);
    expect(result.month).toBeNull();
    expect(result.year).toBeNull();
  });

  it('detects month in mixed-case text', () => {
    const result = detectPeriodFromValues(['FEBRERO 2025']);
    expect(result.month).toBe(2);
    expect(result.year).toBe(2025);
  });

  it('detects month embedded in longer text', () => {
    const result = detectPeriodFromValues(['Nómina del mes de marzo de 2026']);
    expect(result.month).toBe(3);
    expect(result.year).toBe(2026);
  });

  it('uses first match found for month and year', () => {
    const result = detectPeriodFromValues(['enero', 'febrero', '2025', '2026']);
    expect(result.month).toBe(1);
    expect(result.year).toBe(2025);
  });

  it('handles null and undefined values gracefully', () => {
    const result = detectPeriodFromValues([
      '',
      'null',
      'undefined',
      'septiembre 2025',
    ]);
    expect(result.month).toBe(9);
    expect(result.year).toBe(2025);
  });
});
