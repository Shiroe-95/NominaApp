// ── NominaSmart Premium Design Tokens ────────────────────
// Centralized design tokens replacing hardcoded values across components.
// CSS custom properties are defined in src/app/globals.css under :root.

// ── Typography ──────────────────────────────────────────

export interface TypographyLevel {
  size: string;
  weight: number;
  lineHeight: string;
}

export interface TypographyScale {
  display: TypographyLevel;
  heading: TypographyLevel;
  subheading: TypographyLevel;
  body: TypographyLevel;
  caption: TypographyLevel;
  overline: TypographyLevel;
}

export const typography: TypographyScale = {
  display:    { size: '2rem',    weight: 700, lineHeight: '1.2' },
  heading:    { size: '1.5rem',  weight: 600, lineHeight: '1.3' },
  subheading: { size: '1.125rem', weight: 500, lineHeight: '1.4' },
  body:       { size: '0.875rem', weight: 400, lineHeight: '1.5' },
  caption:    { size: '0.75rem', weight: 400, lineHeight: '1.4' },
  overline:   { size: '0.625rem', weight: 600, lineHeight: '1.2' },
} as const;

// ── Semantic Colors ─────────────────────────────────────

export interface SurfaceContainerColors {
  low: string;
  default: string;
  high: string;
  max: string;
}

export interface SemanticColors {
  surface: string;
  onSurface: string;
  primary: string;
  secondary: string;
  error: string;
  success: string;
  warning: string;
  surfaceContainer: SurfaceContainerColors;
}

export const colors: SemanticColors = {
  surface:   '#0b1326',
  onSurface: '#dae2fd',
  primary:   '#a078ff',
  secondary: '#d0bcff',
  error:     '#ffb4ab',
  success:   '#4edea3',
  warning:   '#f59e0b',
  surfaceContainer: {
    low:     '#131b2e',
    default: '#171f33',
    high:    '#222a3d',
    max:     '#2d3449',
  },
} as const;


// ── Spacing (multiples of 4px) ──────────────────────────

export type SpacingKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';

export type SpacingScale = Record<SpacingKey, string>;

export const spacing: SpacingScale = {
  xs:   '4px',
  sm:   '8px',
  md:   '16px',
  lg:   '24px',
  xl:   '32px',
  '2xl': '48px',
  '3xl': '64px',
  '4xl': '96px',
} as const;

// ── Elevation ───────────────────────────────────────────

export interface ElevationLevels {
  flat: string;
  low: string;
  medium: string;
  high: string;
}

export const elevation: ElevationLevels = {
  flat:   'none',
  low:    '0 1px 3px rgba(0,0,0,0.3)',
  medium: '0 4px 12px rgba(0,0,0,0.4)',
  high:   '0 8px 24px rgba(0,0,0,0.5)',
} as const;

// ── CSS variable references (for use in inline styles) ──

export const cssVars = {
  typography: {
    display:    'var(--ns-font-display)',
    heading:    'var(--ns-font-heading)',
    subheading: 'var(--ns-font-subheading)',
    body:       'var(--ns-font-body)',
    caption:    'var(--ns-font-caption)',
    overline:   'var(--ns-font-overline)',
  },
  colors: {
    surface:        'var(--ns-surface)',
    onSurface:      'var(--ns-on-surface)',
    primary:        'var(--ns-primary)',
    secondary:      'var(--ns-secondary)',
    error:          'var(--ns-error)',
    success:        'var(--ns-success)',
    warning:        'var(--ns-warning)',
    containerLow:   'var(--ns-container-low)',
    container:      'var(--ns-container)',
    containerHigh:  'var(--ns-container-high)',
    containerMax:   'var(--ns-container-max)',
  },
  spacing: {
    xs:   'var(--ns-space-xs)',
    sm:   'var(--ns-space-sm)',
    md:   'var(--ns-space-md)',
    lg:   'var(--ns-space-lg)',
    xl:   'var(--ns-space-xl)',
    '2xl': 'var(--ns-space-2xl)',
    '3xl': 'var(--ns-space-3xl)',
    '4xl': 'var(--ns-space-4xl)',
  },
  elevation: {
    flat:   'var(--ns-elevation-flat)',
    low:    'var(--ns-elevation-low)',
    medium: 'var(--ns-elevation-medium)',
    high:   'var(--ns-elevation-high)',
  },
} as const;

// ── Helper: parse spacing value to number (px) ─────────

/**
 * Convierte un valor de espaciado con sufijo 'px' a su equivalente numérico.
 *
 * @param value - Cadena con formato "{n}px" (ej: "16px")
 * @returns El valor numérico en píxeles
 */
export function spacingToPx(value: string): number {
  return parseInt(value, 10);
}

// ── Dashboard Utility Types ─────────────────────────────

export type TrendDirection = 'up' | 'down' | 'stable';

export interface TrendResult {
  direction: TrendDirection;
  percentage: number;
}

export interface SeverityAggregation {
  alta: number;
  media: number;
  baja: number;
}

// ── Dashboard Utility Functions ─────────────────────────

/**
 * Calcula el indicador de tendencia entre valores del período actual y anterior.
 *
 * Regla de negocio: la dirección se determina por el signo del cambio porcentual.
 * Caso especial: cuando `previous` es 0, retorna 100% up/down si `current` ≠ 0,
 * o stable 0% si ambos son 0.
 *
 * Fórmula: `(current - previous) / |previous| * 100`
 *
 * @param current - Valor del período actual
 * @param previous - Valor del período anterior
 * @returns Dirección de la tendencia ('up' | 'down' | 'stable') y porcentaje de cambio
 *
 * Validates: Requirements 4.1
 */
export function calculateTrend(current: number, previous: number): TrendResult {
  if (previous === 0) {
    if (current === 0) {
      return { direction: 'stable', percentage: 0 };
    }
    return { direction: current > 0 ? 'up' : 'down', percentage: 100 };
  }

  const percentage = ((current - previous) / Math.abs(previous)) * 100;

  if (percentage > 0) {
    return { direction: 'up', percentage };
  }
  if (percentage < 0) {
    return { direction: 'down', percentage };
  }
  return { direction: 'stable', percentage: 0 };
}

/**
 * Agrupa hallazgos de auditoría por nivel de severidad (alta, media, baja).
 *
 * Regla de negocio: la suma de los conteos por severidad debe ser igual
 * al total de hallazgos de entrada (Property 6 del documento de diseño).
 *
 * @param findings - Arreglo de hallazgos, cada uno con su severidad
 * @returns Conteo de hallazgos por cada nivel de severidad
 *
 * Validates: Requirements 4.3
 */
export function aggregateFindingsBySeverity(
  findings: ReadonlyArray<{ severity: 'alta' | 'media' | 'baja' }>,
): SeverityAggregation {
  const result: SeverityAggregation = { alta: 0, media: 0, baja: 0 };
  for (const finding of findings) {
    result[finding.severity]++;
  }
  return result;
}
