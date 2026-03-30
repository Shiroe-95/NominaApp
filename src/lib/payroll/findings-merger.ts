/**
 * Findings Merger — fusiona hallazgos del motor matemático y del análisis IA.
 *
 * Deduplicación por documento de empleado, ordenamiento por score de riesgo descendente.
 *
 * Validates: Requirements 8.4
 */

// ── Types ───────────────────────────────────────────────────────────

export interface EmployeeRiskItem {
  document: string;
  name: string;
  score: number;
  findings: string[];
  source: 'engine' | 'ai' | 'merged';
}

export interface EngineEmployee {
  document: string;
  name: string;
  score: number;
  findings: string[];
}

export interface AiEmployeeFinding {
  document: string;
  name: string;
  issues: Array<{
    description: string;
    severity: 'high' | 'medium' | 'low';
    rule: string;
  }>;
}

// ── Risk Score Calculation ──────────────────────────────────────────

/**
 * Calculates risk score from AI issues using weighted severity:
 * high = 40, medium = 20, low = 10
 */
export function calculateAiRiskScore(issues: Array<{ severity: 'high' | 'medium' | 'low' }>): number {
  return issues.reduce((acc, issue) => {
    if (issue.severity === 'high') return acc + 40;
    if (issue.severity === 'medium') return acc + 20;
    return acc + 10;
  }, 0);
}

// ── Merger ───────────────────────────────────────────────────────────

/**
 * Merges findings from the math engine and AI analysis.
 *
 * - Deduplicates by employee document: if both sources have findings for the
 *   same employee, merges their findings and takes the higher score.
 * - Sorts by risk score descending.
 *
 * @param engineEmployees - Employees from the math validation engine
 * @param aiEmployees - Employees from the AI validation report
 * @returns Merged, deduplicated, and sorted array of employee risk items
 */
export function mergeFindings(
  engineEmployees: EngineEmployee[],
  aiEmployees: AiEmployeeFinding[],
): EmployeeRiskItem[] {
  const byDocument = new Map<string, EmployeeRiskItem>();

  // Process engine findings first
  for (const emp of engineEmployees) {
    const doc = String(emp.document).trim();
    if (!doc) continue;

    byDocument.set(doc, {
      document: doc,
      name: emp.name,
      score: emp.score,
      findings: [...emp.findings],
      source: 'engine',
    });
  }

  // Process AI findings, merging with existing engine entries
  for (const emp of aiEmployees) {
    const doc = String(emp.document).trim();
    if (!doc) continue;

    const aiFindings = emp.issues.map((issue) => issue.description);
    const aiScore = calculateAiRiskScore(emp.issues);

    const existing = byDocument.get(doc);
    if (existing) {
      // Merge: combine findings (deduplicate), take max score
      const existingFindingsSet = new Set(existing.findings);
      for (const f of aiFindings) {
        if (!existingFindingsSet.has(f)) {
          existing.findings.push(f);
        }
      }
      existing.score = Math.max(existing.score, aiScore);
      existing.source = 'merged';
    } else {
      byDocument.set(doc, {
        document: doc,
        name: emp.name,
        score: aiScore,
        findings: aiFindings,
        source: 'ai',
      });
    }
  }

  // Sort by risk score descending
  return Array.from(byDocument.values()).sort((a, b) => b.score - a.score);
}
