'use client';

import { useState } from 'react';
import { UploadCloud, X, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import * as XLSX from 'xlsx';

/**
 * Representa una hoja individual parseada de un archivo Excel.
 * Contiene los encabezados detectados y la cantidad de filas de datos.
 */
export interface ParsedSheet {
    /** Nombre de la hoja dentro del libro Excel */
    name: string;
    /** Encabezados de columna detectados en la primera fila */
    headers: string[];
    /** Cantidad de filas de datos (excluyendo la fila de encabezados) */
    rowCount: number;
}

/**
 * Representa un archivo Excel/CSV/XML procesado y listo para mapeo.
 * Incluye las hojas parseadas, la selección del usuario y los encabezados
 * unificados de las hojas seleccionadas.
 */
export interface ParsedFile {
    /** Nombre original del archivo */
    name: string;
    /** Tamaño del archivo en bytes */
    size: number;
    /** Tipo MIME del archivo */
    type: string;
    /** Hojas detectadas dentro del archivo */
    sheets: ParsedSheet[];
    /** Nombres de las hojas seleccionadas por el usuario para procesar */
    selectedSheets: string[];
    /** Encabezados unificados (merge) de todas las hojas seleccionadas */
    extractedHeaders: string[];
    /** Referencia al objeto File original para envío posterior */
    rawFile: File;
}

/** Tamaño máximo permitido por archivo: 1 GB */
const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB

/**
 * Zona de carga de archivos de nómina con soporte drag-and-drop.
 *
 * Parsea archivos Excel (.xlsx/.xls), CSV y XML usando la librería XLSX,
 * detecta hojas y encabezados automáticamente, y permite al usuario
 * seleccionar qué hojas incluir antes de continuar al paso de mapeo IA.
 *
 * Importa {@link AgentAvatar} para mostrar el avatar del agente IA asociado
 * al paso de carga (preparado para integración futura en la UI).
 *
 * @param props.onProceed - Callback invocado al hacer clic en "Continuar a mapeo con IA".
 *   Recibe el array de archivos parseados ({@link ParsedFile}[]) con las hojas seleccionadas.
 * @returns Componente de zona de carga con lista de archivos procesados y selector de hojas.
 */

export default function UploadZone({ onProceed }: { onProceed?: (fileData: ParsedFile[]) => void }) {
    const t = useTranslations('Upload');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<ParsedFile[]>([]);
    const [isParsing, setIsParsing] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const getSheetData = (workbook: XLSX.WorkBook, sheetName: string): ParsedSheet => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
        const headers = jsonData.length > 0 ? (jsonData[0] || []).map(String) : [];
        const rowCount = Math.max(jsonData.length - 1, 0);

        return {
            name: sheetName,
            headers,
            rowCount,
        };
    };

    const getMergedHeaders = (sheets: ParsedSheet[], selectedSheetNames: string[]) => {
        return Array.from(
            new Set(
                sheets
                    .filter((sheet) => selectedSheetNames.includes(sheet.name))
                    .flatMap((sheet) => sheet.headers)
            )
        );
    };

    const processFile = async (file: File) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            console.error(`Archivo ${file.name} excede el limite de 1GB`);
            return;
        }

        setIsParsing(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { cellDates: true, cellFormula: true });
            const sheets = workbook.SheetNames.map((sheetName) => getSheetData(workbook, sheetName));
            const selectedSheets = sheets.length > 0 ? [sheets[0].name] : [];
            const extractedHeaders = getMergedHeaders(sheets, selectedSheets);

            setUploadedFiles((prev) => [
                ...prev,
                {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'unknown',
                    sheets,
                    selectedSheets,
                    extractedHeaders,
                    rawFile: file,
                },
            ]);
        } catch (error) {
            console.error('Failed to parse Excel file:', error);
            setUploadedFiles((prev) => [
                ...prev,
                {
                    name: file.name,
                    size: file.size,
                    type: file.type || 'unknown',
                    sheets: [],
                    selectedSheets: [],
                    extractedHeaders: [],
                    rawFile: file,
                },
            ]);
        } finally {
            setIsParsing(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                await processFile(file);
            }
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleSheetToggle = (fileIdx: number, sheetName: string, isSelected: boolean) => {
        const fileData = uploadedFiles[fileIdx];
        if (!fileData) return;

        const selectedSet = new Set(fileData.selectedSheets);
        if (isSelected) {
            selectedSet.add(sheetName);
        } else {
            selectedSet.delete(sheetName);
        }

        const selectedSheets = Array.from(selectedSet);
        const extractedHeaders = getMergedHeaders(fileData.sheets, selectedSheets);

        setUploadedFiles((prev) => {
            const updated = [...prev];
            updated[fileIdx] = {
                ...updated[fileIdx],
                selectedSheets,
                extractedHeaders,
            };
            return updated;
        });
    };

    const canProceed = uploadedFiles.length > 0 && uploadedFiles.some((file) => file.selectedSheets.length > 0);

    return (
        <div className="w-full max-w-3xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'relative border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-all bg-black/40 overflow-hidden group/upload',
                    isDragging
                        ? 'border-emerald-light bg-emerald-950/40 scale-[1.02] shadow-[0_0_30px_rgba(52,211,153,0.2)]'
                        : 'border-white/20 hover:border-emerald-light/50 hover:bg-emerald-950/20 hover:shadow-[0_0_20px_rgba(52,211,153,0.1)]'
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 to-transparent opacity-0 group-hover/upload:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div
                    className={cn(
                        'p-4 rounded-full mb-4 transition-transform duration-300 shadow-sm',
                        isDragging
                            ? 'bg-emerald-600 text-white scale-110 shadow-[0_0_15px_rgba(52,211,153,0.6)]'
                            : 'bg-emerald-950/50 text-emerald-light group-hover/upload:scale-110 group-hover/upload:bg-emerald-900/50 group-hover/upload:shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                    )}
                >
                    {isParsing ? (
                        <div className="w-8 h-8 border-4 border-current border-t-transparent flex-shrink-0 rounded-full animate-spin" />
                    ) : (
                        <UploadCloud className="w-8 h-8" />
                    )}
                </div>
                <h3 className="text-lg font-semibold text-white drop-shadow-sm mb-2 relative z-10 transition-colors group-hover/upload:text-emerald-light">
                    {t('dragAndDrop')}
                </h3>
                <p className="text-sm text-slate-400 mb-6 text-center max-w-sm relative z-10">
                    Soporta Excel multi-hoja (.xlsx), CSV y XML hasta 1GB por archivo.
                </p>

                <Button variant="secondary" className="relative overflow-hidden z-10 shadow-sm hover:shadow group/btn">
                    <span className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 transition-transform group-hover/btn:scale-110" />
                        Seleccionar archivos
                    </span>
                    <input
                        type="file"
                        accept=".xlsx,.xls,.csv,.xml"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        multiple
                        onChange={async (e) => {
                            if (e.target.files) {
                                const files = Array.from(e.target.files);
                                for (const file of files) {
                                    await processFile(file);
                                }
                            }
                        }}
                    />
                </Button>

                {/* Dianis tip */}
                <div className="mt-4 flex items-center gap-2 relative z-10">
                  <AgentAvatar agentId="master" size={20} animate={false} />
                  <span className="text-[11px] text-slate-400 italic">
                    Dianis: &quot;Solo arrastra tu archivo y yo me encargo del resto&quot; ✨
                  </span>
                </div>
            </div>
            </div>

            {uploadedFiles.length > 0 && (
                <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center justify-between">
                        Listos para mapeo
                        <span className="bg-emerald-100 text-emerald-800 text-xs py-0.5 px-2 rounded-full font-semibold">
                            {uploadedFiles.length} archivo(s)
                        </span>
                    </h4>
                    <div className="space-y-4">
                        {uploadedFiles.map((file, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col p-4 border border-white/10 glass-panel rounded-xl shadow-lg shadow-black/20 hover:shadow-black/40 hover:border-emerald-light/30 transition-all hover:-translate-y-0.5"
                            >
                                <div className="flex items-center">
                                    <div className="p-2 bg-black/20 rounded-lg mr-4 border border-white/5">
                                        <FileSpreadsheet className="w-6 h-6 text-emerald-light drop-shadow-[0_0_5px_rgba(52,211,153,0.5)] flex-shrink-0" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                                        <div className="flex items-center gap-3 mt-0.5">
                                            <p className="text-xs text-slate-400 font-medium">{formatSize(file.size)}</p>
                                            <span className="text-white/20 text-xs">-</span>
                                            <p className="text-xs text-emerald-light font-medium bg-emerald-950/50 border border-emerald-light/20 px-1.5 py-0.5 rounded-md">
                                                {file.extractedHeaders.length} columnas detectadas
                                            </p>
                                            <span className="text-white/20 text-xs">-</span>
                                            <p className="text-xs text-slate-300">
                                                {file.selectedSheets.length}/{file.sheets.length} hoja(s)
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-light drop-shadow-[0_0_5px_rgba(52,211,153,0.5)] hidden sm:block delay-100 animate-in zoom-in" />
                                        <button
                                            onClick={() => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                                            title="Eliminar archivo"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {file.sheets.length > 1 && (
                                    <div className="mt-4 pt-4 border-t border-white/10 bg-black/20 p-3 rounded-lg shadow-inner">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">
                                            Hojas objetivo de datos
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {file.sheets.map((sheet) => (
                                                <label
                                                    key={sheet.name}
                                                    className="flex items-center justify-between text-sm border border-white/10 rounded-md px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
                                                >
                                                    <span className="text-slate-200">{sheet.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-slate-400">{sheet.rowCount} filas</span>
                                                        <input
                                                            type="checkbox"
                                                            checked={file.selectedSheets.includes(sheet.name)}
                                                            onChange={(e) => handleSheetToggle(idx, sheet.name, e.target.checked)}
                                                            className="h-4 w-4 accent-emerald-500 focus:ring-emerald-500/50"
                                                        />
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex justify-end">
                        <Button
                            size="lg"
                            className="shadow-emerald-200/50 hover:shadow-emerald-300/50 shadow-lg text-sm px-8"
                            onClick={() => onProceed && onProceed(uploadedFiles)}
                            disabled={isParsing || !canProceed}
                        >
                            Continuar a mapeo con IA
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
