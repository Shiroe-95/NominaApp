'use client';

/**
 * Página de carga y validación de nómina.
 *
 * Implementa un flujo de 4 pasos para procesar archivos de nómina:
 *   1. Carga de archivos Excel/CSV y selección de hojas
 *   2. Mapeo inteligente de campos con IA (Gyoru)
 *   3. Verificación contra reglas normativas por país/año y pre-certificación
 *   4. Corrección de datos (manual o asistida por IA) y exportación
 *
 * Reglas de negocio principales:
 * - Las etiquetas de reglas siguen el formato "Normativa {País} {Año} - {Ley/Norma}"
 * - La certificación requiere que todos los campos y cálculos obligatorios estén mapeados
 * - Las reglas se cargan dinámicamente desde la API (`/api/rules`); si falla, se usan FALLBACK_RULES
 * - Soporta detección automática de periodo (mes/año) desde el contenido del archivo Excel
 * - Las correcciones aplicadas en el paso 4 se persisten junto con la planilla
 */

import { useEffect, useMemo, useState } from 'react';
import UploadZone, { ParsedFile } from '@/components/ui/UploadZone';
import MappingAI, { MappingResult } from '@/components/ui/MappingAI';
import { Sparkles, Database, FileSpreadsheet, Building2, CalendarClock, CheckCircle2, AlertTriangle, Globe2, Trash2, ChevronDown, ChevronUp, Loader2, PenLine, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { buildRiskReport, summarizeConcepts } from '@/lib/payroll/conceptClassifier';
import { finalizeEmployeeRiskSummary, summarizeEmployeeRiskFromMatrix } from '@/lib/payroll/employeeRisk';
import { validatePayrollCalculations, type MatrixInput, type ValidationReport } from '@/lib/payroll/ruleValidation';
import PayrollEditor, { type CorrectionEntry } from '@/components/ui/PayrollEditor';
import type { AiValidationReport } from '@/app/api/ai/validation/route';
import * as XLSX from 'xlsx';

/** Empresa asociada a una carga de nómina. */
interface Company {
    id: string;
    name: string;
    nit: string;
    industry?: string;
}

/**
 * Conjunto de reglas normativas para un país y año específico.
 * Define los campos obligatorios, cálculos requeridos y verificaciones a ejecutar.
 */
interface RuleSet {
    /** Etiqueta descriptiva, ej: "Normativa Colombia 2026 - Ley 1393" */
    label: string;
    /** Campos estructurales obligatorios para certificación */
    requiredFields: string[];
    /** Cálculos numéricos obligatorios para certificación */
    requiredCalculations: string[];
    /** Verificaciones normativas a mostrar al usuario */
    checks: string[];
}

/** Fila de regla tal como llega desde la API `/api/rules`. */
interface RuleApiRow {
    country_code: string;
    rule_year: number;
    label: string;
    required_fields: string[];
    required_calculations: string[];
    checks: string[];
}

/**
 * Reglas normativas de respaldo cuando la API `/api/rules` no está disponible.
 * Organizadas por código de país → año → conjunto de reglas.
 * Las etiquetas usan el formato estándar: "Normativa {País} {Año} - {Referencia legal}".
 */
const FALLBACK_RULES: Record<'CO' | 'MX', Record<number, RuleSet>> = {
    CO: {
        2026: {
            label: 'Normativa Colombia 2026 - Ley 1393',
            requiredFields: ['document_number', 'first_name', 'base_salary', 'non_salary_payments'],
            requiredCalculations: ['ibc_total', 'health_employee_deduction', 'pension_employee_deduction'],
            checks: [
                'SMMLV 2026: $1.750.905',
                'Auxilio de transporte 2026: $226.100 (solo aplica si salario <= 2 SMMLV)',
                'IBC = Salario Base + Exceso No Salarial sobre 40% del total devengado',
                'Exceso No Salarial = MAX(0, Pagos No Salariales - (Total Devengado * 0.40))',
                'IBC minimo proporcional: SMMLV * (dias trabajados / 30)',
                'IBC maximo: 25 SMMLV = $43.772.625',
                'Aporte Salud Empleado: 4% del IBC',
                'Aporte Pension Empleado: 4% del IBC',
            ],
        },
        2025: {
            label: 'Normativa Colombia 2025 - Ley 1393',
            requiredFields: ['document_number', 'first_name', 'base_salary', 'non_salary_payments'],
            requiredCalculations: ['ibc_total', 'health_employee_deduction', 'pension_employee_deduction'],
            checks: [
                'SMMLV 2025: $1.423.500',
                'Auxilio de transporte 2025: $200.000 (solo aplica si salario <= 2 SMMLV)',
                'IBC = Salario Base + Exceso No Salarial sobre 40% del total devengado',
            ],
        },
    },
    MX: {
        2025: {
            label: 'Normativa México 2025 - IMSS/ISR',
            requiredFields: ['employee_id', 'first_name', 'last_name', 'base_salary'],
            requiredCalculations: ['sbc', 'isr_retenido'],
            checks: ['Validar SBC y retencion ISR'],
        },
    },
};

export default function UploadPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
    const [fileStats, setFileStats] = useState({ name: '', rows: 0 });

    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [showCreateCompany, setShowCreateCompany] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyNit, setNewCompanyNit] = useState('');
    const [newCompanyIndustry, setNewCompanyIndustry] = useState('');

    const [selectedCountry, setSelectedCountry] = useState<'CO' | 'MX'>('CO');
    const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
    const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);

    const [rulesByYear, setRulesByYear] = useState<Record<number, RuleSet>>(FALLBACK_RULES.CO);
    const [isLoadingRules, setIsLoadingRules] = useState(false);

    const [mappingResult, setMappingResult] = useState<MappingResult>({ mappedTargets: [], createdTargets: [], mappingDetails: [] });
    const [isSavingPayroll, setIsSavingPayroll] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [savedPayrollId, setSavedPayrollId] = useState<string | null>(null);
    const [parsedMatrices, setParsedMatrices] = useState<MatrixInput[] | null>(null);
    const [mathValidationForEditor, setMathValidationForEditor] = useState<ValidationReport | null>(null);
    const [aiValidationForEditor, setAiValidationForEditor] = useState<AiValidationReport | null>(null);
    const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isAnalyzingAiForEditor, setIsAnalyzingAiForEditor] = useState(false);

    interface RecentPayroll { id: string; company_name: string | null; country_code: string; period_year: number; period_month: number; rule_label: string | null; certification_ready: boolean; created_at: string; }
    const [recentPayrolls, setRecentPayrolls] = useState<RecentPayroll[]>([]);
    const [showRecent, setShowRecent] = useState(false);
    const [deletingPayrollId, setDeletingPayrollId] = useState<string | null>(null);

    const selectedCompany = useMemo(
        () => companies.find((company) => company.id === selectedCompanyId),
        [companies, selectedCompanyId]
    );

    const availableYears = useMemo(
        () => Object.keys(rulesByYear).map(Number).sort((a, b) => a - b),
        [rulesByYear]
    );

    useEffect(() => {
        const countryFallback = FALLBACK_RULES[selectedCountry];
        const fallbackLatestYear = Math.max(...Object.keys(countryFallback).map(Number));

        const loadRules = async () => {
            setIsLoadingRules(true);
            try {
                const res = await fetch(`/api/rules?countryCode=${selectedCountry}`);
                const data = await res.json();
                if (!res.ok || !Array.isArray(data.rules) || data.rules.length === 0) {
                    setRulesByYear(countryFallback);
                    setPeriodYear(fallbackLatestYear);
                    return;
                }

                const mapped = (data.rules as RuleApiRow[]).reduce<Record<number, RuleSet>>((acc, row) => {
                    acc[row.rule_year] = {
                        label: row.label,
                        requiredFields: row.required_fields ?? [],
                        requiredCalculations: row.required_calculations ?? [],
                        checks: row.checks ?? [],
                    };
                    return acc;
                }, {});

                const years = Object.keys(mapped).map(Number);
                const latestYear = Math.max(...years);

                setRulesByYear(mapped);
                setPeriodYear((prev) => (years.includes(prev) ? prev : latestYear));
            } catch (error) {
                console.error('Failed to load rules:', error);
                setRulesByYear(countryFallback);
                setPeriodYear(fallbackLatestYear);
            } finally {
                setIsLoadingRules(false);
            }
        };

        void loadRules();
    }, [selectedCountry]);

    const activeRule = useMemo(() => {
        if (rulesByYear[periodYear]) return rulesByYear[periodYear];
        const latestYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : 0;
        return latestYear ? rulesByYear[latestYear] : { label: 'Sin regla', requiredFields: [], requiredCalculations: [], checks: [] };
    }, [rulesByYear, periodYear, availableYears]);

    const missingRequiredFields = useMemo(() => {
        let missing = activeRule.requiredFields.filter((field) => !mappingResult.mappedTargets.includes(field));

        // Handling ambiguity for names: If the file only provides one full name column,
        // it gets mapped to 'first_name'. We shouldn't block certification for missing 'last_name'.
        if (mappingResult.mappedTargets.includes('first_name')) {
            missing = missing.filter((f) => f !== 'last_name');
        }

        return missing;
    }, [activeRule.requiredFields, mappingResult.mappedTargets]);

    const missingRequiredCalculations = useMemo(
        () => activeRule.requiredCalculations.filter((calc) => !mappingResult.mappedTargets.includes(calc)),
        [activeRule.requiredCalculations, mappingResult.mappedTargets]
    );

    const certificationReady = missingRequiredFields.length === 0 && missingRequiredCalculations.length === 0;
    const detectedVariablesPreview = useMemo(
        () => Array.from(new Set(uploadedFiles.flatMap((file) => file.extractedHeaders.map((h) => h.trim()).filter(Boolean)))),
        [uploadedFiles]
    );
    const conceptSummaryPreview = useMemo(() => summarizeConcepts(detectedVariablesPreview), [detectedVariablesPreview]);
    const riskPreview = useMemo(
        () =>
            buildRiskReport({
                conceptSummary: conceptSummaryPreview,
                missingRequiredFields,
                missingRequiredCalculations,
                certificationReady,
            }),
        [conceptSummaryPreview, missingRequiredFields, missingRequiredCalculations, certificationReady]
    );
    const mappingCoverageByCategory = useMemo(() => {
        return mappingResult.mappingDetails.reduce<Record<string, number>>((acc, item) => {
            const key = item.analysisCategory || 'informational';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
    }, [mappingResult.mappingDetails]);
    const stepResults = [
        {
            title: 'Paso 1: Cargar y seleccionar hojas',
            result:
                uploadedFiles.length > 0
                    ? `${uploadedFiles.length} archivo(s) listo(s), ${fileStats.rows} registros estimados.`
                    : 'Pendiente de carga.',
        },
        {
            title: 'Paso 2: Mapear campos y crear faltantes',
            result:
                mappingResult.mappedTargets.length > 0
                    ? `${mappingResult.mappedTargets.length} campo(s) mapeado(s), ${mappingResult.createdTargets.length} creado(s).`
                    : 'Pendiente de mapeo.',
        },
        {
            title: 'Paso 3: Verificar regla y certificar',
            result: certificationReady
                ? `Pre-certificable bajo ${selectedCountry} ${periodYear} (${activeRule.label}); falta validacion matematica al guardar.`
                : `No certificable: faltan ${missingRequiredFields.length} campo(s) y ${missingRequiredCalculations.length} calculo(s).`,
        },
        {
            title: 'Paso 4: Corregir y exportar',
            result: corrections.length > 0
                ? `${corrections.length} corrección(es) aplicada(s).`
                : savedSuccess ? 'Planilla guardada.' : 'Pendiente de corrección.',
        },
    ];

    useEffect(() => {
        const loadCompanies = async () => {
            try {
                const res = await fetch('/api/companies');
                const data = await res.json();
                if (res.ok && Array.isArray(data.companies)) {
                    setCompanies(data.companies);
                    if (data.companies.length > 0) {
                        setSelectedCompanyId(data.companies[0].id);
                    }
                }
            } catch (error) {
                console.error('Failed to load companies:', error);
            }
        };
        void loadCompanies();
    }, []);

    const loadRecentPayrolls = async () => {
        try {
            const res = await fetch('/api/payrolls');
            const data = await res.json();
            if (res.ok && Array.isArray(data.payrolls)) {
                setRecentPayrolls(data.payrolls.slice(0, 10));
            }
        } catch (error) {
            console.error('Failed to load recent payrolls:', error);
        }
    };

    useEffect(() => {
        void loadRecentPayrolls();
    }, []);

    const handleDeleteRecentPayroll = async (id: string) => {
        if (!window.confirm('¿Eliminar esta planilla? Esta acción no se puede deshacer.')) return;
        setDeletingPayrollId(id);
        try {
            const res = await fetch(`/api/payrolls?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setRecentPayrolls((prev) => prev.filter((p) => p.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete payroll:', error);
        } finally {
            setDeletingPayrollId(null);
        }
    };

    const handleCreateCompany = async () => {
        if (!newCompanyName.trim() || !newCompanyNit.trim()) return;

        try {
            const res = await fetch('/api/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newCompanyName.trim(),
                    nit: newCompanyNit.trim(),
                    industry: newCompanyIndustry.trim() || null,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.company) {
                throw new Error(data.error || 'No se pudo crear la empresa');
            }

            setCompanies((prev) => [...prev, data.company]);
            setSelectedCompanyId(data.company.id);
            setNewCompanyName('');
            setNewCompanyNit('');
            setNewCompanyIndustry('');
            setShowCreateCompany(false);
        } catch (error) {
            console.error('Create company failed:', error);
        }
    };

    /**
     * Procesa los archivos seleccionados: fusiona headers, cuenta filas,
     * intenta detectar el periodo desde el contenido y avanza al paso 2 (mapeo IA).
     */
    const handleUploadProceed = async (filesData: ParsedFile[]) => {
        if (!selectedCompanyId) return;

        const selectedFiles = filesData.filter((file) => file.selectedSheets.length > 0);
        const mergedHeaders = Array.from(new Set(selectedFiles.flatMap((file) => file.extractedHeaders)));
        const totalRows = selectedFiles.reduce((total, file) => {
            const selectedSheetSet = new Set(file.selectedSheets);
            return total + file.sheets.filter((sheet) => selectedSheetSet.has(sheet.name)).reduce((sum, sheet) => sum + sheet.rowCount, 0);
        }, 0);

        // Intento de detección automática de periodo
        try {
            for (const file of selectedFiles) {
                const data = await file.rawFile.arrayBuffer();
                const workbook = XLSX.read(data, { cellDates: true, cellFormula: true });
                const discovered = detectPeriodFromWorkbook(workbook);
                if (discovered.month) setPeriodMonth(discovered.month);
                if (discovered.year) setPeriodYear(discovered.year);
                if (discovered.month || discovered.year) break; // Usar el primer hallazgo
            }
        } catch (e) {
            console.warn('Period detection failed:', e);
        }

        setUploadedFiles(selectedFiles);
        setUploadedHeaders(mergedHeaders);
        setFileStats({
            name: selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} archivos`,
            rows: totalRows,
        });
        setAiValidationForEditor(null);
        setCurrentStep(2);
    };

    /**
     * Detecta el periodo (mes y año) escaneando las primeras 20 filas del workbook.
     * Busca nombres de meses en español y años entre 2020-2030.
     * @param workbook - Libro de Excel parseado con XLSX
     * @returns Objeto con month y year detectados (null si no se encuentran)
     */
    const detectPeriodFromWorkbook = (workbook: XLSX.WorkBook) => {
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        let detectedMonth: number | null = null;
        let detectedYear: number | null = null;

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            // Solo escaneamos las primeras 20 filas para rendimiento
            const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, range: 0, raw: false });
            const sample = matrix.slice(0, 20).flat().map(v => String(v).toLowerCase());

            for (const val of sample) {
                // Buscar meses
                months.forEach((m, idx) => {
                    if (val.includes(m)) detectedMonth = idx + 1;
                });

                // Buscar años (2020-2030)
                const yearMatch = val.match(/\b(202[0-9]|2030)\b/);
                if (yearMatch) detectedYear = parseInt(yearMatch[1]);

                if (detectedMonth && detectedYear) break;
            }
            if (detectedMonth || detectedYear) break;
        }
        return { month: detectedMonth, year: detectedYear };
    };

    const handleMappingConfirm = (result: MappingResult) => {
        setMappingResult(result);
        setAiValidationForEditor(null);
        setCurrentStep(3);
    };

    /**
     * Transforma matrices crudas en filas con nombres de campo mapeados (source → target).
     * @param matrices - Matrices de datos parseadas de los archivos Excel
     * @returns Array de objetos donde las claves son los nombres de campo destino
     */
    const buildMappedRows = (matrices: MatrixInput[]) => {
        const targetBySource = new Map<string, string>();
        for (const rel of mappingResult.mappingDetails) {
            targetBySource.set(rel.source.toLowerCase().trim(), rel.target);
        }

        return matrices.flatMap((matrix) =>
            matrix.rows.map((row) => {
                const obj: Record<string, unknown> = {};
                matrix.headers.forEach((h, i) => {
                    const key = targetBySource.get(h.toLowerCase().trim()) ?? h;
                    obj[key] = row[i];
                });
                return obj;
            })
        );
    };

    /**
     * Navega al paso 4 (corrección): parsea las matrices de datos, ejecuta validación
     * matemática local y solicita validación IA al endpoint `/api/ai/validation`.
     */
    const handleGoToCorrection = async () => {
        if (uploadedFiles.length === 0) return;
        setIsParsing(true);
        setIsAnalyzingAiForEditor(true);
        try {
            const matrices: MatrixInput[] = [];
            for (const file of uploadedFiles) {
                const selected = new Set(file.selectedSheets);
                const data = await file.rawFile.arrayBuffer();
                const workbook = XLSX.read(data, { cellDates: true, cellFormula: true });
                for (const sheetName of workbook.SheetNames) {
                    if (!selected.has(sheetName)) continue;
                    const worksheet = workbook.Sheets[sheetName];
                    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });
                    if (!matrix || matrix.length < 2) continue;
                    const headers = (matrix[0] ?? []).map((h) => String(h ?? '').trim());
                    const rows = matrix.slice(1);

                    // Capturar fórmulas
                    const formulas: (string | null)[][] = [];
                    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
                    for (let r = 1; r <= range.e.r; r++) {
                        const formulaRow: (string | null)[] = [];
                        for (let c = 0; c <= range.e.c; c++) {
                            const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
                            formulaRow.push(cell?.f ?? null);
                        }
                        formulas.push(formulaRow);
                    }

                    matrices.push({ headers, rows, formulas, fileName: file.name, sheetName });
                }
            }
            const report = validatePayrollCalculations({
                countryCode: selectedCountry,
                year: periodYear,
                matrices,
                relations: mappingResult.mappingDetails,
            });
            let aiReportForEditor: AiValidationReport | null = null;
            try {
                const allRows = buildMappedRows(matrices);
                const aiRes = await fetch('/api/ai/validation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        allRows,
                        countryCode: selectedCountry,
                        year: periodYear,
                        ruleChecks: activeRule.checks,
                    }),
                });
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    if (aiData.report) aiReportForEditor = aiData.report as AiValidationReport;
                }
            } catch (error) {
                console.warn('AI analysis for editor skipped:', error);
            }
            setParsedMatrices(matrices);
            setMathValidationForEditor(report);
            setAiValidationForEditor(aiReportForEditor);
            setCorrections([]);
            setCurrentStep(4);
        } finally {
            setIsParsing(false);
            setIsAnalyzingAiForEditor(false);
        }
    };

    /**
     * Guarda la planilla completa en la BD: agrega riesgo por empleado, validación
     * matemática, validación IA, resumen de conceptos y correcciones aplicadas.
     * Persiste via POST a `/api/payrolls` y opcionalmente PATCH para correcciones.
     */
    const handleSavePayroll = async () => {
        if (!selectedCompanyId || uploadedFiles.length === 0) return;

        setIsSavingPayroll(true);
        try {
            const aggregates = new Map<string, {
                document: string;
                name: string;
                salaryTotal: number;
                nonSalaryTotal: number;
                iblTotal: number;
                aporteTotal: number;
                findings: Set<string>;
            }>();
            const matricesForValidation: Array<{ headers: string[]; rows: unknown[][]; fileName: string; sheetName: string }> = [];
            const relationHints = mappingResult.mappingDetails.reduce<Record<string, string>>((acc, item) => {
                if (item.source && item.analysisCategory) {
                    acc[item.source] = item.analysisCategory;
                }
                return acc;
            }, {});

            if (currentStep === 4 && parsedMatrices) {
                // Use pre-parsed matrices from the editor, with corrections applied
                for (const [si, matrix] of parsedMatrices.entries()) {
                    const correctedRows = matrix.rows.map((row, ri) => {
                        const rowCorr = corrections.filter((c) => c.sheetIndex === si && c.rowIndex === ri);
                        if (!rowCorr.length) return row;
                        const newRow = [...row];
                        for (const c of rowCorr) newRow[c.colIndex] = c.newValue;
                        return newRow;
                    });
                    summarizeEmployeeRiskFromMatrix({ headers: matrix.headers, rows: correctedRows, aggregates, relationHints });
                    matricesForValidation.push({ headers: matrix.headers, rows: correctedRows, fileName: matrix.fileName ?? '', sheetName: matrix.sheetName ?? '' });
                }
            } else {
                for (const file of uploadedFiles) {
                    const selected = new Set(file.selectedSheets);
                    if (selected.size === 0) continue;

                    const data = await file.rawFile.arrayBuffer();
                    const workbook = XLSX.read(data, { cellDates: true, cellFormula: true });

                    for (const sheetName of workbook.SheetNames) {
                        if (!selected.has(sheetName)) continue;
                        const worksheet = workbook.Sheets[sheetName];
                        const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null });
                        if (!matrix || matrix.length < 2) continue;
                        const headers = (matrix[0] ?? []).map((h) => String(h ?? '').trim());
                        const rows = matrix.slice(1);
                        summarizeEmployeeRiskFromMatrix({ headers, rows, aggregates, relationHints });
                        matricesForValidation.push({ headers, rows, fileName: file.name, sheetName });
                    }
                }
            }

            const employeeRiskSummary = finalizeEmployeeRiskSummary(aggregates);
            const calculationValidationReport = validatePayrollCalculations({
                countryCode: selectedCountry,
                year: periodYear,
                matrices: matricesForValidation,
                relations: mappingResult.mappingDetails,
            });
            const certificationReadyFinal = certificationReady && calculationValidationReport.criticalFindings === 0;

            // AI Validation: prepare all rows with mapped field names and call AI
            const targetBySource = new Map<string, string>();
            for (const rel of mappingResult.mappingDetails) {
                targetBySource.set(rel.source.toLowerCase().trim(), rel.target);
            }
            const allRows = matricesForValidation.flatMap((matrix) =>
                matrix.rows.map((row) => {
                    const obj: Record<string, unknown> = {};
                    matrix.headers.forEach((h, i) => {
                        const key = targetBySource.get(h.toLowerCase().trim()) ?? h;
                        obj[key] = row[i];
                    });
                    return obj;
                })
            );

            let aiValidationReport = {};
            try {
                const aiRes = await fetch('/api/ai/validation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        allRows,
                        countryCode: selectedCountry,
                        year: periodYear,
                        ruleChecks: activeRule.checks,
                    }),
                });
                if (aiRes.ok) {
                    const aiData = await aiRes.json();
                    if (aiData.report) aiValidationReport = aiData.report;
                }
            } catch (aiError) {
                console.warn('AI validation skipped:', aiError);
            }

            const sheetSummary = uploadedFiles.flatMap((file) => {
                const selected = new Set(file.selectedSheets);
                return file.sheets
                    .filter((sheet) => selected.has(sheet.name))
                    .map((sheet) => ({
                        fileName: file.name,
                        sheetName: sheet.name,
                        rowCount: sheet.rowCount,
                        headerCount: sheet.headers.length,
                    }));
            });

            const detectedVariables = Array.from(
                new Set(uploadedFiles.flatMap((file) => file.extractedHeaders.map((h) => h.trim()).filter(Boolean)))
            );
            const conceptSummary = summarizeConcepts(detectedVariables);
            const riskReport = buildRiskReport({
                conceptSummary,
                missingRequiredFields,
                missingRequiredCalculations,
                certificationReady,
            });

            const payload = {
                companyId: selectedCompanyId,
                countryCode: selectedCountry,
                year: periodYear,
                month: periodMonth,
                ruleLabel: activeRule.label,
                certificationReady: certificationReadyFinal,
                fileCount: uploadedFiles.length,
                mappedFields: mappingResult.mappedTargets,
                createdFields: mappingResult.createdTargets,
                mappingRelations: mappingResult.mappingDetails,
                missingRequiredFields,
                missingRequiredCalculations,
                sheetSummary,
                detectedVariables,
                conceptSummary,
                riskReport,
                employeeRiskSummary,
                calculationValidationReport,
                aiValidationReport,
                sourceMatrices: matricesForValidation,
            };

            const res = await fetch('/api/payrolls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'No se pudo guardar la planilla');
            }

            const newPayrollId = typeof data.payroll?.id === 'string' ? data.payroll.id : null;
            if (newPayrollId) setSavedPayrollId(newPayrollId);

            // If corrections were applied in step 4, save the correction summary
            if (corrections.length > 0 && newPayrollId) {
                try {
                    const correctionSummary = {
                        appliedAt: new Date().toISOString(),
                        totalCells: corrections.length,
                        bySource: {
                            manual: corrections.filter((c) => c.source === 'manual').length,
                            ai: corrections.filter((c) => c.source === 'ai').length,
                        },
                        summary: corrections.map((c) => ({
                            sheet: matricesForValidation[c.sheetIndex]?.sheetName ?? `Hoja${c.sheetIndex + 1}`,
                            col: matricesForValidation[c.sheetIndex]?.headers[c.colIndex] ?? c.colIndex,
                            row: c.rowIndex + 1,
                            from: c.originalValue,
                            to: c.newValue,
                            source: c.source,
                        })),
                    };
                    await fetch('/api/payrolls', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: newPayrollId, corrections: correctionSummary }),
                    });
                } catch { /* ignore */ }
            }

            setSavedSuccess(true);
            void loadRecentPayrolls();
        } catch (error) {
            console.error('Save payroll failed:', error);
        } finally {
            setIsSavingPayroll(false);
        }
    };

    /** Exporta la planilla con correcciones aplicadas a un archivo Excel descargable. */
    const handleExportExcel = () => {
        if (!parsedMatrices || parsedMatrices.length === 0) return;

        const workbook = XLSX.utils.book_new();
        for (const [si, matrix] of parsedMatrices.entries()) {
            const correctedRows = matrix.rows.map((row, ri) => {
                const rowCorr = corrections.filter((c) => c.sheetIndex === si && c.rowIndex === ri);
                if (!rowCorr.length) return row;
                const newRow = [...row];
                for (const c of rowCorr) newRow[c.colIndex] = c.newValue;
                return newRow;
            });
            const wsData = [matrix.headers, ...correctedRows];
            const worksheet = XLSX.utils.aoa_to_sheet(wsData);
            const sheetName = (matrix.sheetName ?? `Hoja${si + 1}`).slice(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }

        const company = selectedCompany?.name ?? 'nomina';
        const filename = `${company}_${selectedCountry}_${periodYear}-${String(periodMonth).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(workbook, filename);
    };

    const canStartUpload = Boolean(selectedCompanyId);

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div>
                <h1 className="text-xl font-bold text-slate-900">Cargar Nómina</h1>
                <p className="text-sm text-slate-400 mt-0.5">Sube y valida tu archivo de nómina según país y periodo para certificar</p>
            </div>

            {/* Company & context selector */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl bg-violet/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4.5 h-4.5 text-violet" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-800">Empresa y contexto normativo</h2>
                        <p className="text-xs text-slate-400">Asocia esta nómina a una empresa y define el país y período</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                    <div className="lg:col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Empresa *</label>
                        <select className="w-full h-10 px-3" value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}>
                            <option value="">Seleccione una empresa</option>
                            {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                    {company.name} — {company.nit}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setShowCreateCompany((prev) => !prev)}>
                        + Nueva empresa
                    </Button>
                </div>

                {showCreateCompany && (
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-violet/20 bg-violet/5">
                        <input placeholder="Nombre empresa" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="h-10 px-3 placeholder:text-slate-500" />
                        <input placeholder="NIT" value={newCompanyNit} onChange={(e) => setNewCompanyNit(e.target.value)} className="h-10 px-3 placeholder:text-slate-500" />
                        <input placeholder="Industria (opcional)" value={newCompanyIndustry} onChange={(e) => setNewCompanyIndustry(e.target.value)} className="h-10 px-3 placeholder:text-slate-500" />
                        <Button type="button" onClick={handleCreateCompany}>
                            Guardar
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                            <Globe2 className="w-3.5 h-3.5" /> País
                        </label>
                        <select value={selectedCountry} onChange={(e) => setSelectedCountry(e.target.value as 'CO' | 'MX')} className="w-full h-10 px-3">
                            <option value="CO">Colombia</option>
                            <option value="MX">México</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                            <CalendarClock className="w-3.5 h-3.5" /> Año de validación
                        </label>
                        <select value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))} className="w-full h-10 px-3" disabled={isLoadingRules || availableYears.length === 0}>
                            {availableYears.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Mes de planilla</label>
                        <select value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))} className="w-full h-10 px-3">
                            {Array.from({ length: 12 }).map((_, idx) => (
                                <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedCompany && (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald flex-shrink-0" />
                        <span className="font-semibold text-slate-700">{selectedCompany.name}</span>
                        <span className="text-slate-300">·</span>
                        {selectedCountry} {periodYear}
                    </div>
                )}
            </div>

            {/* ── Planillas cargadas ───────────────────────── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button
                    onClick={() => setShowRecent((prev) => !prev)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700">
                            Planillas guardadas
                        </span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {recentPayrolls.length}
                        </span>
                    </div>
                    {showRecent ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showRecent && (
                    <div className="border-t border-slate-100">
                        {recentPayrolls.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No hay planillas guardadas aún.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {recentPayrolls.map((p) => {
                                    const isDeleting = deletingPayrollId === p.id;
                                    return (
                                        <li key={p.id} className={cn('flex items-center justify-between px-5 py-3 text-sm', isDeleting && 'opacity-50')}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', p.certification_ready ? 'bg-emerald' : 'bg-rose-400')} />
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-700 truncate">{p.company_name ?? 'Sin empresa'}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {p.country_code} · {p.period_month}/{p.period_year} · {p.rule_label ?? 'Sin regla'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <span className="text-xs text-slate-400 hidden sm:block">
                                                    {new Date(p.created_at).toLocaleDateString('es-CO')}
                                                </span>
                                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex', p.certification_ready ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600')}>
                                                    {p.certification_ready ? 'Certificable' : 'No certificable'}
                                                </span>
                                                <button
                                                    onClick={() => void handleDeleteRecentPayroll(p.id)}
                                                    disabled={isDeleting}
                                                    title="Eliminar planilla"
                                                    className="p-1.5 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {/* ── Stepper with Agents ───────────────────────────────────── */}
            <div className="flex items-center gap-0 py-2">
                {[
                    { step: 1, label: 'Cargar datos', agentId: 'master', icon: null },
                    { step: 2, label: 'Mapeo IA', agentId: 'mapper', icon: Sparkles },
                    { step: 3, label: 'Auditoría', agentId: 'auditor', icon: Database },
                    { step: 4, label: 'Corrección', agentId: 'corrector', icon: PenLine },
                ].map((item, idx) => {
                    const persona = getPersona(item.agentId);
                    return (
                        <div key={item.step} className="contents">
                            {idx > 0 && (
                                <div className="flex-1 mx-2 pb-8">
                                    <div className="h-0.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div className={cn('h-full bg-violet transition-all duration-500', currentStep > idx ? 'w-full' : 'w-0')} />
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => item.step <= currentStep ? setCurrentStep(item.step) : undefined}
                                className="flex flex-col items-center gap-1 flex-shrink-0"
                            >
                                <div className={cn(
                                    'relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
                                    currentStep >= item.step
                                        ? 'ring-2 ring-violet/40 shadow-md'
                                        : 'ring-2 ring-slate-200 opacity-50'
                                )}>
                                    <AgentAvatar agentId={item.agentId} size={38} animate={currentStep === item.step} />
                                </div>
                                <span className={cn('text-[10px] font-bold whitespace-nowrap', currentStep >= item.step ? 'text-slate-800' : 'text-slate-400')}>
                                    {persona.name}
                                </span>
                                <span className={cn('text-[9px] whitespace-nowrap', currentStep >= item.step ? 'text-slate-500' : 'text-slate-300')}>
                                    {item.label}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Step trace */}
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Progreso</h3>
                <div className="space-y-2.5">
                    {stepResults.map((item, idx) => (
                        <div key={item.title} className="flex items-start gap-3">
                            <span className={cn(
                                'mt-0.5 h-5 w-5 rounded-full text-[10px] flex items-center justify-center font-bold flex-shrink-0',
                                currentStep > idx ? 'bg-emerald text-white' : 'bg-slate-100 text-slate-500'
                            )}>
                                {idx + 1}
                            </span>
                            <div>
                                <p className="text-xs font-semibold text-slate-700">{item.title}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{item.result}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Step content */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                {currentStep === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <AgentAvatar agentId="master" size={36} animate />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    {getPersona('master').emoji} {getPersona('master').name}: Archivos de nómina
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">Carga hojas de nómina y base de cálculo. Gyoru 🐈‍⬛ mapeará tus columnas en el siguiente paso.</p>
                            </div>
                        </div>
                        <UploadZone onProceed={handleUploadProceed} />
                        {!canStartUpload && <p className="text-xs text-rose mt-4">Selecciona una empresa antes de continuar.</p>}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-cyan-50 border border-cyan-100">
                            <AgentAvatar agentId="mapper" size={36} animate />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    {getPersona('mapper').emoji} {getPersona('mapper').name}: Mapeo inteligente
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">Conecto tus columnas con el sistema normativo usando IA.</p>
                            </div>
                        </div>
                        <MappingAI
                            dynamicHeaders={uploadedHeaders}
                            fileName={fileStats.name}
                            countryCode={selectedCountry}
                            year={periodYear}
                            requiredFields={activeRule.requiredFields}
                            requiredCalculations={activeRule.requiredCalculations}
                            onConfirm={handleMappingConfirm}
                        />
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <AgentAvatar agentId="auditor" size={36} animate />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    {getPersona('auditor').emoji} {getPersona('auditor').name}: Auditoría y verificación
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">Reviso cada número contra la normativa vigente. Ningún error se me escapa.</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="font-semibold text-slate-900">Resumen de validación</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Empresa: <span className="font-semibold">{selectedCompany?.name ?? 'Sin empresa'}</span> | País: {selectedCountry} | Periodo: {periodMonth}/{periodYear} | Registros estimados: {fileStats.rows}
                            </p>
                        </div>

                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                            <h4 className="font-semibold text-indigo-900 mb-2">Regla activa: {activeRule.label}</h4>
                            <ul className="text-sm text-indigo-800 space-y-1">
                                {activeRule.checks.map((check) => (
                                    <li key={check} className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> {check}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className={cn('rounded-xl border p-4', missingRequiredFields.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50')}>
                            <h4 className="font-semibold text-slate-900 mb-2">Campos requeridos de la regla</h4>
                            {missingRequiredFields.length > 0 ? (
                                <div>
                                    <p className="text-sm text-amber-700 flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4" /> Faltan campos estructurales para certificar
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {missingRequiredFields.map((field) => (
                                            <span key={field} className="px-2 py-1 text-xs rounded-full bg-white border border-amber-300 text-amber-800">{field}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-emerald-700">Todos los campos requeridos están mapeados.</p>
                            )}
                        </div>

                        <div className={cn('rounded-xl border p-4', missingRequiredCalculations.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50')}>
                            <h4 className="font-semibold text-slate-900 mb-2">Cálculos requeridos para certificación</h4>
                            {missingRequiredCalculations.length > 0 ? (
                                <div>
                                    <p className="text-sm text-amber-700 flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-4 h-4" /> Faltan cálculos requeridos para {selectedCountry} {periodYear}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {missingRequiredCalculations.map((calc) => (
                                            <span key={calc} className="px-2 py-1 text-xs rounded-full bg-white border border-amber-300 text-amber-800">{calc}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-emerald-700">Cálculos obligatorios completos para certificar.</p>
                            )}
                        </div>

                        <div className={cn('rounded-xl border p-4', certificationReady ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50')}>
                            <h4 className="font-semibold text-slate-900 mb-1">Estado de certificación</h4>
                            <p className={cn('text-sm', certificationReady ? 'text-emerald-700' : 'text-rose-700')}>
                                {certificationReady
                                    ? `Estructura completa para ${selectedCountry} - ${activeRule.label}. La certificacion final incluye validacion de calculos al guardar.`
                                    : `No certificable aun: completa campos y calculos requeridos para ${selectedCountry} - ${activeRule.label}`}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <h4 className="font-semibold text-slate-900 mb-2">Cobertura de conceptos detectados</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                {Object.entries(conceptSummaryPreview.byCategory).map(([key, value]) => (
                                    <div key={key} className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                                        <span className="font-medium text-slate-700">{key}</span>: {value}
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm mt-3 text-slate-600">
                                Riesgo preliminar: <span className={cn('font-semibold', riskPreview.level === 'high' ? 'text-rose-700' : riskPreview.level === 'medium' ? 'text-amber-700' : 'text-emerald-700')}>{riskPreview.score}/100 ({riskPreview.level})</span>
                            </p>
                        </div>

                        {mappingResult.mappingDetails.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <h4 className="font-semibold text-slate-900 mb-2">Relacion de campos para analisis</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    {Object.entries(mappingCoverageByCategory).map(([key, value]) => (
                                        <div key={key} className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1">
                                            <span className="font-medium text-slate-700">{key}</span>: {value}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mappingResult.createdTargets.length > 0 && (
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <h4 className="font-semibold text-slate-900 mb-2">Campos creados automaticamente</h4>
                                <div className="flex flex-wrap gap-2">
                                    {mappingResult.createdTargets.map((field) => (
                                        <span key={field} className="px-2 py-1 text-xs rounded-full bg-slate-100 border border-slate-200 text-slate-700">{field}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {savedSuccess ? (
                            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-800">Planilla guardada correctamente</p>
                                        <p className="text-xs text-emerald-600 mt-0.5">Puedes ver el reporte en la sección de Reportes, o corregir los datos ahora.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => void handleGoToCorrection()} disabled={isParsing || uploadedFiles.length === 0}>
                                        {isParsing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <PenLine className="w-4 h-4 mr-1.5" />}
                                        Corregir datos
                                    </Button>
                                    <Button variant="outline" onClick={() => { setSavedSuccess(false); setSavedPayrollId(null); setCurrentStep(1); setUploadedFiles([]); setMappingResult({ mappedTargets: [], createdTargets: [], mappingDetails: [] }); }}>
                                        Cargar otra
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-violet/20 bg-violet/5 p-4">
                                <div className="flex items-start gap-3 mb-4">
                                    <PenLine className="w-5 h-5 text-violet flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">¿Quieres corregir los datos antes de guardar?</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Tendrás dos modos: manual celda por celda y asistido por IA para sugerencias rápidas por fila.</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <button
                                        onClick={handleSavePayroll}
                                        disabled={isSavingPayroll || !selectedCompanyId || uploadedFiles.length === 0}
                                        className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors disabled:opacity-40"
                                    >
                                        {isSavingPayroll ? 'Guardando...' : 'Guardar sin corregir'}
                                    </button>
                                    <Button onClick={() => void handleGoToCorrection()} disabled={isParsing || uploadedFiles.length === 0}>
                                        {isParsing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <PenLine className="w-4 h-4 mr-1.5" />}
                                        {isParsing ? 'Cargando editor...' : 'Abrir editor de correcciones'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <AgentAvatar agentId="corrector" size={36} animate />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">
                                    {getPersona('corrector').emoji} {getPersona('corrector').name}: Corrección de nómina
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">Calculo las correcciones exactas con precisión de ingeniero.</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="font-semibold text-slate-900">Corrección de nómina</h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Empresa: <span className="font-semibold">{selectedCompany?.name ?? 'Sin empresa'}</span> | País: {selectedCountry} | Periodo: {periodMonth}/{periodYear}
                                {mathValidationForEditor && mathValidationForEditor.rowsWithFindings > 0 && (
                                    <span className="ml-2 text-amber-600 font-medium">· {mathValidationForEditor.rowsWithFindings} fila(s) con hallazgos del motor</span>
                                )}
                                {isAnalyzingAiForEditor && (
                                    <span className="ml-2 text-violet font-medium">· Analizando con IA...</span>
                                )}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modo manual</p>
                                <p className="mt-1 text-sm text-slate-700">
                                    Edita cualquier celda directamente y deja trazabilidad de cambios.
                                </p>
                            </div>
                            <div className="rounded-xl border border-violet/20 bg-violet/5 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-violet-dark">Modo asistido por IA</p>
                                <p className="mt-1 text-sm text-slate-700">
                                    Usa sugerencias IA en filas con hallazgos para acelerar correcciones repetitivas.
                                </p>
                            </div>
                        </div>

                        {parsedMatrices ? (
                            <PayrollEditor
                                matrices={parsedMatrices}
                                relations={mappingResult.mappingDetails}
                                validationReport={mathValidationForEditor}
                                aiReport={aiValidationForEditor}
                                payrollId={savedPayrollId}
                                countryCode={selectedCountry}
                                year={periodYear}
                                onCorrectionsChange={setCorrections}
                            />
                        ) : (
                            <div className="text-center py-12 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
                                <p className="text-sm">Cargando datos de la planilla…</p>
                            </div>
                        )}

                        {!savedSuccess && (
                            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                                    ← Volver a verificación
                                </Button>
                                <Button
                                    onClick={handleSavePayroll}
                                    disabled={isSavingPayroll || !selectedCompanyId || uploadedFiles.length === 0}
                                >
                                    {isSavingPayroll ? 'Guardando...' : corrections.length > 0 ? 'Guardar planilla con correcciones' : 'Guardar planilla'}
                                </Button>
                            </div>
                        )}

                        {savedSuccess && (
                            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-emerald-800">
                                            Planilla guardada{corrections.length > 0 ? ` con ${corrections.length} corrección(es)` : ''} correctamente
                                        </p>
                                        <p className="text-xs text-emerald-600 mt-0.5">Puedes ver el reporte antes/después en la sección de Reportes.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={handleExportExcel} disabled={!parsedMatrices}>
                                        <Download className="w-4 h-4 mr-1.5" />
                                        Exportar Excel
                                    </Button>
                                    <Button variant="outline" onClick={() => { setSavedSuccess(false); setSavedPayrollId(null); setCurrentStep(1); setUploadedFiles([]); setMappingResult({ mappedTargets: [], createdTargets: [], mappingDetails: [] }); setCorrections([]); }}>
                                        Cargar otra
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
