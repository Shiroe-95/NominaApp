import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { requireAuth, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) return null;
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function getGroq() {
    if (!process.env.GROQ_API_KEY) return null;
    return createGroq({ apiKey: process.env.GROQ_API_KEY });
}

const TARGET_COLUMNS = [
    // Identidad y contrato
    'document_number',
    'first_name',
    'last_name',
    'hire_date',
    'contributor_type',
    'worked_days',
    // Devengos salariales
    'base_salary',
    'overtime_hours_day',
    'overtime_hours_night',
    'gross_pay',
    // Devengos no salariales
    'non_salary_payments',
    'transport_allowance',
    // IBC / UGPP
    'ibc_total',
    'ibc_salud',
    'ibc_pension',
    'ibc_arl',
    'tope_40_no_salarial',
    // Aportes seguridad social (empleado)
    'health_employee_deduction',
    'pension_employee_deduction',
    // Aportes seguridad social (empleador)
    'salud_empleador',
    'pension_empleador',
    'arl_value',
    // Parafiscales
    'parafiscales_total',
    // Prestaciones sociales
    'cesantias_provision',
    'prima_provision',
    'vacation_provision',
];

type AnalysisCategory =
    | 'identity'
    | 'salary_base'
    | 'non_salary'
    | 'ibc'
    | 'contribution'
    | 'contract'
    | 'informational';

interface MappingRelation {
    target: string;
    analysisCategory: AnalysisCategory;
    isCreated: boolean;
    requiredByRule: boolean;
}

function toSnakeCase(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function normalizeText(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function inferCategory(target: string, source: string): AnalysisCategory {
    const merged = `${normalizeText(target)} ${normalizeText(source)}`;

    // Identity fields
    if (/document_number|identificacion|cedula|nit|numero de documento/.test(merged)) return 'identity';
    if (/first_name|last_name|nombre|apellido/.test(merged)) return 'identity';
    
    // IBC fields (most specific check)
    if (/ibc|ibl|ingreso base/.test(merged)) return 'ibc';
    
    // Non-salary payments (check before salary_base to catch auxilios)
    if (/non_salary|auxilio|rodamiento|movilidad|recreacion|educacion|vivienda|apoyo sostenimiento|bonificacion no salarial/.test(merged)) return 'non_salary';
    if (/transport_allowance|subsidio de transporte|auxilio de transporte/.test(merged)) return 'non_salary';
    
    // Salary base - only if NOT non-salary
    if (/base_salary|salario_basico|salario basico|sueldo|gross_pay|total_devengado|devengado|comision/.test(merged)) return 'salary_base';
    
    // Contributions (aportes)
    if (/health_employee|pension_employee|descuento salud|descuento pension|aporte|eps|afp/.test(merged)) return 'contribution';
    if (/salud_empleador|pension_empleador|arl_value|parafiscal/.test(merged)) return 'contribution';
    
    // Contract info
    if (/hire_date|fecha_ingreso|fecha de ingreso|fecha de retiro|worked_days|dias_trabajados|dias trabajados|contributor_type|tipo_cotizante/.test(merged)) return 'contract';
    
    // Provisions (prestaciones sociales) - also classify as salary_base for calculation purposes
    if (/cesantias|prima|vacaciones|provision/.test(merged)) return 'salary_base';
    
    // Overtime - classify as salary_base
    if (/hora extra|overtime|recargo|dominical|festiva|nocturna/.test(merged)) return 'salary_base';
    
    return 'informational';
}

function getRuleSet(countryCode: string, year: number) {
    const defaults: Record<string, Record<number, { requiredFields: string[]; requiredCalculations: string[] }>> = {
        CO: {
            2025: {
                requiredFields: ['document_number', 'first_name', 'last_name', 'base_salary', 'non_salary_payments', 'worked_days', 'contributor_type'],
                requiredCalculations: ['ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl', 'tope_40_no_salarial'],
            },
            2026: {
                requiredFields: ['document_number', 'first_name', 'last_name', 'base_salary', 'non_salary_payments', 'worked_days', 'contributor_type'],
                requiredCalculations: ['ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl', 'tope_40_no_salarial'],
            },
        },
    };

    const byCountry = defaults[countryCode] ?? {};
    return byCountry[year] ?? { requiredFields: [], requiredCalculations: [] };
}

export async function POST(req: Request) {
    const rl = applyRateLimit(req, 'ai/mapping', RATE_LIMITS.ai);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        const openai = getOpenAI();
        const groq = getGroq();

        const body = await req.json();
        const uploadedColumns = body.uploadedColumns;
        const countryCode = typeof body.countryCode === 'string' ? body.countryCode.toUpperCase() : 'CO';
        const year = Number(body.year);
        const incomingRequiredFields = Array.isArray(body.requiredFields) ? body.requiredFields.map((x: unknown) => String(x)) : [];
        const incomingRequiredCalculations = Array.isArray(body.requiredCalculations)
            ? body.requiredCalculations.map((x: unknown) => String(x))
            : [];

        if (!uploadedColumns || !Array.isArray(uploadedColumns)) {
            return NextResponse.json({ error: 'Uploaded columns array is required' }, { status: 400 });
        }

        const fallbackRule = getRuleSet(countryCode, Number.isFinite(year) ? year : new Date().getFullYear());
        const requiredFields = incomingRequiredFields.length > 0 ? incomingRequiredFields : fallbackRule.requiredFields;
        const requiredCalculations = incomingRequiredCalculations.length > 0 ? incomingRequiredCalculations : fallbackRule.requiredCalculations;

        const prompt = `
Eres un motor experto de mapeo de columnas para nomina colombiana.
Contexto normativo: pais=${countryCode}, anio=${Number.isFinite(year) ? year : 'desconocido'}.

DICCIONARIO DE SINONIMOS COLOMBIA (usa estos para mapear):
- "NUMERO DE DOCUMENTO", "CEDULA", "NIT", "IDENTIFICACION", "NO. DOCUMENTO" → document_number
- "NOMBRE COMPLETO", "NOMBRE", "NOMBRES", "EMPLEADO", "TRABAJADOR" → first_name
- "APELLIDO", "APELLIDOS" → last_name
- "SUELDO", "SALARIO", "SALARIO BASICO", "BASICO", "SALARIO BASE" → base_salary
- "AUXILIO DE TRANSPORTE", "SUBSIDIO DE TRANSPORTE", "TRANSPORTE" → transport_allowance
- "AUXILIO DE VIVIENDA", "AUXILIO DE RODAMIENTO", "AUXILIO DE MOVILIDAD", "AUXILIO DE EDUCACION", "AUXILIO DE RECREACION", "AUXILIO DE SALUD", "AUXILIO", "BONIFICACION", "BONO", "RODAMIENTO", "MOVILIDAD", "EDUCACION", "RECREACION", "APOYO SOSTENIMIENTO" → non_salary_payments
- "TOTAL DEVENGADO", "DEVENGADO", "TOTAL INGRESOS", "BRUTO" → gross_pay
- "IBC", "IBL", "BASE DE COTIZACION", "IBC TOTAL", "IBC SALUD", "IBC PENSION" → ibc_total (o ibc_salud/ibc_pension segun contexto)
- "APORTE SALUD", "DESCUENTO SALUD", "EPS", "SALUD EMPLEADO" → health_employee_deduction
- "APORTE PENSION", "DESCUENTO PENSION", "AFP", "PENSION EMPLEADO" → pension_employee_deduction
- "CESANTIAS", "CESANTIAS PARCIALES", "CESANTIAS DEFINITIVAS" → cesantias_provision
- "PRIMA", "PRIMA LEGAL", "PRIMA DE SERVICIOS" → prima_provision
- "VACACIONES", "VACACIONES DISFRUTADAS" → vacation_provision
- "HORA EXTRA", "HORAS EXTRAS", "HE DIURNA", "HE NOCTURNA", "RECARGO" → overtime_hours_day o overtime_hours_night
- "INCAPACIDAD", "LICENCIA", "ATEP" → informational
- "FECHA DE INGRESO", "FECHA INGRESO" → hire_date
- "DIAS TRABAJADOS", "DIAS", "TIEMPO" → worked_days
- "TIPO COTIZANTE", "TIPO", "COTIZANTE" → contributor_type
- "CODIGO EMPLEADO", "CODIGO", "ID" → informational (no es document_number)
- "CARGO", "CARGO EMPLEADO", "PUESTO" → informational

REGLAS CRITICAS:
1) MAPEA TODAS las columnas de entrada usando el diccionario de sinonimos.
2) PRIORIZA los campos obligatorios (requiredFields y requiredCalculations).
3) MULTIPLES COLUMNAS pueden mapearse al MISMO destino (ej: todos los "AUXILIO DE X" → non_salary_payments).
4) Para columnas que claramente son DEVENGOS SALARIALES (SUELDO, SALARIO BASICO, COMISIONES): → base_salary
5) Para columnas que claramente son DEVENGOS NO SALARIALES (AUXILIOS, BONIFICACIONES NO SALARIALES): → non_salary_payments
6) Si NO hay match claro, crea un campo nuevo en snake_case.
7) NUNCA dejes columnas sin valor.
8) Responde SOLO JSON valido, sin markdown.

Columnas de entrada:
${JSON.stringify(uploadedColumns)}

Campos estandar destino:
${JSON.stringify(TARGET_COLUMNS)}

Campos obligatorios de regla:
${JSON.stringify(requiredFields)}

Calculos obligatorios de regla:
${JSON.stringify(requiredCalculations)}

Formato de salida esperado:
{
  "NOMBRE_COLUMNA_ORIGEN": "campo_destino_o_campo_nuevo",
  "...": "..."
}
        `;

        let rawMapping: Record<string, string> = {};

        // Try OpenAI first
        if (openai) {
            try {
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.0,
                    response_format: { type: 'json_object' },
                    max_tokens: 500,
                });
                rawMapping = JSON.parse(response.choices[0]?.message?.content || '{}') as Record<string, string>;
            } catch (openaiError) {
                console.error('OpenAI mapping error, trying Groq:', openaiError);
            }
        }

        // Fallback to Groq
        if (Object.keys(rawMapping).length === 0 && groq) {
            try {
                const result = await generateText({
                    model: groq('llama-3.3-70b-versatile'),
                    prompt: prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown or explanations.',
                    maxTokens: 500,
                });
                let jsonStr = result.text.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
                }
                rawMapping = JSON.parse(jsonStr) as Record<string, string>;
            } catch (groqError) {
                console.error('Groq mapping error:', groqError);
            }
        }

        // Fallback to basic mapping if no AI worked
        if (Object.keys(rawMapping).length === 0) {
            for (const col of uploadedColumns) {
                rawMapping[String(col)] = toSnakeCase(String(col));
            }
        }
        const mappingResult: Record<string, string> = {};
        const relations: Record<string, MappingRelation> = {};
        const requiredSet = new Set([...requiredFields, ...requiredCalculations].map((x) => toSnakeCase(String(x))));

        for (const source of uploadedColumns.map((c: unknown) => String(c))) {
            const suggested = rawMapping[source];
            const target = typeof suggested === 'string' && suggested.trim() ? toSnakeCase(suggested) : toSnakeCase(source);

            mappingResult[source] = target;
            const isStandard = TARGET_COLUMNS.includes(target);
            relations[source] = {
                target,
                analysisCategory: inferCategory(target, source),
                isCreated: !isStandard,
                requiredByRule: requiredSet.has(target),
            };
        }

        return NextResponse.json({ mapping: mappingResult, relations });
    } catch (error: unknown) {
        console.error('OpenAI Mapping Error:', error);
        return NextResponse.json(
            { error: getErrorMessage(error, 'Failed to generate mapping') },
            { status: 500 }
        );
    }
}
