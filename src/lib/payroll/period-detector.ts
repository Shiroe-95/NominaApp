/**
 * Detección automática de periodo desde contenido de archivos de nómina.
 *
 * Escanea las primeras 20 filas de cada hoja de un workbook buscando
 * nombres de meses en español y años entre 2020-2030.
 *
 * Reglas de negocio:
 * - Se escanean máximo 20 filas por hoja (MAX_SCAN_ROWS).
 * - Los meses se detectan por nombre en español (ej: "enero", "febrero").
 * - Los años válidos son 2020–2030, coincidiendo con el rango de `country_year_rules`.
 * - Se retorna la primera coincidencia encontrada; si ninguna hoja contiene datos, retorna null.
 * - La detección es case-insensitive y tolerante a whitespace.
 *
 * @module period-detector
 * @see Requirements 3.3
 */

import type * as XLSX from 'xlsx';

export interface DetectedPeriod {
  /** Detected month (1-12) or null if not found */
  month: number | null;
  /** Detected year (2020-2030) or null if not found */
  year: number | null;
}

/** Spanish month names used for detection (lowercase). */
export const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/** Maximum number of rows to scan for period detection. */
const MAX_SCAN_ROWS = 20;

/**
 * Rango de años válidos para detección.
 *
 * Regla de negocio: solo se reconocen años entre 2020 y 2030 inclusive,
 * alineado con el rango de `period_year` en `payroll_uploads` y
 * `rule_year` en `country_year_rules`.
 */
const MIN_YEAR = 2020;
const MAX_YEAR = 2030;

/**
 * Detects the period (month and year) from a flat array of cell values.
 *
 * Scans string values looking for Spanish month names and years 2020-2030.
 * Returns the first match found for each.
 *
 * @param cellValues - Array of string cell values to scan
 * @returns Detected month and year (null if not found)
 */
export function detectPeriodFromValues(cellValues: string[]): DetectedPeriod {
  let detectedMonth: number | null = null;
  let detectedYear: number | null = null;

  for (const raw of cellValues) {
    const val = String(raw).toLowerCase().trim();
    if (!val) continue;

    // Search for month names
    if (detectedMonth === null) {
      for (let i = 0; i < SPANISH_MONTHS.length; i++) {
        if (val.includes(SPANISH_MONTHS[i])) {
          detectedMonth = i + 1;
          break;
        }
      }
    }

    // Search for years (2020-2030)
    if (detectedYear === null) {
      const yearMatch = val.match(/\b(20[2-3][0-9]|2030)\b/);
      if (yearMatch) {
        const parsed = parseInt(yearMatch[1], 10);
        if (parsed >= MIN_YEAR && parsed <= MAX_YEAR) {
          detectedYear = parsed;
        }
      }
    }

    if (detectedMonth !== null && detectedYear !== null) break;
  }

  return { month: detectedMonth, year: detectedYear };
}

/**
 * Detects the period (month and year) by scanning the first 20 rows
 * of each sheet in an XLSX workbook.
 *
 * @param workbook - Parsed XLSX WorkBook
 * @param xlsxUtils - XLSX.utils reference (passed to avoid importing XLSX in this module)
 * @returns Detected month and year (null if not found)
 */
export function detectPeriodFromWorkbook(
  workbook: XLSX.WorkBook,
  xlsxUtils: typeof XLSX.utils,
): DetectedPeriod {
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = xlsxUtils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      range: 0,
      raw: false,
    });
    const sample = matrix
      .slice(0, MAX_SCAN_ROWS)
      .flat()
      .map((v) => String(v ?? ''));

    const result = detectPeriodFromValues(sample);
    if (result.month !== null || result.year !== null) {
      return result;
    }
  }

  return { month: null, year: null };
}
