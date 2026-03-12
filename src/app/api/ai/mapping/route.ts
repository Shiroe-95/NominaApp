import { NextResponse } from 'next/server';
import OpenAI from 'openai';

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
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

    if (/document|identificacion|cedula|nit|name|nombre|apellido/.test(merged)) return 'identity';
    if (/salario|sueldo|base_salary|devengado_basico/.test(merged) && !/no salarial|auxilio|bono/.test(merged)) return 'salary_base';
    if (/non_salary|no_salarial|auxilio|rodamiento|movilidad|bono/.test(merged)) return 'non_salary';
    if (/ibc|ibl/.test(merged)) return 'ibc';
    if (/aporte|salud|pension|arl|parafiscal/.test(merged)) return 'contribution';
    if (/fecha|ingreso|retiro|dias|tipo cotizante|contributor_type|worked_days/.test(merged)) return 'contract';
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
    try {
        if (!process.env.OPENAI_API_KEY) {
            // Return basic mapping without AI
            const body = await req.json();
            const uploadedColumns = body.uploadedColumns;
            if (!uploadedColumns || !Array.isArray(uploadedColumns)) {
                return NextResponse.json({ error: 'Uploaded columns array is required' }, { status: 400 });
            }
            const basicMapping: Record<string, string> = {};
            for (const col of uploadedColumns) {
                basicMapping[col] = toSnakeCase(String(col));
            }
            return NextResponse.json({ mapping: basicMapping, relations: {} });
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
Eres un motor experto de mapeo de columnas para nomina.
Contexto normativo: pais=${countryCode}, anio=${Number.isFinite(year) ? year : 'desconocido'}.

Reglas obligatorias:
1) Debes mapear TODAS las columnas de entrada.
2) CRITICO: Prioriza USAR LOS CAMPOS OBLIGATORIOS (requiredFields) Y CALCULOS OBLIGATORIOS (requiredCalculations) si hay la mas minima coincidencia semantica.
3) AMBIGUEDAD NOMBRES: Si una columna contiene "Nombre Completo", "Empleado" o nombres combinados, mapeala SIEMPRE a "first_name". No crees campos nuevos como "nombre_completo".
4) AMBIGUEDAD DIAS: Si una columna contiene "Dias", "Dias Lab", "Dias Trab", "Tiempo", mapeala SIEMPRE a "worked_days".
5) AMBIGUEDAD TIPO COTIZANTE: Si una columna dice "Tipo", "Cotizante" o "Tipo Cotizante", mapeala a "contributor_type".
6) AMBIGUEDAD NO SALARIAL: Si hay campos como "Bono", "Viatico", "Rodamiento", "No salarial", mapealos a "non_salary_payments". Puedes mapear MULTIPLES columnas de origen al MISMO campo de destino.
7) Si definitivamente NO existe buen match, crea un campo nuevo en snake_case (minusculas con guion bajo).
8) NO dejes columnas sin valor.
9) Responde SOLO JSON valido, sin markdown.

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

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.0,
            response_format: { type: 'json_object' },
            max_tokens: 500,
        });

        const rawMapping = JSON.parse(response.choices[0]?.message?.content || '{}') as Record<string, string>;
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
