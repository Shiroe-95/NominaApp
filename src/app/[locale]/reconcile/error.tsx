'use client';

import { useEffect } from 'react';

export default function ReconcileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[reconcile-error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
        <span className="text-3xl">🔍</span>
      </div>
      <h2 className="text-xl font-semibold text-white">Error en reconciliación</h2>
      <p className="text-sm text-slate-400 max-w-md">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
