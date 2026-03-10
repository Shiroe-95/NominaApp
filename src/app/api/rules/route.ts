import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return error instanceof Error ? error.message : fallback;
}

const DEFAULT_RULES = [
    {
        country_code: 'CO',
        rule_year: 2025,
        label: 'UGPP Colombia 2025',
        required_fields: ['document_number', 'first_name', 'last_name', 'base_salary', 'non_salary_payments', 'worked_days', 'contributor_type'],
        required_calculations: ['ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl', 'tope_40_no_salarial'],
        checks: [
            // Valores de referencia 2025
            'SMMLV 2025: $1.423.500 (Presidencia, 24-dic-2024)',
            'Auxilio de transporte 2025: $200.000 — solo si salario <= 2 SMMLV ($2.847.000) (Presidencia, 24-dic-2024)',
            'Salario integral minimo 2025: $18.505.500 (13 SMMLV: 10 base + 30% factor prestacional)',
            'UVT 2025: $49.799 (DIAN Resolucion 000193 de 2024)',
            // Seguridad social — empleado
            'Salud empleado: 4% del IBC',
            'Pension empleado: 4% del IBC',
            'Fondo solidaridad pensional: 1% adicional si IBC > 4 SMMLV ($5.694.000)',
            'Fondo subsistencia: 0.2% adicional por SMMLV si IBC > 16 SMMLV ($22.776.000)',
            // Seguridad social — empleador
            'Salud empleador: 8.5% del IBC',
            'Pension empleador: 12% del IBC',
            'ARL: 0.522% (riesgo I) hasta 8.7% (riesgo V) segun clase de riesgo laboral',
            // Parafiscales (empleador)
            'SENA: 2% del IBC (empleador)',
            'ICBF: 3% del IBC (empleador)',
            'Caja de compensacion familiar: 4% del IBC (empleador)',
            // Prestaciones sociales
            'Cesantias: 8.33% del total devengado mensual (Art. 249 CST)',
            'Intereses sobre cesantias: 12% anual / 1% mensual sobre saldo acumulado (Ley 52 de 1975)',
            'Prima de servicios: 8.33% del total devengado — pagos 30 jun y 20 dic (Art. 306 CST)',
            'Vacaciones: 4.17% del salario basico / 15 dias habiles por ano (Art. 186 CST)',
            // Horas extras y recargos
            'Hora extra diurna (6am–9pm): +25% sobre valor hora ordinaria (Art. 168 CST)',
            'Hora extra nocturna (9pm–6am): +35% sobre valor hora ordinaria',
            'Recargo nocturno ordinario (9pm–6am): +35% sobre valor hora ordinaria',
            'Trabajo dominical/festivo diurno: +75% (o salario doble si se toma dia compensatorio)',
            'Trabajo dominical/festivo nocturno: +110%',
            // Reglas IBC / UGPP
            'Ley 1393: pagos no salariales > 40% del total devengado se deben incluir en el IBC',
            'IBC minimo proporcional: 1 SMMLV x (dias trabajados / 30)',
            'IBC maximo: 25 SMMLV ($35.587.500)',
            'Auxilio de transporte NO se incluye en el IBC ni en la base de cesantias',
            'Salario integral: IBC = 70% del salario; sin cesantias, prima ni vacaciones proporcionales',
        ],
    },
    {
        country_code: 'CO',
        rule_year: 2026,
        label: 'UGPP Colombia 2026',
        required_fields: ['document_number', 'first_name', 'last_name', 'base_salary', 'non_salary_payments', 'worked_days', 'contributor_type'],
        required_calculations: ['ibc_total', 'ibc_salud', 'ibc_pension', 'ibc_arl', 'tope_40_no_salarial'],
        checks: [
            // Valores de referencia 2026
            'Salario minimo (SMMLV) 2026: $1.750.905 (Decreto 1469 de 2025)',
            'Auxilio de transporte 2026: $249.095 — solo si salario <= 2 SMMLV ($3.501.810) (Decreto 1470 de 2025)',
            'Salario integral minimo 2026: $22.761.765 (10 SMMLV base + 30% factor prestacional)',
            'UVT 2026: $52.374 (DIAN Resolucion 000238 de 2025)',
            // Seguridad social — empleado
            'Salud empleado: 4% del IBC',
            'Pension empleado: 4% del IBC',
            'Fondo solidaridad pensional: 1% adicional si IBC > 4 SMMLV ($7.003.620)',
            'Fondo subsistencia: 0.2% adicional por SMMLV si IBC > 16 SMMLV ($28.014.480)',
            // Seguridad social — empleador
            'Salud empleador: 8.5% del IBC',
            'Pension empleador: 12% del IBC',
            'ARL: 0.522% (riesgo I) hasta 8.7% (riesgo V) segun clase de riesgo laboral',
            // Parafiscales (empleador)
            'SENA: 2% del IBC (empleador)',
            'ICBF: 3% del IBC (empleador)',
            'Caja de compensacion familiar: 4% del IBC (empleador)',
            // Prestaciones sociales
            'Cesantias: 8.33% del total devengado mensual (Art. 249 CST)',
            'Intereses sobre cesantias: 12% anual / 1% mensual sobre saldo acumulado (Ley 52 de 1975)',
            'Prima de servicios: 8.33% del total devengado — pagos 30 jun y 20 dic (Art. 306 CST)',
            'Vacaciones: 4.17% del salario basico / 15 dias habiles por ano (Art. 186 CST)',
            // Horas extras y recargos 2026
            'Hora extra diurna (6am–9pm): +25% sobre valor hora ordinaria (Art. 168 CST)',
            'Hora extra nocturna (9pm–6am): +35% sobre valor hora ordinaria',
            'Recargo nocturno ordinario (9pm–6am): +35% sobre valor hora ordinaria',
            'Trabajo dominical/festivo diurno: +80% hasta jun 2026; +90% desde 1 jul 2026 (Ley 2101 de 2021)',
            'Trabajo dominical/festivo nocturno: +110%',
            // Reglas IBC / UGPP
            'Ley 1393: pagos no salariales > 40% del total devengado se deben incluir en el IBC',
            'IBC minimo proporcional: 1 SMMLV x (dias trabajados / 30)',
            'IBC maximo: 25 SMMLV ($43.772.625)',
            'Auxilio de transporte NO se incluye en el IBC ni en la base de cesantias',
            'Salario integral: IBC = 70% del salario integral; sin cesantias, prima ni vacaciones individuales',
        ],
    },
];

export async function GET(req: Request) {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const countryCode = searchParams.get('countryCode');

    let query = supabase
        .from('country_year_rules')
        .select('country_code, rule_year, label, required_fields, required_calculations, checks')
        .order('rule_year', { ascending: true });

    if (countryCode) query = query.eq('country_code', countryCode);

    const { data, error } = await query;

    if (error) {
        console.error('Rules GET error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to load rules') }, { status: 500 });
    }

    // Auto-seed default CO rules if none exist for the requested country
    if (data.length === 0 && (countryCode === 'CO' || !countryCode)) {
        const { error: seedError } = await supabase
            .from('country_year_rules')
            .upsert(DEFAULT_RULES, { onConflict: 'country_code,rule_year' });

        if (!seedError) {
            const { data: seeded } = await query;
            return NextResponse.json({ rules: seeded ?? [] });
        }
    }

    return NextResponse.json({ rules: data });
}

export async function DELETE(req: Request) {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const countryCode = searchParams.get('countryCode');
    const ruleYear = Number(searchParams.get('ruleYear'));

    if (!countryCode || !Number.isFinite(ruleYear) || ruleYear === 0) {
        return NextResponse.json({ error: 'countryCode y ruleYear son requeridos' }, { status: 400 });
    }

    const { error } = await supabase
        .from('country_year_rules')
        .delete()
        .eq('country_code', countryCode)
        .eq('rule_year', ruleYear);

    if (error) {
        return NextResponse.json({ error: getErrorMessage(error, 'No se pudo eliminar la regla') }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
    const supabase = createAdminClient();
    try {
        const body = await req.json();

        const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';
        const ruleYear = Number(body.ruleYear);
        const label = typeof body.label === 'string' ? body.label.trim() : '';
        const requiredFields = Array.isArray(body.requiredFields) ? body.requiredFields : [];
        const requiredCalculations = Array.isArray(body.requiredCalculations) ? body.requiredCalculations : [];
        const checks = Array.isArray(body.checks) ? body.checks : [];

        if (!countryCode || !Number.isFinite(ruleYear) || !label) {
            return NextResponse.json({ error: 'countryCode, ruleYear and label are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('country_year_rules')
            .upsert(
                { country_code: countryCode, rule_year: ruleYear, label, required_fields: requiredFields, required_calculations: requiredCalculations, checks, updated_at: new Date().toISOString() },
                { onConflict: 'country_code,rule_year' }
            )
            .select('country_code, rule_year, label, required_fields, required_calculations, checks')
            .single();

        if (error) {
            console.error('Rules POST error:', error);
            return NextResponse.json({ error: getErrorMessage(error, 'Failed to save rule') }, { status: 500 });
        }

        return NextResponse.json({ rule: data });
    } catch (error: unknown) {
        console.error('Rules POST error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to save rule') }, { status: 500 });
    }
}
