/**
 * Isolated test data fixtures for E2E tests.
 *
 * Each fixture provides self-contained data that avoids
 * cross-test dependencies. Tests should use these constants
 * instead of relying on database state.
 */

/** Valid credentials for login tests. */
export const validUser = {
  email: process.env.E2E_USER_EMAIL ?? 'test@nominasmart.com',
  password: process.env.E2E_USER_PASSWORD ?? 'TestPassword123!',
};

/** Invalid credentials for negative login tests. */
export const invalidUser = {
  email: 'invalid@nominasmart.com',
  password: 'WrongPassword!',
};

/** Protected route used to verify auth redirect. */
export const protectedRoute = '/es/dashboard';

/** Login page path. */
export const loginPath = '/es/login';

/** Payroll upload pipeline fixture data. */
export const payrollPipeline = {
  /** Path to a sample Excel file for upload tests. */
  sampleFilePath: 'e2e/fixtures/sample-payroll.xlsx',
  /** Expected steps in the pipeline stepper. */
  steps: ['Carga', 'Mapeo IA', 'Verificación', 'Corrección'],
  /** Default country for rules. */
  country: 'CO' as const,
  /** Default year for rules. */
  year: 2026,
};

/** Reports page fixture data. */
export const reports = {
  path: '/es/reports',
  /** Expected metric labels that should appear on the reports page. */
  expectedSections: ['planillas', 'reportes'],
};

/** AI Chat fixture data. */
export const aiChat = {
  /** Sample message to send to the AI chat. */
  sampleMessage: '¿Cuántos empleados tiene la nómina actual?',
  /** Quick action labels expected in the sidebar. */
  quickActions: ['Consultar datos'],
};

/** Rules management fixture data. */
export const rulesManagement = {
  path: '/es/rules',
  /** Sample rule data for creation tests. */
  sampleRule: {
    country: 'CO',
    year: 2026,
    label: 'Normativa Colombia 2026 - Test E2E',
  },
};
