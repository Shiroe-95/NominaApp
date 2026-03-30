import { Link } from '@/i18n/routing';

export default function ReportsNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-slate-500/20 flex items-center justify-center">
        <span className="text-3xl">📊</span>
      </div>
      <h2 className="text-xl font-semibold text-white">Reporte no encontrado</h2>
      <p className="text-sm text-slate-400 max-w-md">
        El reporte que buscas no existe o fue eliminado.
      </p>
      <Link
        href={'/reports' as never}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        Ver reportes
      </Link>
    </div>
  );
}
