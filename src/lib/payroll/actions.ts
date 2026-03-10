export interface SuggestedAction {
    priority: 'high' | 'medium' | 'low';
    area: 'IBC' | 'Aportes' | 'No salarial' | 'Datos';
    title: string;
    description: string;
    recommendedFix: string;
}

function priorityWeight(priority: SuggestedAction['priority']) {
    if (priority === 'high') return 3;
    if (priority === 'medium') return 2;
    return 1;
}

export function buildSuggestedActions(findings: string[]): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    for (const finding of findings) {
        const text = finding.toLowerCase();

        if (text.includes('40%') || text.includes('no salariales')) {
            actions.push({
                priority: 'high',
                area: 'No salarial',
                title: 'Exceso de pagos no salariales para IBC',
                description: finding,
                recommendedFix:
                    'Reclasificar excedente no salarial a base de cotizacion y recalcular IBC salud/pension/ARL del periodo.',
            });
            continue;
        }

        if (text.includes('sin aportes')) {
            actions.push({
                priority: 'high',
                area: 'Aportes',
                title: 'Salario sin aportes reportados',
                description: finding,
                recommendedFix:
                    'Verificar concepto de devengo y generar/aplicar novedades de aportes faltantes en PILA del mes.',
            });
            continue;
        }

        if (text.includes('ibl') || text.includes('ibc')) {
            actions.push({
                priority: 'high',
                area: 'IBC',
                title: 'Inconsistencia entre IBL/IBC y salario base',
                description: finding,
                recommendedFix:
                    'Auditar formula IBC (salarial + exceso no salarial) y validar topes minimos/mensuales del anio vigente.',
            });
            continue;
        }

        if (text.includes('sin valores')) {
            actions.push({
                priority: 'medium',
                area: 'Datos',
                title: 'Registro con valores monetarios en cero',
                description: finding,
                recommendedFix:
                    'Revisar integridad de origen (planilla/comprobante) y confirmar si empleado tuvo novedad de retiro/suspension.',
            });
            continue;
        }

        actions.push({
            priority: 'low',
            area: 'Datos',
            title: 'Revision manual requerida',
            description: finding,
            recommendedFix: 'Validar trazabilidad del concepto y ajustar mapeo o formula segun politica de nomina.',
        });
    }

    return actions.sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
}

export function getPriorityColor(priority: SuggestedAction['priority']) {
    switch (priority) {
        case 'high':
            return 'rose';
        case 'medium':
            return 'amber';
        case 'low':
            return 'slate';
        default:
            return 'slate';
    }
}

export function summarizeActions(findingsByEmployee: Array<{ employee: string; findings: string[] }>) {
    const allActions = findingsByEmployee.flatMap((row) =>
        buildSuggestedActions(row.findings).map((action) => ({ employee: row.employee, action }))
    );

    const byPriority = {
        high: allActions.filter((x) => x.action.priority === 'high').length,
        medium: allActions.filter((x) => x.action.priority === 'medium').length,
        low: allActions.filter((x) => x.action.priority === 'low').length,
    };

    return {
        total: allActions.length,
        byPriority,
        actions: allActions,
    };
}
