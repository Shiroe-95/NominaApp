import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export interface AiEmployeeIssue {
    descripcion: string;
    severidad: 'alta' | 'media' | 'baja';
    norma: string;
}

export interface AiEmployeeFinding {
    documento: string;
    nombre: string;
    problemas: AiEmployeeIssue[];
    // keep English aliases for backward compat with reconcile page interface
    document?: string;
    name?: string;
    issues?: Array<{ description: string; severity: 'high' | 'medium' | 'low'; rule: string }>;
}

export interface AiValidationReport {
    resumen: string;
    riesgoGlobal: 'alto' | 'medio' | 'bajo';
    analisisNarrativo: string;
    hallazgos: Array<{
        severidad: 'alta' | 'media' | 'baja';
        categoria: string;
        descripcion: string;
        empleadosAfectados: string[];
        recomendacion: string;
    }>;
    hallazgosPorEmpleado: AiEmployeeFinding[];
    registrosAnalizados: number;
    lotesProcessados: number;
    // English aliases consumed by the reconcile page
    summary?: string;
    overallRisk?: 'high' | 'medium' | 'low';
    narrativeAnalysis?: string;
    findings?: Array<{
        severity: 'high' | 'medium' | 'low';
        category: string;
        description: string;
        affectedEmployees: string[];
        recommendation: string;
    }>;
    employeeFindings?: Array<{ document: string; name: string; issues: Array<{ description: string; severity: 'high' | 'medium' | 'low'; rule: string }> }>;
    rowsAnalyzed?: number;
    batchesProcessed?: number;
}

const BATCH_SIZE = 15; // smaller = safer for max_tokens
const MAX_ROWS = 400;

const GLOSARIO_CAMPOS = `GLOSARIO DE CAMPOS (nombre técnico → significado en nómina colombiana):
- document_number / documento: número de cédula o NIT del empleado
- first_name / last_name / nombre / apellido: identificación del trabajador
- base_salary / salario_basico: salario básico mensual pactado (constitutivo de salario, Art. 127 CST)
- non_salary_payments / pagos_no_salariales: pagos que NO constituyen salario (Art. 128 CST): bonificaciones ocasionales, auxilios extralegales, gastos de representación, rodamiento, etc. NO son base de prestaciones sociales NI de aportes, SALVO que superen el 40% del total devengado (Ley 1393).
- gross_pay / total_devengado: suma total recibida en el período (salario + horas extras + comisiones + pagos no salariales)
- worked_days / dias_trabajados: días laborados en el período (máx 30)
- contributor_type / tipo_cotizante: código PILA (1=Empleado, 12=Aprendiz SENA, 19=No aplica ARL, etc.)
- transport_allowance / auxilio_transporte: auxilio de transporte legal — solo para salarios <= 2 SMMLV. NO entra al IBC ni a la base de cesantías/prima.
- ibc_total / ibc_salud / ibc_pension / ibc_arl: Ingreso Base de Cotización por subsistema
- health_employee_deduction / descuento_salud: retención salud empleado (debe ser exactamente 4% del IBC)
- pension_employee_deduction / descuento_pension: retención pensión empleado (debe ser exactamente 4% del IBC)
- salud_empleador / aporte_salud_empleador: aporte salud del empleador (debe ser 8.5% del IBC)
- pension_empleador / aporte_pension_empleador: aporte pensión del empleador (debe ser 12% del IBC)
- arl_value / aporte_arl: aporte ARL (rango válido: 0.522% a 8.7% del IBC según clase de riesgo)
- parafiscales_total / parafiscales: SENA (2%) + ICBF (3%) + Caja Compensación (4%) = ~9% del IBC
- cesantias_provision / cesantias: provisión cesantías (~8.33% del total devengado, Art. 249 CST)
- prima_provision / prima: provisión prima de servicios (~8.33% del total devengado, Art. 306 CST)
- vacation_provision / vacaciones: provisión vacaciones (~4.17% del salario básico, Art. 186 CST)

REGLA LEY 1393 (crítica para UGPP):
IBC mínimo = salario_basico + MAX(0, pagos_no_salariales - 40% × total_devengado)
Ejemplo: salario=3.000.000, no_salarial=2.500.000, total=5.500.000 → tope 40%=2.200.000 → excedente=300.000 → IBC mínimo=3.300.000`;

const BATCH_SYSTEM_PROMPT = `Eres un auditor experto en nómina colombiana con dominio del Código Sustantivo del Trabajo (CST), normativa UGPP, PILA y legislación laboral vigente.

Analiza CADA registro de empleado de forma individual. Detecta anomalías reales comparando los valores numéricos contra las reglas normativas.

${GLOSARIO_CAMPOS}

RESPONDE ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{"hallazgosPorEmpleado":[{"documento":"cédula","nombre":"Nombre Apellido","problemas":[{"descripcion":"descripción concisa del problema","severidad":"alta|media|baja","norma":"Ley 1393 / Art. 249 CST / etc."}]}]}

Si un empleado NO tiene problemas, NO lo incluyas. Si ninguno tiene problemas: {"hallazgosPorEmpleado":[]}
Usa SIEMPRE español. Sé conciso: máximo 2 problemas por empleado, descripción máximo 120 caracteres.`;

const SUMMARY_SYSTEM_PROMPT = `Eres un auditor de nómina colombiana. Genera un reporte ejecutivo consolidado en español basándote en los hallazgos por empleado.

RESPONDE ÚNICAMENTE con JSON válido (sin markdown):
{"resumen":"2-3 oraciones ejecutivas","riesgoGlobal":"alto|medio|bajo","analisisNarrativo":"3-5 oraciones sobre patrones y riesgo UGPP","hallazgos":[{"severidad":"alta|media|baja","categoria":"IBC|Prestaciones|Seguridad Social|Parafiscales|Horas Extras|Datos|Pagos no salariales","descripcion":"hallazgo o patrón","empleadosAfectados":["cédula o nombre"],"recomendacion":"acción correctiva"}]}
Limita hallazgos a máximo 8, agrupados por tipo. Todo en español.`;

function trimRow(row: Record<string, unknown>): Record<string, unknown> {
    // Keep only non-null/non-empty values to reduce token usage
    return Object.fromEntries(
        Object.entries(row).filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 0)
    );
}

function safeParseEmployeeFindings(content: string): AiEmployeeFinding[] {
    try {
        const parsed = JSON.parse(content) as { hallazgosPorEmpleado?: AiEmployeeFinding[] };
        return Array.isArray(parsed.hallazgosPorEmpleado) ? parsed.hallazgosPorEmpleado : [];
    } catch {
        // Try to extract partial JSON array
        const match = content.match(/"hallazgosPorEmpleado"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
        if (match) {
            try {
                return JSON.parse(match[1]) as AiEmployeeFinding[];
            } catch { /* fall through */ }
        }
        console.warn('AI batch returned invalid JSON, skipping batch');
        return [];
    }
}

function toEnglishAliases(findings: AiEmployeeFinding[]): AiValidationReport['employeeFindings'] {
    return findings.map((f) => ({
        document: f.documento,
        name: f.nombre,
        issues: (f.problemas ?? []).map((p) => ({
            description: p.descripcion,
            severity: p.severidad === 'alta' ? 'high' : p.severidad === 'media' ? 'medium' : 'low' as 'high' | 'medium' | 'low',
            rule: p.norma,
        })),
    }));
}

async function processBatch(
    rows: Record<string, unknown>[],
    countryCode: string,
    year: number,
    ruleChecks: string[],
    batchIndex: number
): Promise<AiEmployeeFinding[]> {
    const rulesContext = ruleChecks.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join('\n');
    const trimmedRows = rows.map(trimRow);

    const userPrompt = `País: ${countryCode} | Año: ${year} | Lote ${batchIndex + 1} | ${rows.length} empleados

REGLAS CLAVE VIGENTES:
${rulesContext}

REGISTROS (campos relevantes por empleado):
${JSON.stringify(trimmedRows)}`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: BATCH_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4096,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return [];
    return safeParseEmployeeFindings(content);
}

async function generateSummary(
    allFindings: AiEmployeeFinding[],
    totalRows: number,
    batchesProcessed: number,
    countryCode: string,
    year: number
): Promise<Pick<AiValidationReport, 'resumen' | 'riesgoGlobal' | 'analisisNarrativo' | 'hallazgos'>> {
    const altaCount = allFindings.filter((e) => e.problemas?.some((p) => p.severidad === 'alta')).length;
    const mediaCount = allFindings.filter((e) => e.problemas?.some((p) => p.severidad === 'media')).length;

    const userPrompt = `País: ${countryCode} | Año: ${year}
Total registros analizados: ${totalRows} (en ${batchesProcessed} lotes)
Empleados con hallazgos: ${allFindings.length}
- Severidad alta: ${altaCount}
- Severidad media: ${mediaCount}

MUESTRA DE HALLAZGOS (primeros 40):
${JSON.stringify(allFindings.slice(0, 40))}`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.15,
        max_tokens: 2048,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        return {
            resumen: `${allFindings.length} de ${totalRows} empleados presentan hallazgos.`,
            riesgoGlobal: altaCount > 0 ? 'alto' : mediaCount > 0 ? 'medio' : 'bajo',
            analisisNarrativo: '',
            hallazgos: [],
        };
    }

    try {
        return JSON.parse(content) as Pick<AiValidationReport, 'resumen' | 'riesgoGlobal' | 'analisisNarrativo' | 'hallazgos'>;
    } catch {
        return {
            resumen: `${allFindings.length} de ${totalRows} empleados presentan hallazgos.`,
            riesgoGlobal: altaCount > 0 ? 'alto' : mediaCount > 0 ? 'medio' : 'bajo',
            analisisNarrativo: '',
            hallazgos: [],
        };
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const allRows: Record<string, unknown>[] = Array.isArray(body.allRows) ? body.allRows : [];
        const countryCode: string = typeof body.countryCode === 'string' ? body.countryCode : 'CO';
        const year: number = Number(body.year);
        const ruleChecks: string[] = Array.isArray(body.ruleChecks) ? body.ruleChecks : [];

        if (allRows.length === 0) {
            return NextResponse.json({ error: 'No se recibieron filas para analizar' }, { status: 400 });
        }

        const rowsToProcess = allRows.slice(0, MAX_ROWS);
        const batches: Record<string, unknown>[][] = [];
        for (let i = 0; i < rowsToProcess.length; i += BATCH_SIZE) {
            batches.push(rowsToProcess.slice(i, i + BATCH_SIZE));
        }

        const allEmployeeFindings: AiEmployeeFinding[] = [];
        for (let i = 0; i < batches.length; i++) {
            const batchFindings = await processBatch(batches[i], countryCode, year, ruleChecks, i);
            allEmployeeFindings.push(...batchFindings);
        }

        const summaryResult = await generateSummary(allEmployeeFindings, rowsToProcess.length, batches.length, countryCode, year);

        const employeeFindings = toEnglishAliases(allEmployeeFindings);

        const report: AiValidationReport = {
            ...summaryResult,
            hallazgosPorEmpleado: allEmployeeFindings,
            registrosAnalizados: rowsToProcess.length,
            lotesProcessados: batches.length,
            // English aliases for the reconcile page
            summary: summaryResult.resumen,
            overallRisk: summaryResult.riesgoGlobal === 'alto' ? 'high' : summaryResult.riesgoGlobal === 'medio' ? 'medium' : 'low',
            narrativeAnalysis: summaryResult.analisisNarrativo,
            findings: (summaryResult.hallazgos ?? []).map((h) => ({
                severity: h.severidad === 'alta' ? 'high' : h.severidad === 'media' ? 'medium' : 'low' as 'high' | 'medium' | 'low',
                category: h.categoria,
                description: h.descripcion,
                affectedEmployees: h.empleadosAfectados,
                recommendation: h.recomendacion,
            })),
            employeeFindings,
            rowsAnalyzed: rowsToProcess.length,
            batchesProcessed: batches.length,
        };

        return NextResponse.json({ report });
    } catch (error: unknown) {
        console.error('Error en validación IA:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Falló la validación con IA') }, { status: 500 });
    }
}
