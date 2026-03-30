'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle, Cpu, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { colors, elevation } from '@/lib/design-tokens';
import type { ProviderSummary } from '@/lib/types/pipeline';

interface DashboardHealthProps {
    /** AI providers to display in the health panel (Req 2.4) */
    providers: ProviderSummary[];
}

/**
 * Panel de salud de proveedores IA (Req 2.4).
 *
 * Muestra cada proveedor configurado con:
 * - Nombre y tipo
 * - Estado activo/inactivo
 * - Resultado del último test de conectividad
 */
export function DashboardHealth({ providers }: DashboardHealthProps) {
    const t = useTranslations('Dashboard');

    const activeCount = providers.filter((p) => p.isActive).length;

    return (
        <Card style={{ boxShadow: elevation.low }}>
            <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: colors.onSurface }}>
                    <Cpu className="h-4 w-4" style={{ color: colors.primary }} />
                    {t('healthTitle')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm" style={{ color: colors.onSurface, opacity: 0.8 }}>
                {providers.length === 0 ? (
                    <p className="text-xs py-4 text-center" style={{ color: colors.onSurface, opacity: 0.4 }}>
                        {t('noProviders')}
                    </p>
                ) : (
                    <>
                        <p className="text-xs" style={{ color: `${colors.onSurface}aa` }}>
                            {activeCount} / {providers.length} {t('activeProviders')}
                        </p>
                        {providers.map((provider) => (
                            <div
                                key={provider.id}
                                className="flex items-center justify-between rounded-lg px-3 py-2"
                                style={{ backgroundColor: colors.surfaceContainer.low }}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{
                                            backgroundColor: provider.isActive ? colors.success : colors.surfaceContainer.max,
                                        }}
                                    />
                                    <span className="text-sm font-medium truncate" style={{ color: colors.onSurface }}>
                                        {provider.displayName}
                                    </span>
                                    <span className="text-xs shrink-0" style={{ color: `${colors.onSurface}66` }}>
                                        {provider.providerType}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {provider.isActive ? (
                                        <span className="text-[10px] font-medium" style={{ color: colors.success }}>
                                            {t('providerActive')}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-medium" style={{ color: `${colors.onSurface}55` }}>
                                            {t('providerInactive')}
                                        </span>
                                    )}
                                    {provider.lastTestSuccess === true && (
                                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: colors.success }} />
                                    )}
                                    {provider.lastTestSuccess === false && (
                                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: colors.error }} />
                                    )}
                                    {provider.lastTestSuccess === null && (
                                        <XCircle className="h-3.5 w-3.5" style={{ color: `${colors.onSurface}33` }} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
