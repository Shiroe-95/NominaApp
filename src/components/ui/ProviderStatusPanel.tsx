'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { AlertTriangle, Settings, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { colors, spacing, elevation } from '@/lib/design-tokens';
import type { ProviderSummary } from '@/lib/types/pipeline';

export interface ProviderStatusPanelProps {
  providers: ProviderSummary[];
}

/**
 * Panel compacto de estado de proveedores IA para el dashboard.
 *
 * Muestra un resumen de proveedores configurados (total y activos),
 * un estado vacío con CTA cuando no hay proveedores, y una lista
 * compacta con indicadores visuales de estado y alertas de test fallido.
 *
 * @param props - {@link ProviderStatusPanelProps}
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
export function ProviderStatusPanel({ providers }: ProviderStatusPanelProps) {
  const t = useTranslations('Dashboard.providers');

  const activeCount = providers.filter((p) => p.isActive).length;
  const totalCount = providers.length;

  return (
    <Card
      data-testid="provider-status-panel"
      style={{ boxShadow: elevation.low }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4" style={{ color: colors.primary }} />
          {t('title')}
        </CardTitle>
        {totalCount > 0 && (
          <Link href="/settings/providers">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Settings className="h-3.5 w-3.5 mr-1" />
              {t('configure')}
            </Button>
          </Link>
        )}
      </CardHeader>

      <CardContent>
        {totalCount === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ProviderCount total={totalCount} active={activeCount} />
            <ul
              className="flex flex-col mt-3"
              style={{ gap: spacing.sm }}
            >
              {providers.map((provider) => (
                <ProviderItem key={provider.id} provider={provider} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}


/** Estado vacío con CTA prominente para configurar el primer proveedor. */
function EmptyState() {
  const t = useTranslations('Dashboard.providers');

  return (
    <div
      data-testid="provider-empty-state"
      className="flex flex-col items-center text-center py-6"
      style={{ gap: spacing.md }}
    >
      <div
        className="rounded-full p-3"
        style={{ backgroundColor: `${colors.primary}15` }}
      >
        <Cpu className="h-6 w-6" style={{ color: colors.primary }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: colors.onSurface }}>
          {t('emptyTitle')}
        </p>
        <p className="text-xs mt-1" style={{ color: `${colors.onSurface}99` }}>
          {t('emptyDescription')}
        </p>
      </div>
      <Link href="/settings/providers">
        <Button size="sm">
          <Settings className="h-3.5 w-3.5 mr-1" />
          {t('addProvider')}
        </Button>
      </Link>
    </div>
  );
}

/** Resumen de conteo: total de proveedores y activos. */
function ProviderCount({ total, active }: { total: number; active: number }) {
  const t = useTranslations('Dashboard.providers');

  return (
    <p
      data-testid="provider-count"
      className="text-xs"
      style={{ color: `${colors.onSurface}aa` }}
    >
      {t('count', { total, active })}
    </p>
  );
}

/** Fila compacta de un proveedor con nombre, tipo, estado y alerta. */
function ProviderItem({ provider }: { provider: ProviderSummary }) {
  const t = useTranslations('Dashboard.providers');

  return (
    <li
      data-testid={`provider-item-${provider.id}`}
      className="flex items-center justify-between rounded-lg px-3 py-2"
      style={{ backgroundColor: colors.surfaceContainer.low }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: provider.isActive ? colors.success : colors.surfaceContainer.max,
          }}
          aria-label={provider.isActive ? t('active') : t('inactive')}
        />
        <span
          className="text-sm font-medium truncate"
          style={{ color: colors.onSurface }}
        >
          {provider.displayName}
        </span>
        <span
          className="text-xs shrink-0"
          style={{ color: `${colors.onSurface}66` }}
        >
          {provider.providerType}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {provider.isActive ? (
          <span className="text-[10px] font-medium" style={{ color: colors.success }}>
            {t('active')}
          </span>
        ) : (
          <span className="text-[10px] font-medium" style={{ color: `${colors.onSurface}55` }}>
            {t('inactive')}
          </span>
        )}

        {provider.lastTestSuccess === false && (
          <span
            data-testid={`provider-alert-${provider.id}`}
            className="flex items-center"
            title={t('testFailed')}
          >
            <AlertTriangle
              className="h-3.5 w-3.5"
              style={{ color: colors.error }}
            />
          </span>
        )}
      </div>
    </li>
  );
}
