import { Link } from '@/i18n/routing';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-navy-dark">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-white mb-4">404</h1>
                <p className="text-slate-400 mb-6">Pagina no encontrada</p>
                <Link 
                    href="/" 
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-violet-dark px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-violet/30 transition-all"
                >
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
