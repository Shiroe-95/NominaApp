'use client';

/**
 * Props del componente ProviderCard.
 *
 * @property name - Nombre visible del proveedor (ej: "Mi OpenAI").
 * @property providerType - Tipo de proveedor: openai, anthropic, groq, google u openrouter.
 * @property model - Identificador del modelo configurado (ej: "gpt-4o-mini").
 * @property isActive - Indica si el proveedor está habilitado para recibir solicitudes.
 * @property lastTestSuccess - Resultado del último test de conectividad (null si nunca se probó).
 * @property onTest - Callback para ejecutar un test de conectividad.
 * @property onEdit - Callback para abrir el formulario de edición.
 * @property onDelete - Callback para eliminar el proveedor.
 * @property className - Clases CSS adicionales para el contenedor.
 */
export interface ProviderCardProps {
  name: string;
  providerType: string;
  model: string;
  isActive: boolean;
  lastTestSuccess?: boolean | null;
  onTest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

/**
 * Tarjeta visual de un proveedor de IA configurado.
 *
 * Muestra nombre, tipo, modelo, estado activo/inactivo y resultado del último
 * test de conectividad. Incluye acciones opcionales de test, edición y eliminación.
 *
 * Se utiliza en la página de configuración de proveedores (`/settings/providers`)
 * dentro de la lista ordenable por prioridad.
 *
 * @param props - {@link ProviderCardProps}
 * @returns Tarjeta con información y acciones del proveedor.
 */
export function ProviderCard({
  name,
  providerType,
  model,
  isActive,
  lastTestSuccess,
  onTest,
  onEdit,
  onDelete,
  className = '',
}: ProviderCardProps) {
  return (
    <div
      className={`
        glass-panel rounded-[var(--radius-md)] p-4
        transition-all duration-200 hover:border-white/15 hover:shadow-lg hover:shadow-black/20
        ${!isActive ? 'opacity-60' : ''}
        ${className}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">{name}</h3>
            <span
              className={`
                w-2 h-2 rounded-full shrink-0
                ${isActive ? 'bg-emerald animate-pulse-glow' : 'bg-slate-500'}
              `}
              title={isActive ? 'Activo' : 'Inactivo'}
            />
          </div>
          <p className="text-xs text-slate-400">
            {providerType} · <span className="text-slate-500">{model}</span>
          </p>
        </div>

        {lastTestSuccess !== undefined && lastTestSuccess !== null && (
          <span
            className={`
              shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full
              ${lastTestSuccess
                ? 'bg-emerald/15 text-emerald-light'
                : 'bg-rose/15 text-rose-light'
              }
            `}
          >
            {lastTestSuccess ? 'OK' : 'Error'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        {onTest && (
          <button
            onClick={onTest}
            className="text-[11px] font-medium text-cyan-light hover:text-cyan transition-colors px-2 py-1 rounded hover:bg-cyan/10"
          >
            Test
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[11px] font-medium text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            Editar
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-[11px] font-medium text-rose-light/70 hover:text-rose-light transition-colors px-2 py-1 rounded hover:bg-rose/10 ml-auto"
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
