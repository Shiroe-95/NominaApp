/**
 * Automatic payroll file format detection.
 *
 * Detects CSV (with delimiter), XLSX/XLS and JSON by file extension
 * and content analysis. Returns format type and metadata.
 *
 * @module format-detector
 * @see Requirements 10.1
 */

// ── Types ───────────────────────────────────────────────────────────

export type FileFormat = 'csv' | 'xlsx' | 'xls' | 'json' | 'unknown';

export type CsvDelimiter = ',' | ';' | '\t' | '|';

export interface FormatDetectionResult {
  format: FileFormat;
  confidence: number; // 0.0 – 1.0
  metadata: FormatMetadata;
}

export interface FormatMetadata {
  /** Detected delimiter for CSV files */
  delimiter?: CsvDelimiter;
  /** Detected or assumed encoding */
  encoding: string;
  /** Original file extension (lowercase, without dot) */
  extension?: string;
}

// ── Constants ───────────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, FileFormat> = {
  csv: 'csv',
  tsv: 'csv',
  xlsx: 'xlsx',
  xls: 'xls',
  json: 'json',
};

const CSV_DELIMITERS: CsvDelimiter[] = [',', ';', '\t', '|'];

/**
 * XLSX files are ZIP archives. The first 4 bytes of a ZIP file are
 * the "local file header" signature: PK\x03\x04 (hex 50 4B 03 04).
 */
const XLSX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04];

/**
 * Legacy XLS (BIFF/Compound Document) magic bytes: D0 CF 11 E0.
 */
const XLS_MAGIC_BYTES = [0xd0, 0xcf, 0x11, 0xe0];

// ── Helpers ─────────────────────────────────────────────────────────

function extractExtension(filename: string): string | undefined {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === filename.length - 1) return undefined;
  return filename.slice(dotIndex + 1).toLowerCase();
}

function matchesMagicBytes(content: Buffer | Uint8Array, magic: number[]): boolean {
  if (content.length < magic.length) return false;
  return magic.every((byte, i) => content[i] === byte);
}

/**
 * Detect the most likely CSV delimiter by counting occurrences in the
 * first few lines. The delimiter with the highest consistent count wins.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 10);
  if (lines.length === 0) return ',';

  let bestDelimiter: CsvDelimiter = ',';
  let bestScore = -1;

  for (const delim of CSV_DELIMITERS) {
    const counts = lines.map((line) => {
      // Count occurrences outside of quoted strings
      let count = 0;
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes && ch === delim) {
          count++;
        }
      }
      return count;
    });

    // A good delimiter appears consistently across lines
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

    // Prefer delimiters that appear at least once and are consistent
    if (minCount > 0 && avg > bestScore && maxCount - minCount <= 1) {
      bestScore = avg;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Try to detect JSON from text content.
 */
function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

/**
 * Try to detect CSV from text content (has multiple lines with a
 * consistent delimiter).
 */
function looksLikeCsv(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;

  const delim = detectDelimiter(text);
  const counts = lines.slice(0, 5).map((line) => {
    let count = 0;
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch === delim) count++;
    }
    return count;
  });

  // At least one delimiter per line and reasonably consistent
  return counts.every((c) => c > 0);
}

// ── Main API ────────────────────────────────────────────────────────

/**
 * Detect the format of a payroll file by extension and/or content.
 *
 * @param filename - The file name (or path) to inspect.
 * @param content  - Optional file content for deeper analysis.
 * @returns Detection result with format, confidence and metadata.
 */
export function detectFormat(
  filename: string,
  content?: string | Buffer | Uint8Array,
): FormatDetectionResult {
  const ext = extractExtension(filename);
  const formatFromExt = ext ? EXTENSION_MAP[ext] : undefined;

  // ── Extension-only detection (no content provided) ──────────────
  if (content === undefined || content === null) {
    if (formatFromExt) {
      const metadata: FormatMetadata = { encoding: 'utf-8', extension: ext };
      if (formatFromExt === 'csv') {
        metadata.delimiter = ext === 'tsv' ? '\t' : ',';
      }
      return { format: formatFromExt, confidence: 0.8, metadata };
    }
    return { format: 'unknown', confidence: 0, metadata: { encoding: 'utf-8', extension: ext } };
  }

  // ── Content-based detection ─────────────────────────────────────

  // Binary content (Buffer / Uint8Array)
  const isBinary = content instanceof Buffer || content instanceof Uint8Array;
  const bytes = isBinary ? content : undefined;
  const text = isBinary ? undefined : content as string;

  // Check binary magic bytes first
  if (bytes) {
    if (matchesMagicBytes(bytes, XLSX_MAGIC_BYTES)) {
      return {
        format: 'xlsx',
        confidence: 1.0,
        metadata: { encoding: 'binary', extension: ext },
      };
    }
    if (matchesMagicBytes(bytes, XLS_MAGIC_BYTES)) {
      return {
        format: 'xls',
        confidence: 1.0,
        metadata: { encoding: 'binary', extension: ext },
      };
    }

    // Try to decode as text for further analysis
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return detectFromText(decoded, ext, formatFromExt);
  }

  // Text content
  return detectFromText(text!, ext, formatFromExt);
}

/**
 * Internal: detect format from text content, optionally boosted by extension.
 */
function detectFromText(
  text: string,
  ext: string | undefined,
  formatFromExt: FileFormat | undefined,
): FormatDetectionResult {
  const metadata: FormatMetadata = { encoding: 'utf-8', extension: ext };

  // JSON detection
  if (looksLikeJson(text)) {
    try {
      JSON.parse(text);
      return { format: 'json', confidence: 1.0, metadata };
    } catch {
      // Looks like JSON but doesn't parse — lower confidence
      const confidence = formatFromExt === 'json' ? 0.7 : 0.4;
      return { format: 'json', confidence, metadata };
    }
  }

  // CSV detection
  if (looksLikeCsv(text)) {
    const delimiter = detectDelimiter(text);
    metadata.delimiter = delimiter;
    const confidence = formatFromExt === 'csv' ? 1.0 : 0.9;
    return { format: 'csv', confidence, metadata };
  }

  // Fall back to extension
  if (formatFromExt) {
    if (formatFromExt === 'csv') {
      metadata.delimiter = ext === 'tsv' ? '\t' : ',';
    }
    return { format: formatFromExt, confidence: 0.6, metadata };
  }

  return { format: 'unknown', confidence: 0, metadata };
}
